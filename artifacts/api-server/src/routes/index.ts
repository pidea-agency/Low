import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import aiRouter from "./ai";
import sessionsRouter from "./sessions";
import settingsRouter from "./settings";
import reportsRouter from "./reports";
import cronRouter from "./cron";
import poaRouter from "./poa";
import judgmentsRouter from "./judgments";
import tasksRouter from "./tasks";
import usersRouter from "./users";
import superAdminRouter from "./super-admin";
import subscriptionRouter from "./subscription";
import clientsRouter from "./clients";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(aiRouter);
router.use(sessionsRouter);
router.use(settingsRouter);
router.use(reportsRouter);
router.use(cronRouter);
router.use(poaRouter);
router.use(judgmentsRouter);
router.use(tasksRouter);
router.use(usersRouter);
router.use(superAdminRouter);
router.use(subscriptionRouter);
router.use(clientsRouter);

export default router;
