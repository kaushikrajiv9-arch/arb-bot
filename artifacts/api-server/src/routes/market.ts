import { Router, type IRouter } from "express";
import { getAllPrices, getPriceHistory, PAIRS, EXCHANGES } from "../lib/priceSimulator.js";

const router: IRouter = Router();

router.get("/market/prices", (_req, res) => {
  const prices = getAllPrices();
  res.json({ prices, updatedAt: new Date() });
});

router.get("/market/orderbook", (req, res) => {
  const pair = req.query["pair"] as string;
  if (!pair || !PAIRS.includes(pair)) {
    res.status(400).json({ error: "Invalid or missing pair" });
    return;
  }
  const exchange = EXCHANGES[0];
  const hist = getPriceHistory(pair, exchange);
  const midPrice = hist[hist.length - 1] ?? 1;
  const bids: [number, number][] = Array.from({ length: 10 }, (_, i) => [
    midPrice * (1 - 0.0002 * (i + 1)),
    Math.random() * 2 + 0.1,
  ]);
  const asks: [number, number][] = Array.from({ length: 10 }, (_, i) => [
    midPrice * (1 + 0.0002 * (i + 1)),
    Math.random() * 2 + 0.1,
  ]);
  res.json({ pair, bids, asks, timestamp: new Date() });
});

export default router;
