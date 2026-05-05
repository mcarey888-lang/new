import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mountainRouter from "./mountain";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mountainRouter);

export default router;
