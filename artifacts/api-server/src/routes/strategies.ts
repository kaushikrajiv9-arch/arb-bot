import { Router, type IRouter } from "express";
import { getLastSignals } from "../lib/strategies.js";
import { getPairIndicators, PAIRS, EXCHANGES } from "../lib/priceSimulator.js";

const router: IRouter = Router();

router.get("/strategies/signals", (_req, res) => {
  const signals = getLastSignals();
  res.json({ signals, generatedAt: new Date() });
});

router.get("/strategies/indicators", (_req, res) => {
  const indicators = PAIRS.flatMap((pair) =>
    EXCHANGES.map((exchange) => getPairIndicators(pair, exchange)).filter(Boolean)
  );
  res.json({ indicators });
});

export default router;
