import WebSocket from "ws";
import { logger } from "./logger";
import { broadcast } from "./wsBroadcast";

const BYBIT_WS_URL = "wss://stream.bybit.com/v5/public/spot";

const SYMBOLS = ["BTCUSDT","ETHUSDT","SOLUSDT","XRPUSDT","DOGEUSDT","AVAXUSDT"];

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
let pingTimer: ReturnType<typeof setInterval> | null = null;
let shuttingDown = false;
let started = false;

const priceCache = new Map<string, string>();

export function startBybitFeed() {
  if (started) return;
  started = true;
  connect();
}

export function shutdownBybit() {
  shuttingDown = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  socket?.close();
}

export function sendBybitSnapshot(ws: WebSocket) {
  for (const payload of priceCache.values()) {
    if ((ws as any).readyState === 1) ws.send(payload);
  }
}

function connect() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  socket = new WebSocket(BYBIT_WS_URL);

  socket.on("open", () => {
    reconnectDelay = 1000;
    logger.info("Connected to Bybit WS v5 spot feed");

    socket!.send(JSON.stringify({
      op: "subscribe",
      args: SYMBOLS.map(s => `tickers.${s}`),
    }));

    // Bybit requires ping every 20s
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ op: "ping" }));
      }
    }, 20_000);
  });

  socket.on("message", (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString()) as {
        op?: string;
        topic?: string;
        type?: string;
        data?: { symbol: string; lastPrice: string; prevPrice24h?: string };
      };
      if (msg.op === "pong" || !msg.topic || !msg.data) return;
      const d = msg.data;
      if (!d.symbol || !d.lastPrice) return;
      const productId = SYMBOL_MAP[d.symbol];
      if (!productId) return;
      const price = parseFloat(d.lastPrice);
      if (isNaN(price) || price <= 0) return;
      const payload = JSON.stringify({
        source: "bybit",
        product_id: productId,
        price,
        open: d.prevPrice24h ? parseFloat(d.prevPrice24h) : price,
      });
      priceCache.set(productId, payload);
      broadcast(payload);
    } catch {}
  });

  socket.on("close", () => {
    logger.warn("Bybit WS closed — reconnecting");
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    scheduleReconnect();
  });

  socket.on("error", (err) => {
    logger.error({ err }, "Bybit WS error");
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
