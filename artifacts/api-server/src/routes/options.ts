import { Router, type IRouter } from "express";
import { buildOptionsChain, getLastOptionsSignals, getOptionsPositions } from "../lib/optionsEngine.js";
import { PAIRS } from "../lib/priceSimulator.js";

const router: IRouter = Router();

router.get("/options/chain", (req, res) => {
  const pair = req.query["pair"] as string;
  const expiry = (req.query["expiry"] as string) ?? "0dte";

  if (!pair || !PAIRS.includes(pair)) {
    res.status(400).json({ error: "Invalid or missing pair" });
    return;
  }

  const chain = buildOptionsChain(pair, expiry);
  res.json(chain);
});

router.get("/options/signals", (_req, res) => {
  const signals = getLastOptionsSignals();
  res.json({ signals, generatedAt: new Date() });
});

router.get("/options/positions", (_req, res) => {
  const result = getOptionsPositions();
  res.json(result);
});

export default router;
