import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mountainRouter from "./mountain";
import hillsRouter from "./hills";
import adjustPlanRouter from "./adjust-plan";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mountainRouter);
router.use(hillsRouter);
router.use(adjustPlanRouter);

export default router;
