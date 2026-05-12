import http from "http";
import { WebSocketServer } from "ws";
import app from "./app";
import { logger } from "./lib/logger";
import { addBrowserClient, sendCbSnapshot, shutdown as shutdownCoinbase } from "./lib/cbWsFeed";
import { startKrakenFeed, shutdownKraken, sendKrakenSnapshot } from "./lib/krakenWsFeed";
import { startOkxFeed, shutdownOkx, sendOkxSnapshot } from "./lib/okxWsFeed";
import { startFundingRateFeed, stopFundingRateFeed, sendFundingRateSnapshot } from "./lib/fundingRateFeed";
import { addStockClient, stopAlpacaFeed, broadcastStock } from "./lib/alpacaFeed";
import { startBinanceFeed, shutdownBinance, sendBinanceSnapshot } from "./lib/binanceWsFeed";
import { startBybitFeed, shutdownBybit, sendBybitSnapshot } from "./lib/bybitWsFeed";
import { startNseFeed, stopNseFeed, sendNseSnapshot } from "./lib/nseStockFeed";
import { startUsStockFeed, stopUsStockFeed, sendUsStockSnapshot } from "./lib/usStockFeed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const pathname = new URL(req.url ?? "/", `http://${req.headers.host}`)
    .pathname;
  if (pathname === "/api/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      addBrowserClient(ws);
      sendCbSnapshot(ws);
      sendKrakenSnapshot(ws);
      sendOkxSnapshot(ws);
      sendFundingRateSnapshot(ws);
      sendBinanceSnapshot(ws);
      sendBybitSnapshot(ws);
    });
  } else if (pathname === "/api/stock-ws") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      addStockClient(ws);
      const send = (msg: string) => { if ((ws as any).readyState === 1) ws.send(msg); };
      sendNseSnapshot(send);
      sendUsStockSnapshot(send);
    });
  } else {
    socket.destroy();
  }
});

wss.on("error", (err) => {
  logger.error({ err }, "WebSocketServer error");
});

process.on("SIGTERM", () => {
  shutdownCoinbase();
  shutdownKraken();
  shutdownOkx();
  shutdownBinance();
  shutdownBybit();
  stopFundingRateFeed();
  stopAlpacaFeed();
  stopNseFeed();
  stopUsStockFeed();
  server.close(() => process.exit(0));
});

server.listen(port, () => {
  logger.info({ port }, "Server listening");
  startKrakenFeed();
  startOkxFeed();
  startFundingRateFeed();
  startBinanceFeed();
  startBybitFeed();
  startNseFeed((data) => broadcastStock(data));
  startUsStockFeed((data) => broadcastStock(data));
});
