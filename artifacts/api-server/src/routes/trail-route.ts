import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface Coord { lat: number; lng: number }

function simplifyCoords(coords: Coord[], maxPoints: number): Coord[] {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const out: Coord[] = [];
  for (let i = 0; i < coords.length; i += step) out.push(coords[i]);
  const last = coords[coords.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

router.post("/trail-route", async (req, res) => {
  const { name, location } = req.body as { name?: string; location?: string };

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ coords: [], center: null, found: false });
    return;
  }

  const safeName = name.trim().replace(/[^a-zA-Z0-9\s&''-]/g, "");

  try {
    let centerLat = 54.0;
    let centerLng = -2.0;
    const pad = 0.6;

    if (location) {
      const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;
      const geoRes = await fetch(geoUrl, {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "SummitReady/1.0 (hiking training app)" },
      });
      if (geoRes.ok) {
        const geoData = await geoRes.json() as Array<{ lat: string; lon: string }>;
        if (geoData.length > 0) {
          centerLat = parseFloat(geoData[0].lat);
          centerLng = parseFloat(geoData[0].lon);
        }
      }
    }

    const south = (centerLat - pad).toFixed(4);
    const north = (centerLat + pad).toFixed(4);
    const west = (centerLng - pad * 1.6).toFixed(4);
    const east = (centerLng + pad * 1.6).toFixed(4);

    const q = `[out:json][timeout:25];
(
  relation["type"="route"]["route"~"hiking|foot|walking"]["name"~"${safeName}",i](${south},${west},${north},${east});
  way["highway"]["name"~"${safeName}",i](${south},${west},${north},${east});
);
out geom;`;

    const overpassRes = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "SummitReady/1.0",
      },
      body: `data=${encodeURIComponent(q)}`,
      signal: AbortSignal.timeout(28000),
    });

    if (!overpassRes.ok) {
      res.json({ coords: [], center: { lat: centerLat, lng: centerLng }, found: false });
      return;
    }

    type OSMNode = { lat: number; lon: number };
    type OSMElement = {
      type: "way" | "relation" | "node";
      geometry?: OSMNode[];
      members?: Array<{ type: string; role?: string; geometry?: OSMNode[] }>;
    };
    const data = await overpassRes.json() as { elements: OSMElement[] };

    const allCoords: Coord[] = [];

    for (const el of data.elements) {
      if (el.type === "way" && el.geometry) {
        for (const pt of el.geometry) allCoords.push({ lat: pt.lat, lng: pt.lon });
      } else if (el.type === "relation" && el.members) {
        for (const m of el.members) {
          if (m.type === "way" && m.geometry) {
            for (const pt of m.geometry) allCoords.push({ lat: pt.lat, lng: pt.lon });
          }
        }
      }
    }

    if (allCoords.length > 0) {
      const simplified = simplifyCoords(allCoords, 350);
      const avgLat = allCoords.reduce((s, c) => s + c.lat, 0) / allCoords.length;
      const avgLng = allCoords.reduce((s, c) => s + c.lng, 0) / allCoords.length;
      res.json({ coords: simplified, center: { lat: avgLat, lng: avgLng }, found: true });
    } else {
      res.json({ coords: [], center: { lat: centerLat, lng: centerLng }, found: false });
    }
  } catch (err) {
    req.log.warn({ err }, "Trail route lookup failed");
    res.json({ coords: [], center: null, found: false });
  }
});

export default router;
