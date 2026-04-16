import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import contractsRouter from "./contracts";
import obligationsRouter from "./obligations";
import dashboardRouter from "./dashboard";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(contractsRouter);
router.use(obligationsRouter);
router.use(dashboardRouter);
router.use(adminRouter);

export default router;
