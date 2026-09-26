import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { verifiedDirections } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  directionsIdentity, fetchParkingPlace, gpsConfirmsPlace, searchParking,
} from "../services/directionsLookup.js";

const router: IRouter = Router();
const targetSchema = z.object({
  hillName: z.string().trim().min(2).max(160),
  location: z.string().max(160).default(""),
  routeIdentityKey: z.string().max(250).optional(),
  summitIdentityKey: z.string().max(250).optional(),
  summitLat: z.number().finite().min(-90).max(90),
  summitLng: z.number().finite().min(-180).max(180),
});

router.post("/directions/lookup", async (req, res) => {
  const parsed = targetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A mapped hill location is required for directions." });
  const target = parsed.data;
  const identityKey = directionsIdentity(target);
  try {
    const [verified] = await db.select().from(verifiedDirections)
      .where(eq(verifiedDirections.identityKey, identityKey)).limit(1);
    if (verified) return res.json({
      status: "gps_confirmed", name: verified.label, lat: verified.lat, lng: verified.lng,
    });

    const result = await searchParking(target.hillName, target.location, {
      lat: target.summitLat, lng: target.summitLng,
    });
    if (!result) return res.status(404).json({
      error: "No nearby named parking place was found. Check local route information before travelling.",
    });
    return res.json({ status: "internet_lookup", ...result });
  } catch (err) {
    req.log.error({ err }, "Directions lookup failed");
    return res.status(503).json({ error: "Parking lookup is unavailable. Please try again later." });
  }
});

router.post("/directions/verify", async (req, res) => {
  const userId = getAuth(req).userId;
  if (!userId) return res.status(401).json({ error: "Sign in to confirm a destination." });
  const parsed = targetSchema.extend({
    placeId: z.string().min(2).max(32),
    fix: z.object({
      lat: z.number(), lng: z.number(), accuracy: z.number(), timestamp: z.number(),
    }),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid GPS confirmation." });
  const { fix, placeId, ...target } = parsed.data;
  const identityKey = directionsIdentity(target);
  try {
    const [existing] = await db.select().from(verifiedDirections)
      .where(eq(verifiedDirections.identityKey, identityKey)).limit(1);
    if (existing) return res.json({
      status: "gps_confirmed", name: existing.label, lat: existing.lat, lng: existing.lng,
    });
    // Re-resolve the place server-side: clients cannot choose arbitrary shared pins.
    const place = await fetchParkingPlace(placeId, { lat: target.summitLat, lng: target.summitLng }, target.hillName);
    if (!place) return res.status(400).json({ error: "The parking place could not be confirmed." });
    if (!gpsConfirmsPlace(place, fix)) return res.status(422).json({
      error: "Your GPS is not accurate enough or you are not within 80 m of this place. Try again when you arrive.",
    });
    await db.insert(verifiedDirections).values({
      identityKey, placeId: place.placeId, label: place.name,
      // GPS proves arrival; do not publish or retain the user's exact location.
      lat: place.lat, lng: place.lng,
    }).onConflictDoNothing({ target: verifiedDirections.identityKey });
    const [saved] = await db.select().from(verifiedDirections)
      .where(eq(verifiedDirections.identityKey, identityKey)).limit(1);
    return res.json({ status: "gps_confirmed", name: saved.label, lat: saved.lat, lng: saved.lng });
  } catch (err) {
    req.log.error({ err }, "Directions GPS confirmation failed");
    return res.status(503).json({ error: "Could not save the confirmed destination. Try again later." });
  }
});

export default router;