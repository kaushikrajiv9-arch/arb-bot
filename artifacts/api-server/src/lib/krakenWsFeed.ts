import WebSocket from "ws";
import { logger } from "./logger";
import { broadcast } from "./wsBroadcast";

const KRAKEN_WS_URL = "wss://ws.kraken.com/v2";
const KRAKEN_PAIRS = [
  "BTC/USD", "ETH/USD", "SOL/USD",
  "XRP/USD", "DOGE/USD", "AVAX/USD",
];

let krakenSocket: WebSocket | null = null;
let reconnectDelay = 1000;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let shuttingDown = false;
let started = false;

// Cache of the latest price payload per product so new browser clients get
// an immediate snapshot instead of waiting for the next Kraken tick.
const priceCache = new Map<string, string>();

export function startKrakenFeed() {
  if (started) return;
  started = true;
  connectToKraken();
}

function connectToKraken() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  krakenSocket = new WebSocket(KRAKEN_WS_URL);

  krakenSocket.on("open", () => {
    reconnectDelay = 1000;
    logger.info("Connected to Kraken WS v2 feed");
    krakenSocket!.send(
      JSON.stringify({
        method: "subscribe",
        params: {
          channel: "ticker",
          symbol: KRAKEN_PAIRS,
        },
      }),
    );
  });

  krakenSocket.on("message", (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.channel !== "ticker") return;
      for (const tick of msg.data ?? []) {
        const symbol = tick.symbol as string;
        const product_id = symbol.replace("/", "-");
        const price = tick.last;
        const best_bid = tick.bid;
        const best_ask = tick.ask;
        if (!price) continue;
        const payload = JSON.stringify({
          source: "kraken",
          product_id,
          price: price.toString(),
          best_bid: best_bid?.toString(),
          best_ask: best_ask?.toString(),
        });
        priceCache.set(product_id, payload);
        broadcast(payload);
      }
    } catch (err) {
      logger.error({ err }, "krakenWsFeed parse error");
    }
  });

  krakenSocket.on("close", () => {
    logger.warn("Kraken WS closed");
    if (!shuttingDown) scheduleReconnect();
  });

  krakenSocket.on("error", (err) => {
    logger.error({ err }, "Kraken WS error");
  });
}

function scheduleReconnect() {
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
    logger.info({ reconnectDelay }, "Reconnecting to Kraken WS");
    connectToKraken();
  }, reconnectDelay);
}

/** Send all cached Kraken prices to a single newly-connected browser client. */
export function sendKrakenSnapshot(ws: WebSocket) {
  if (ws.readyState !== WebSocket.OPEN) return;
  for (const payload of priceCache.values()) {
    ws.send(payload);
  }
}

export function shutdownKraken() {
  shuttingDown = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  krakenSocket?.close();
}
