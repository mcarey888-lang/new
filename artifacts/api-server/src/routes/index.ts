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

const router: IRouter = Router();

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
router.use(trackedRoutesRouter);
router.use(demoLoadRouter);
router.use(mountainVerificationRouter);

export default router;
