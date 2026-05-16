import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mountainRouter from "./mountain";
import mountainImageRouter from "./mountain-image";
import hillsRouter from "./hills";
import adjustPlanRouter from "./adjust-plan";
import coachRouter from "./coach";
import alpineRouter from "./alpine";
import trailRouteRouter from "./trail-route";
import trailMapImageRouter from "./trail-map-image";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mountainRouter);
router.use(mountainImageRouter);
router.use(hillsRouter);
router.use(adjustPlanRouter);
router.use(coachRouter);
router.use(alpineRouter);
router.use(trailRouteRouter);
router.use(trailMapImageRouter);

export default router;
