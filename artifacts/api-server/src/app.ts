import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { startSimulator } from "./lib/priceSimulator.js";
import { runStrategyCycle } from "./lib/strategies.js";
import { runOptionsStrategyCycle } from "./lib/optionsEngine.js";
import { getConfig } from "./lib/botConfig.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

startSimulator();
setInterval(() => {
  const cfg = getConfig();
  runStrategyCycle(cfg);
  runOptionsStrategyCycle(cfg);
}, 3000);

export default app;
