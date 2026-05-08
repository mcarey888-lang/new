import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mountainRouter from "./mountain";
import hillsRouter from "./hills";
import adjustPlanRouter from "./adjust-plan";
import coachRouter from "./coach";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mountainRouter);
router.use(hillsRouter);
router.use(adjustPlanRouter);
router.use(coachRouter);

export default router;
