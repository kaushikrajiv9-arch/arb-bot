import WebSocket from "ws";
import { logger } from "./logger";
import { broadcast } from "./wsBroadcast";

const OKX_WS_URL = "wss://ws.okx.com:8443/ws/v5/public";

const OKX_INSTRUMENTS = [
  "BTC-USDT", "ETH-USDT", "SOL-USDT",
  "XRP-USDT", "DOGE-USDT", "AVAX-USDT",
];

// Map OKX instId → internal product_id
const OKX_TO_PAIR: Record<string, string> = {
  "BTC-USDT":  "BTC-USD",
  "ETH-USDT":  "ETH-USD",
  "SOL-USDT":  "SOL-USD",
  "XRP-USDT":  "XRP-USD",
  "DOGE-USDT": "DOGE-USD",
  "AVAX-USDT": "AVAX-USD",
};

let okxSocket: WebSocket | null = null;
let reconnectDelay = 1000;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let shuttingDown = false;
let started = false;
let pingTimer: ReturnType<typeof setInterval> | null = null;

const priceCache = new Map<string, string>();

export function startOkxFeed() {
  if (started) return;
  started = true;
  connectToOkx();
}

function connectToOkx() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  okxSocket = new WebSocket(OKX_WS_URL);

  okxSocket.on("open", () => {
    reconnectDelay = 1000;
    logger.info("Connected to OKX WS v5 feed");

    okxSocket!.send(JSON.stringify({
      op: "subscribe",
      args: OKX_INSTRUMENTS.map(instId => ({ channel: "tickers", instId })),
    }));

    // OKX requires a ping every 30s to keep the connection alive
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      if (okxSocket?.readyState === WebSocket.OPEN) okxSocket.send("ping");
    }, 25_000);
  });

  okxSocket.on("message", (raw: Buffer) => {
    const text = raw.toString();
    if (text === "pong") return;
    try {
      const msg = JSON.parse(text);
      if (msg.event) return; // subscribe ack, error, etc.
      if (msg.arg?.channel !== "tickers") return;
      for (const tick of msg.data ?? []) {
        const pair = OKX_TO_PAIR[tick.instId];
        if (!pair) continue;
        const price    = tick.last;
        const best_bid = tick.bidPx;
        const best_ask = tick.askPx;
        if (!price) continue;
        const payload = JSON.stringify({
          source: "okx",
          product_id: pair,
          price: price.toString(),
          best_bid: best_bid?.toString(),
          best_ask: best_ask?.toString(),
        });
        priceCache.set(pair, payload);
        broadcast(payload);
      }
    } catch (err) {
      logger.error({ err }, "okxWsFeed parse error");
    }
  });

  okxSocket.on("close", () => {
    logger.warn("OKX WS closed");
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    if (!shuttingDown) scheduleReconnect();
  });

  okxSocket.on("error", (err) => {
    logger.error({ err }, "OKX WS error");
  });
}

function scheduleReconnect() {
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
    logger.info({ reconnectDelay }, "Reconnecting to OKX WS");
    connectToOkx();
  }, reconnectDelay);
}

export function sendOkxSnapshot(ws: WebSocket) {
  if (ws.readyState !== WebSocket.OPEN) return;
  for (const payload of priceCache.values()) ws.send(payload);
}

export function shutdownOkx() {
  shuttingDown = true;
  if (pingTimer) clearInterval(pingTimer);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  okxSocket?.close();
}
