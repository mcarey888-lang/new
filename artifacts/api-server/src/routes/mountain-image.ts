import { Router, type IRouter } from "express";

const router: IRouter = Router();

async function findWikimediaUrl(name: string): Promise<string | null> {
  const mountain = name.trim();
  const words = mountain.split(/\s+/).filter(w => w.length > 3);
  const candidates = [mountain, ...words].slice(0, 4);

  for (const candidate of candidates) {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(candidate)}&limit=3&format=json`;
    const searchRes = await fetch(searchUrl, {
      headers: { "Accept": "application/json", "User-Agent": "SummitReady/1.0" },
    });
    if (!searchRes.ok) continue;

    const searchData = await searchRes.json() as [string, string[], string[], string[]];
    const titles: string[] = searchData[1] ?? [];
    if (titles.length === 0) continue;

    const joined = titles.slice(0, 3).join("|");
    const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(joined)}&prop=pageimages&format=json&pithumbsize=1200`;
    const imgRes = await fetch(imgUrl, {
      headers: { "Accept": "application/json", "User-Agent": "SummitReady/1.0" },
    });
    if (!imgRes.ok) continue;

    const imgData = await imgRes.json() as { query?: { pages?: Record<string, { thumbnail?: { source: string } }> } };
    const pages = imgData.query?.pages ?? {};

    for (const page of Object.values(pages)) {
      const url = page.thumbnail?.source;
      if (url) return url;
    }
  }

  return null;
}

// POST — original endpoint, returns JSON with imageUrl
router.post("/mountain-image", async (req, res) => {
  const { name } = req.body as { name?: string };

  if (!name || typeof name !== "string" || name.trim().length < 1) {
    res.status(400).json({ imageUrl: null });
    return;
  }

  try {
    const imageUrl = await findWikimediaUrl(name);
    res.json({ imageUrl });
  } catch (err) {
    req.log.warn({ err }, "Mountain image lookup failed");
    res.json({ imageUrl: null });
  }
});

// GET — proxy endpoint: fetches the Wikimedia image and streams it back
// so mobile clients never load directly from upload.wikimedia.org
// Usage: GET /api/mountain-image?name=Kinder+Scout
router.get("/mountain-image", async (req, res) => {
  const name = req.query["name"];

  if (!name || typeof name !== "string" || name.trim().length < 1) {
    res.status(400).end();
    return;
  }

  try {
    const wikimediaUrl = await findWikimediaUrl(name);

    if (!wikimediaUrl) {
      res.status(404).end();
      return;
    }

    const imgRes = await fetch(wikimediaUrl, {
      headers: { "User-Agent": "SummitReady/1.0 (https://summitready.app)" },
    });

    if (!imgRes.ok) {
      res.status(502).end();
      return;
    }

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const buffer = await imgRes.arrayBuffer();

    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=86400");
    res.set("Content-Length", String(buffer.byteLength));
    res.send(Buffer.from(buffer));
  } catch (err) {
    req.log.warn({ err }, "Mountain image proxy failed");
    res.status(500).end();
  }
});

export default router;
