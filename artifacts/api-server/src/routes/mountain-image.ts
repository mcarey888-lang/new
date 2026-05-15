import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/mountain-image", async (req, res) => {
  const { name } = req.body as { name?: string };

  if (!name || typeof name !== "string" || name.trim().length < 1) {
    res.status(400).json({ imageUrl: null });
    return;
  }

  const mountain = name.trim();
  const words = mountain.split(/\s+/).filter(w => w.length > 3);
  const candidates = [mountain, ...words].slice(0, 4);

  try {
    for (const candidate of candidates) {
      // Step 1: opensearch for best matching article title
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(candidate)}&limit=3&format=json`;
      const searchRes = await fetch(searchUrl, {
        headers: { "Accept": "application/json", "User-Agent": "SummitReady/1.0" },
      });
      if (!searchRes.ok) continue;

      const searchData = await searchRes.json() as [string, string[], string[], string[]];
      const titles: string[] = searchData[1] ?? [];
      if (titles.length === 0) continue;

      // Step 2: batch pageimages query for all candidate titles
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
        if (url) {
          res.json({ imageUrl: url });
          return;
        }
      }
    }

    res.json({ imageUrl: null });
  } catch (err) {
    req.log.warn({ err }, "Mountain image lookup failed");
    res.json({ imageUrl: null });
  }
});

export default router;
