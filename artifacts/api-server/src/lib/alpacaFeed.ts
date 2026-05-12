import https from "https";
import { logger } from "./logger.js";

export const STOCKS    = ["AAPL", "TSLA", "NVDA", "AMZN", "META", "MSFT", "SPY", "QQQ", "MU", "SNDK", "GLD", "SLV", "USO", "UNG"];
export const DATA_HOST  = "data.alpaca.markets";
export const PAPER_HOST = "paper-api.alpaca.markets";
const YAHOO_HOST        = "query1.finance.yahoo.com";

let alpacaKey    = "";
let alpacaSecret = "";
let pollTimer: ReturnType<typeof setInterval> | null = null;
let useYahoo     = false;   // set true after Alpaca 401

type StockQuote = { price: number; bid: number; ask: number; ts: string };
export const priceCache: Record<string, StockQuote> = {};

const stockClients = new Set<import("ws").WebSocket>();

export function addStockClient(ws: import("ws").WebSocket): void {
  stockClients.add(ws);
  ws.on("close", () => stockClients.delete(ws));
  ws.on("error", () => stockClients.delete(ws));
  for (const [sym, c] of Object.entries(priceCache)) {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: "stock_quote", symbol: sym, ...c }));
  }
}

export function broadcastStock(data: unknown): void {
  const msg = JSON.stringify(data);
  for (const ws of stockClients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

export function setAlpacaCredentials(key: string, secret: string): void {
  alpacaKey    = key.trim();
  alpacaSecret = secret.trim();
  useYahoo     = false;
  logger.info("Alpaca credentials set — starting stock feed");
  if (pollTimer) clearInterval(pollTimer);
  void pollOnce();
  pollTimer = setInterval(() => { void pollOnce(); }, 5000);
}

export function getAlpacaCredentials(): { key: string; secret: string } {
  return { key: alpacaKey, secret: alpacaSecret };
}

export function stopAlpacaFeed(): void {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

// ── Generic HTTPS GET ─────────────────────────────────────────────────────────
function httpsGet(hostname: string, path: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path, method: "GET", headers: { accept: "application/json", ...headers } },
      (res) => {
        let raw = "";
        res.on("data", (c: Buffer) => { raw += c.toString(); });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: raw }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

// ── Alpaca data (best-effort) ─────────────────────────────────────────────────
async function tryAlpacaQuotes(): Promise<boolean> {
  const syms = STOCKS.join(",");
  const { status, body } = await httpsGet(DATA_HOST, `/v2/stocks/quotes/latest?symbols=${syms}`, {
    "APCA-API-KEY-ID":     alpacaKey,
    "APCA-API-SECRET-KEY": alpacaSecret,
  });

  if (status !== 200) {
    let errMsg = `HTTP ${status}`;
    try { errMsg = (JSON.parse(body) as { message?: string }).message ?? errMsg; } catch {}
    logger.warn({ status, errMsg }, "Alpaca data 401 — switching to Yahoo Finance");
    broadcastStock({ type: "stock_warn", message: `Alpaca data API: ${errMsg} — switching to Yahoo Finance (free, 15-min delayed outside hours)` });
    useYahoo = true;
    return false;
  }

  const parsed = JSON.parse(body) as { quotes?: Record<string, { ap: number; bp: number; t: string }> };
  const quotes = parsed.quotes ?? {};
  for (const sym of STOCKS) {
    const q = quotes[sym];
    if (!q) continue;
    const price = (q.ap && q.bp) ? (q.ap + q.bp) / 2 : (q.ap || q.bp);
    if (!price) continue;
    priceCache[sym] = { price, bid: q.bp, ask: q.ap, ts: q.t };
    broadcastStock({ type: "stock_quote", symbol: sym, price, bid: q.bp, ask: q.ap, ts: q.t });
  }
  return true;
}

// ── Yahoo Finance fallback ────────────────────────────────────────────────────
async function fetchYahooQuote(sym: string): Promise<void> {
  const { status, body } = await httpsGet(
    YAHOO_HOST,
    `/v8/finance/chart/${sym}?interval=1m&range=1d&includePrePost=true`,
    {
      "User-Agent": "Mozilla/5.0 (compatible; stockbot/1.0)",
      "Accept-Language": "en-US,en;q=0.9",
    }
  );
  if (status !== 200) {
    logger.warn({ sym, status }, "Yahoo Finance fetch failed");
    return;
  }
  type YahooMeta = { regularMarketPrice?: number; bid?: number; ask?: number; regularMarketTime?: number };
  type YahooResult = { meta?: YahooMeta };
  type YahooResp   = { chart?: { result?: YahooResult[] } };
  const data = JSON.parse(body) as YahooResp;
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) return;

  const price = meta.regularMarketPrice;
  const bid   = meta.bid   ?? price * 0.9999;
  const ask   = meta.ask   ?? price * 1.0001;
  const ts    = new Date((meta.regularMarketTime ?? Date.now() / 1000) * 1000).toISOString();
  priceCache[sym] = { price, bid, ask, ts };
  broadcastStock({ type: "stock_quote", symbol: sym, price, bid, ask, ts });
}

async function pollYahoo(): Promise<void> {
  // Stagger requests slightly to avoid rate limiting
  for (const sym of STOCKS) {
    await fetchYahooQuote(sym);
    await new Promise(r => setTimeout(r, 150));
  }
}

// ── Main poll loop ────────────────────────────────────────────────────────────
async function pollOnce(): Promise<void> {
  if (!alpacaKey && !alpacaSecret && !useYahoo) return;
  try {
    if (!useYahoo && alpacaKey && alpacaSecret) {
      await tryAlpacaQuotes();
    }
    if (useYahoo) {
      await pollYahoo();
    }
  } catch (err) {
    logger.error({ err }, "Stock poll error");
    broadcastStock({ type: "stock_error", message: (err as Error).message });
  }
}
