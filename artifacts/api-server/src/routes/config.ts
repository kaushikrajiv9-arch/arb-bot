import { Router, type IRouter } from "express";
import { getConfig, updateConfig } from "../lib/botConfig.js";

const router: IRouter = Router();

router.get("/config", (_req, res) => {
  res.json(getConfig());
});

router.put("/config", (req, res) => {
  const updated = updateConfig(req.body);
  res.json(updated);
});

export default router;
