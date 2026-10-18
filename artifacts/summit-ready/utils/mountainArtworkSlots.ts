import { fetchMountainHeroStatus, MountainHeroRequestError } from "./mountainHero";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const normalize = (value: string) => value.normalize("NFKD").replace(/\p{Diacritic}/gu, "")
  .toLowerCase().trim().replace(/\s+/g, " ");
const place = (value: string) => normalize(value).replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function mountainArtworkSlot(uri: string) {
  try {
    const url = new URL(uri, "https://relative.invalid");
    if (!url.pathname.endsWith("/api/mountain-image")) return null;
    // Image URLs can come from external content. Never send a Clerk bearer
    // token to an image host other than this build's configured API.
    if (/^https?:/i.test(uri)) {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      if (!domain || url.origin !== `https://${domain}`) return null;
    } else if (!uri.startsWith("/") || uri.startsWith("//")) return null;
    const name = url.searchParams.get("name") ?? "";
    // Route artwork must not silently become a different mountain/route.
    if (url.searchParams.has("routeIdentityKey") ||
        /\b(?:route|ridge|edge|traverse|tour|circuit|via)\b/i.test(name)) return null;
    const id = url.searchParams.get("mountainId");
    if (id && !UUID.test(id)) return null;
    return {
      name, id,
      apiBase: `${uri.startsWith("http") ? url.origin : ""}${url.pathname.replace(/\/mountain-image$/, "")}`,
      location: url.searchParams.get("location") ?? "",
    };
  } catch {
    return null;
  }
}

type Listener = (revision: string, mountainId: string) => void;
type Job = { listeners: Set<Listener>; cancelled: boolean; timer?: ReturnType<typeof setTimeout>; ready?: string; mountainId?: string };
const jobs = new Map<string, Job>();

/** One bounded, authenticated request/poll flow shared by mounted slots. */
export function watchMountainArtwork(
  uri: string, userId: string, getToken: () => Promise<string | null>, listener: Listener,
): () => void {
  const slot = mountainArtworkSlot(uri);
  if (!slot || !userId || (!slot.id && !slot.name.trim())) return () => {};
  const key = JSON.stringify([userId, slot.apiBase, slot.id ?? normalize(slot.name), slot.id ? "" : slot.location]);
  let job = jobs.get(key);
  if (job) {
    job.listeners.add(listener);
    if (job.ready && job.mountainId) listener(job.ready, job.mountainId);
  } else {
    job = { listeners: new Set([listener]), cancelled: false };
    jobs.set(key, job);
    const current = job;
    const deadline = Date.now() + 3 * 60_000;
    let id = slot.id;
    let failures = 0;
    const schedule = (request: boolean, delay = 5000) => {
      if (!current.cancelled && Date.now() + delay < deadline) {
        current.timer = setTimeout(() => void check(request), delay);
      }
    };
    const check = async (request: boolean) => {
      if (current.cancelled || Date.now() >= deadline || !id) return;
      try {
        const result = await fetchMountainHeroStatus(id, slot.apiBase, getToken, request);
        if (current.cancelled) return;
        failures = 0;
        if (result.status === "ready") {
          // Re-read the shared image endpoint: its current approval wins over
          // automatic art. Preserve each slot's own dimensions and crop.
          current.ready = result.jobId ?? "ready";
          current.mountainId = id;
          current.listeners.forEach(notify => notify(current.ready!, id!));
        } else if (result.status === "generating") {
          schedule(false);
        } else if (!request) {
          await check(true);
        }
      } catch (error) {
        if (current.cancelled) return;
        if (error instanceof MountainHeroRequestError &&
            (error.status === 429 || error.status === 503) && error.retryAfterMs) {
          schedule(request, Math.max(5000, error.retryAfterMs));
        } else if (!(error instanceof MountainHeroRequestError && error.status < 500) && ++failures <= 3) {
          schedule(request);
        }
      }
    };
    void (async () => {
      try {
        if (!id) {
          // Legacy cards sometimes carry a name but no ID. This is a read-only
          // catalogue search, NOT AI discovery or a mountain-lookup generation.
          const response = await fetch(`${slot.apiBase}/mountain-discovery?q=${encodeURIComponent(slot.name)}&limit=50`);
          if (!response.ok || current.cancelled) return;
          const data = await response.json();
          const matches = (data.items ?? []).filter((item: {
            id: string; name: string; source: string; verificationStatus: string;
            country?: string; region?: string; area?: string;
          }) => item.source === "catalogue" && item.verificationStatus === "verified" &&
            normalize(item.name) === normalize(slot.name) && UUID.test(item.id) &&
            (!slot.location || [
              item.country, item.region, item.area,
              [item.region, item.country].filter(Boolean).join(", "),
              [item.area, item.region, item.country].filter(Boolean).join(", "),
            ].some(candidate => candidate && place(candidate) === place(slot.location))));
          // Ambiguity, pagination and non-catalogue hills never start paid work.
          if (data.hasMore || matches.length !== 1) return;
          id = matches[0].id;
        }
        await check(false);
      } catch {
        // An unavailable catalogue is not permission to invent an identity.
      }
    })();
  }
  const subscribed = job;
  return () => {
    subscribed.listeners.delete(listener);
    if (!subscribed.listeners.size) {
      subscribed.cancelled = true;
      if (subscribed.timer) clearTimeout(subscribed.timer);
      jobs.delete(key);
    }
  };
}

export function refreshedMountainArtworkUri(uri: string, revision: string, mountainId?: string): string {
  const [path, query = ""] = uri.split("?");
  const params = new URLSearchParams(query);
  params.set("heroSlotRevision", revision);
  if (mountainId) params.set("mountainId", mountainId);
  return `${path}?${params.toString()}`;
}
