import { Router, type IRouter } from "express";

const router: IRouter = Router();

function titleIsRelevant(title: string, originalName: string): boolean {
  const titleLower = title.toLowerCase();
  const nameWords = originalName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (nameWords.length === 0) return true;
  const matchCount = nameWords.filter(w => titleLower.includes(w)).length;
  return matchCount / nameWords.length > 0.5;
}

async function findWikimediaUrl(name: string): Promise<string | null> {
  const mountain = name.trim();

  // Try geographic qualifiers first — avoids matching famous people or places
  // that share a word with the hill name (e.g. "Clough Head" → "Brian Clough")
  const queries = [
    `${mountain} fell`,
    `${mountain} mountain`,
    `${mountain} hill`,
    mountain,
  ];

  for (const query of queries) {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&format=json`;
    const searchRes = await fetch(searchUrl, {
      headers: { "Accept": "application/json", "User-Agent": "SummitReady/1.0" },
    });
    if (!searchRes.ok) continue;

    const searchData = await searchRes.json() as [string, string[], string[], string[]];
    const allTitles: string[] = searchData[1] ?? [];

    // Filter to titles that are actually related to the original query
    const titles = allTitles.filter(t => titleIsRelevant(t, mountain));
    if (titles.length === 0) continue;

    const joined = titles.slice(0, 3).join("|");
    const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(joined)}&prop=pageimages&format=json&pithumbsize=1200`;
    const imgRes = await fetch(imgUrl, {
      headers: { "Accept": "application/json", "User-Agent": "SummitReady/1.0" },
    });
    if (!imgRes.ok) continue;

    const imgData = await imgRes.json() as { query?: { pages?: Record<string, { title?: string; thumbnail?: { source: string } }> } };
    const pages = imgData.query?.pages ?? {};

    for (const page of Object.values(pages)) {
      const url = page.thumbnail?.source;
      if (url && page.title && titleIsRelevant(page.title, mountain)) return url;
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
