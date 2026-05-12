import WebSocket from "ws";
import { logger } from "./logger";
import { broadcast } from "./wsBroadcast";

// Binance.US stream — used because Binance.com geo-blocks US datacenter IPs (HTTP 451)
const BINANCE_WS_URL =
  "wss://stream.binance.us:9443/stream?streams=" +
  ["btcusdt","ethusdt","solusdt","xrpusdt","dogeusdt","avaxusdt"]
    .map(s => `${s}@miniTicker`).join("/");

const SYMBOL_MAP: Record<string, string> = {
  BTCUSDT:  "BTC-USD",
  ETHUSDT:  "ETH-USD",
  SOLUSDT:  "SOL-USD",
  XRPUSDT:  "XRP-USD",
  DOGEUSDT: "DOGE-USD",
  AVAXUSDT: "AVAX-USD",
};

let socket: WebSocket | null = null;
let reconnectDelay = 1000;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let shuttingDown = false;
let started = false;

const priceCache = new Map<string, string>();

export function startBinanceFeed() {
  if (started) return;
  started = true;
  connect();
}

export function shutdownBinance() {
  shuttingDown = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  socket?.close();
}

export function sendBinanceSnapshot(ws: WebSocket) {
  for (const payload of priceCache.values()) {
    if ((ws as any).readyState === 1) ws.send(payload);
  }
}

function connect() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  socket = new WebSocket(BINANCE_WS_URL);

  socket.on("open", () => {
    reconnectDelay = 1000;
    logger.info("Connected to Binance stream feed");
  });

  socket.on("message", (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString()) as {
        stream: string;
        data: { s: string; c: string; o: string };
      };
      const d = msg.data;
      if (!d?.s || !d?.c) return;
      const productId = SYMBOL_MAP[d.s];
      if (!productId) return;
      const price = parseFloat(d.c);
      if (isNaN(price) || price <= 0) return;
      const payload = JSON.stringify({
        source: "binance",
        product_id: productId,
        price,
        open: parseFloat(d.o) || price,
      });
      priceCache.set(productId, payload);
      broadcast(payload);
    } catch {}
  });

  socket.on("close", () => {
    logger.warn("Binance WS closed — reconnecting");
    scheduleReconnect();
  });

  socket.on("error", (err) => {
    logger.error({ err }, "Binance WS error");
    socket?.terminate();
  });
}

function scheduleReconnect() {
  if (shuttingDown) return;
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
    connect();
  }, reconnectDelay);
}
