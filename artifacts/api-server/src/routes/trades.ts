import { Router, type IRouter } from "express";
import { getTrades, getTradeStats } from "../lib/tradeStore.js";

const router: IRouter = Router();

router.get("/trades", (req, res) => {
  const limit = Number(req.query["limit"] ?? 50);
  const pair = req.query["pair"] as string | undefined;
  const trades = getTrades(limit, pair);
  const allTrades = getTrades(9999);
  res.json({ trades, total: allTrades.length });
});

router.get("/trades/stats", (_req, res) => {
  res.json(getTradeStats());
});

export default router;
