import { createHash } from "node:crypto";
import { z } from "zod";
import { objectStorageClient, ObjectStorageService } from "../../lib/objectStorage";
import { logger } from "../../lib/logger";
import type { OSMPeak } from "../../routes/hills-unified";

export const LOCAL_HILL_POINTER = "local-hills/uk/current.json";
const pointerSchema = z.object({
  objectKey: z.string().regex(/^local-hills\/uk\/[a-f0-9]{64}\.json$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  count: z.number().int().min(1000),
});
export const localHillSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  coverage: z.literal("United Kingdom and Ireland"),
  builtAt: z.string().datetime({ offset: true }),
  attribution: z.literal("© OpenStreetMap contributors"),
  licence: z.literal("ODbL-1.0"),
  licenceUrl: z.literal("https://opendatacommons.org/licenses/odbl/1-0/"),
  sourceUrl: z.literal("https://download.geofabrik.de/europe/united-kingdom.html"),
  reviewedAliases: z.array(z.object({
    osmNodeId: z.number().int().positive(), sourceName: z.string(),
    lat: z.number(), lng: z.number(), displayName: z.string(),
    aliases: z.array(z.string()).min(1), reviewedAt: z.string(),
    evidenceUrls: z.array(z.string().url()).min(1),
  })).optional(),
  sources: z.array(z.object({
    region: z.string(), url: z.string().url(), sha256: z.string(),
    dataTimestamp: z.string().datetime(), count: z.number().int().nonnegative(),
  })).min(40),
  peaks: z.array(z.object({
    id: z.number().int().positive().safe(),
    name: z.string().trim().min(1).max(300),
    aliases: z.array(z.string().min(1).max(300)).max(100),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    ele: z.number().positive().max(9000).nullable(),
  })).min(1000).max(200_000),
}).refine(s => ["scotland", "wales", "ireland-and-northern-ireland"].every(
  required => s.sources.some(source => source.region === required),
) && s.sources.filter(source => source.region.startsWith("england/")).length >= 40,
{ message: "Incomplete UK and Ireland regional coverage" });
export type LocalHillSnapshot = z.infer<typeof localHillSnapshotSchema>;
type SnapshotRecord = { snapshot: LocalHillSnapshot; bytes: Buffer; hash: string };
let current: SnapshotRecord | null = null;
let nextCheck = 0;
let pending: Promise<SnapshotRecord> | undefined;

/** Only our fixed snapshot paths, never user-supplied bucket/object paths. */
export function localHillObject(key: string) {
  const directory = new ObjectStorageService().getPrivateObjectDir();
  const [bucket, ...parts] = directory.replace(/^\/+/, "").split("/");
  return objectStorageClient.bucket(bucket).file([...parts, key].join("/"));
}

async function readObject(key: string, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const stream = localHillObject(key).createReadStream();
    const chunks: Buffer[] = [];
    let size = 0;
    const timer = setTimeout(() => stream.destroy(new Error("Local hill snapshot read timed out")), 8_000);
    stream.on("data", (data: Buffer | string) => {
      const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
      size += chunk.length;
      if (size > maxBytes) stream.destroy(new Error("Local hill snapshot exceeds size limit"));
      else chunks.push(chunk);
    });
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("close", () => clearTimeout(timer));
  });
}

/** Poll a small pointer; immutable snapshots are re-read only when changed.
 * Failed refreshes keep the last validated source, with a warning and retry.
 */
export async function loadLocalHillIndex(): Promise<SnapshotRecord> {
  if (current && Date.now() < nextCheck) return current;
  if (!current && Date.now() < nextCheck) throw new Error("The local hill dataset is temporarily unavailable");
  if (pending) return pending;
  pending = (async () => {
    try {
      const pointer = pointerSchema.parse(JSON.parse((await readObject(LOCAL_HILL_POINTER, 4096)).toString()));
      if (pointer.sha256 === current?.hash) {
        nextCheck = Date.now() + 15 * 60_000;
        return current;
      }
      const bytes = await readObject(pointer.objectKey, 20 * 1024 * 1024);
      const hash = createHash("sha256").update(bytes).digest("hex");
      if (hash !== pointer.sha256) throw new Error("Local hill snapshot checksum mismatch");
      const snapshot = localHillSnapshotSchema.parse(JSON.parse(bytes.toString()));
      if (snapshot.peaks.length !== pointer.count ||
          new Set(snapshot.peaks.map(p => p.id)).size !== snapshot.peaks.length) {
        throw new Error("Local hill snapshot count or identity mismatch");
      }
      current = { snapshot, bytes, hash };
      nextCheck = Date.now() + 15 * 60_000;
      return current;
    } catch (err) {
      logger.warn({ errorType: err instanceof Error ? err.name : "unknown", retainedSnapshot: !!current },
        "Local hill source refresh failed");
      nextCheck = Date.now() + 30_000;
      if (current) return current;
      throw new Error("The local hill dataset is temporarily unavailable");
    }
  })();
  try { return await pending; } finally { pending = undefined; }
}

export function normalizeLocalHillName(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function distanceKm(lat: number, lng: number, peak: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const a = Math.sin((peak.lat - lat) * rad / 2) ** 2 +
    Math.cos(lat * rad) * Math.cos(peak.lat * rad) * Math.sin((peak.lng - lng) * rad / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

/** No elevation/prominence threshold: obscure low hills remain searchable.
 * An elevation gain is calculated later, never substituted with summit height.
 */
export function findLocalHillPeaks(
  snapshot: LocalHillSnapshot, lat: number, lng: number, radiusKm: number, name?: string,
): OSMPeak[] {
  if (![lat, lng, radiusKm].every(Number.isFinite) || radiusKm <= 0 || radiusKm > 200 ||
      Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error("Invalid local hill search area");
  const term = name ? normalizeLocalHillName(name) : null;
  const reviewed = new Map((snapshot.reviewedAliases ?? []).map(a => [a.osmNodeId, a]));
  const namesFor = (p: LocalHillSnapshot["peaks"][number]) => {
    const alias = reviewed.get(p.id);
    // A moved/renamed/reused source node must be reviewed again, not silently
    // inherit a different hill's name. Nothing here creates canonical aliases.
    return alias && alias.sourceName === p.name &&
      Math.abs(alias.lat - p.lat) < 0.0001 && Math.abs(alias.lng - p.lng) < 0.0001
      ? alias : undefined;
  };
  return snapshot.peaks
    .filter(p => !term || [p.name, ...p.aliases, ...(namesFor(p)?.aliases ?? [])]
      .some(alias => normalizeLocalHillName(alias) === term))
    .map(p => ({ peak: p, distance: distanceKm(lat, lng, p) }))
    .filter(p => p.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance || a.peak.id - b.peak.id)
    .map(({ peak }) => ({
      id: peak.id, name: namesFor(peak)?.displayName ?? peak.name, lat: peak.lat, lng: peak.lng, ele: peak.ele,
      source: "osm_extract" as const,
    }));
}
