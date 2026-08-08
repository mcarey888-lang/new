import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mountainRouter from "./mountain";
import mountainImageRouter from "./mountain-image";
import hillsRouter from "./hills";
import hillsUnifiedRouter from "./hills-unified";
import adjustPlanRouter from "./adjust-plan";
import coachRouter from "./coach";
import alpineRouter from "./alpine";
import trailRouteRouter from "./trail-route";
import trailMapImageRouter from "./trail-map-image";
import trailMapWebRouter from "./trail-map-web";
import hikeMapWebRouter from "./hike-map-web";
import seededTrailsRouter from "./seeded-trails";
import trackedRoutesRouter from "./tracked-routes";
import demoLoadRouter from "./demo-load";
import mountainVerificationRouter from "./mountain-verification";
import hillSessionRouter from "./hill-session";
import hillVerificationAdminRouter from "./hill-verification-admin";
import userRouter from "./user";
import virtualExpeditionRouter from "./virtual-expedition";
import virtualExpeditionEngineRouter from "./virtual-expedition-engine";
import { signatureChallengesRouter } from "./signature-challenges";
import { artworkRouter } from "./artwork";
import { atlasRouter } from "./atlas";
import { adminRouter } from "./admin";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// ── Public routes (no auth required) ─────────────────────────────────────────
router.use(healthRouter);
router.use(mountainRouter);
router.use(mountainImageRouter);
router.use(hillsRouter);
router.use(hillsUnifiedRouter);
router.use(adjustPlanRouter);
router.use(coachRouter);
router.use(alpineRouter);
router.use(trailRouteRouter);
router.use(trailMapImageRouter);
router.use(trailMapWebRouter);
router.use(hikeMapWebRouter);
router.use(seededTrailsRouter);
router.use(demoLoadRouter);
router.use(virtualExpeditionRouter);
router.use(virtualExpeditionEngineRouter);
router.use(signatureChallengesRouter);
router.use(mountainVerificationRouter);

// Artwork and Atlas routers apply requireAdminAuth internally to write/mutating
// endpoints; read-only endpoints (status, image, prompt) remain public.
router.use("/artwork", artworkRouter);
router.use("/atlas", atlasRouter);

// Admin session + identity routes (login + /me)
router.use("/admin", adminRouter);

// ── Auth-required routes ──────────────────────────────────────────────────────
// trackedRoutesRouter handles its own per-method auth (DELETE requires auth +
// ownership; GET/POST are public). Auth is enforced inside the router.
router.use(trackedRoutesRouter);

// Hill sessions and tracking data belong to a user — require Clerk auth.
router.use("/hill-session", requireAuth(), hillSessionRouter);

// User account management — requires Clerk auth.
router.use(requireAuth(), userRouter);

// Hill verification admin applies requireAdminAuth internally on every route.
router.use("/admin/hill-verification", hillVerificationAdminRouter);

export default router;
