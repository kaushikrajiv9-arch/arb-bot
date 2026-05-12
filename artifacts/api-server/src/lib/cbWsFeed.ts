import WebSocket from "ws";
import { logger } from "./logger";
import { clients, broadcast } from "./wsBroadcast";

const CB_WS_URL = "wss://advanced-trade-ws.coinbase.com/";
const PAIRS = ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "DOGE-USD", "AVAX-USD"];

let cbSocket: WebSocket | null = null;
let reconnectDelay = 1000;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let shuttingDown = false;

const priceCache = new Map<string, string>();

function connectToCoinbase() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  cbSocket = new WebSocket(CB_WS_URL);

  cbSocket.on("open", () => {
    reconnectDelay = 1000;
    logger.info("Connected to Coinbase WS feed");
    cbSocket!.send(
      JSON.stringify({
        type: "subscribe",
        product_ids: PAIRS,
        channel: "ticker",
      }),
    );
  });

  cbSocket.on("message", (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.channel !== "ticker") return;
      for (const event of msg.events ?? []) {
        for (const ticker of event.tickers ?? []) {
          const payload = JSON.stringify({
            source: "coinbase",
            product_id: ticker.product_id,
            price: ticker.price,
            price_percent_chg_24_h: ticker.price_percent_chg_24_h,
            best_bid: ticker.best_bid,
            best_ask: ticker.best_ask,
          });
          priceCache.set(ticker.product_id, payload);
          broadcast(payload);
        }
      }
    } catch (err) {
      logger.error({ err }, "cbWsFeed parse error");
    }
  });

  cbSocket.on("close", () => {
    logger.warn("Coinbase WS closed");
    if (!shuttingDown) scheduleReconnect();
  });

  cbSocket.on("error", (err) => {
    logger.error({ err }, "Coinbase WS error");
  });
}

function scheduleReconnect() {
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
    logger.info({ reconnectDelay }, "Reconnecting to Coinbase WS");
    connectToCoinbase();
  }, reconnectDelay);
}

/** Send all cached Coinbase prices to a newly-connected browser client. */
export function sendCbSnapshot(ws: WebSocket) {
  if (ws.readyState !== WebSocket.OPEN) return;
  for (const payload of priceCache.values()) ws.send(payload);
}

export function addBrowserClient(ws: WebSocket) {
  clients.add(ws);
  logger.info({ total: clients.size }, "Browser WS client connected");

  if (
    !cbSocket ||
    cbSocket.readyState === WebSocket.CLOSED ||
    cbSocket.readyState === WebSocket.CLOSING
  ) {
    connectToCoinbase();
  }

  ws.on("close", () => {
    clients.delete(ws);
    logger.info({ total: clients.size }, "Browser WS client disconnected");
  });

  ws.on("error", (err) => {
    logger.error({ err }, "Browser WS client error");
    clients.delete(ws);
  });
}

export function shutdown() {
  shuttingDown = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  cbSocket?.close();
}
