import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import marketRouter from "./market.js";
import strategiesRouter from "./strategies.js";
import tradesRouter from "./trades.js";
import configRouter from "./config.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketRouter);
router.use(strategiesRouter);
router.use(tradesRouter);
router.use(configRouter);

export default router;
