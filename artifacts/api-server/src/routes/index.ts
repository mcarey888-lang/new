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

// ── Auth-required routes ──────────────────────────────────────────────────────
// trackedRoutesRouter handles its own per-method auth (DELETE requires auth +
// ownership; GET/POST are public). Auth is enforced inside the router.
router.use(trackedRoutesRouter);

// Hill sessions and tracking data belong to a user — require auth.
// The mobile app (only caller) provides a Clerk JWT in the Authorization header.
router.use("/hill-session", requireAuth(), hillSessionRouter);

// User account management — requires auth.
router.use(requireAuth(), userRouter);

// Mountain verification and admin pages are called from the landing site which
// has no Clerk session. They are protected by rate limiting + CORS + a
// frontend key-prompt (AdminGuard component). requireAuth is intentionally NOT
// applied here to avoid breaking the internal admin UI.
router.use(mountainVerificationRouter);
router.use("/admin/hill-verification", hillVerificationAdminRouter);

export default router;
