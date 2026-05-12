import { logger } from "./logger";

// US symbols shown in AlphaWire (removes SNDK — delisted; replaces with AMZN,JPM,etc.)
export const US_SYMBOLS = [
  "AAPL", "TSLA", "NVDA", "AMZN", "META",
  "MSFT", "SPY",  "QQQ",  "MU",   "GLD",
  "SLV",  "USO",  "JPM",  "UNG",
];

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://finance.yahoo.com/",
};

let pollTimer: ReturnType<typeof setInterval> | null = null;
let started = false;
let broadcastFn: ((data: unknown) => void) | null = null;

export interface UsStockQuote {
  sym: string;
  price: number;
  open: number;
  prevClose: number;
  change: number;
  changePct: number;
  currency: string;
  exchange: "US";
  fetchedAt: number;
}

const quoteCache = new Map<string, UsStockQuote>();

export function startUsStockFeed(broadcast: (data: unknown) => void) {
  if (started) return;
  started = true;
  broadcastFn = broadcast;
  fetchAll();
  pollTimer = setInterval(fetchAll, 30_000); // 30s — delayed/daily prices are fine as fallback
}

export function stopUsStockFeed() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

export function sendUsStockSnapshot(sendFn: (data: string) => void) {
  for (const q of quoteCache.values()) {
    sendFn(JSON.stringify({ type: "stock_quote", ...q }));
  }
}

async function fetchOne(sym: string): Promise<void> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      headers: BROWSER_HEADERS,
    });
    if (!res.ok) {
      logger.warn({ sym, status: res.status }, "US stock chart fetch non-200");
      return;
    }

    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: {
            currency?: string;
            symbol?: string;
            regularMarketPrice?: number;
            previousClose?: number;
            chartPreviousClose?: number;
            regularMarketOpen?: number;
          };
        }>;
      };
    };

    const meta = json.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return;

    const price     = meta.regularMarketPrice;
    const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
    const open      = meta.regularMarketOpen ?? price;
    const change    = price - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

    const q: UsStockQuote = {
      sym,
      price,
      open,
      prevClose,
      change,
      changePct,
      currency:  meta.currency ?? "USD",
      exchange:  "US",
      fetchedAt: Date.now(),
    };

    quoteCache.set(sym, q);
    broadcastFn?.({ type: "stock_quote", ...q });
  } catch (err) {
    logger.warn({ sym, err }, "US stock chart fetch error");
  }
}

async function fetchAll() {
  await Promise.allSettled(US_SYMBOLS.map(sym => fetchOne(sym)));
}
