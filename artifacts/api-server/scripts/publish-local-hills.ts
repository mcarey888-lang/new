/** Run after import-local-hills.py. Validates first; atomically promotes only
 * a complete immutable UK snapshot. Existing data remains intact on failure.
 */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { localHillSnapshotSchema, localHillObject, LOCAL_HILL_POINTER } from "../src/services/mountain/localHillIndex";

const filename = process.argv[2];
if (!filename) throw new Error("Usage: tsx scripts/publish-local-hills.ts /path/to/uk-hills.json");
const bytes = await readFile(filename);
const snapshot = localHillSnapshotSchema.parse(JSON.parse(bytes.toString()));
if (new Set(snapshot.peaks.map(p => p.id)).size !== snapshot.peaks.length) throw new Error("Duplicate OSM node identities");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const objectKey = `local-hills/uk/${sha256}.json`;
const file = localHillObject(objectKey);
await file.save(bytes, {
  resumable: false, validation: "crc32c",
  metadata: { contentType: "application/json", cacheControl: "private, max-age=31536000, immutable",
    metadata: { licence: "ODbL-1.0", source: snapshot.sourceUrl, sha256 } },
});
const [saved] = await file.download();
if (createHash("sha256").update(saved).digest("hex") !== sha256) throw new Error("Uploaded dataset did not verify; pointer unchanged");
await localHillObject(LOCAL_HILL_POINTER).save(JSON.stringify({ objectKey, sha256, count: snapshot.peaks.length }), {
  resumable: false, validation: "crc32c",
  metadata: { contentType: "application/json", cacheControl: "no-store" },
});
console.log(JSON.stringify({ promoted: true, peaks: snapshot.peaks.length, regions: snapshot.sources.length, builtAt: snapshot.builtAt, sha256 }));
