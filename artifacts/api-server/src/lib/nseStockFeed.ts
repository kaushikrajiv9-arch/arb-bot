import { logger } from "./logger";

// Full Nifty 50 constituents — Yahoo Finance chart endpoint uses these as path params
export const NSE_SYMBOLS = [
  "RELIANCE.NS",  "TCS.NS",        "HDFCBANK.NS",   "BHARTIARTL.NS",
  "ICICIBANK.NS", "INFY.NS",       "SBIN.NS",        "HINDUNILVR.NS",
  "ITC.NS",       "LT.NS",         "KOTAKBANK.NS",   "AXISBANK.NS",
  "BAJFINANCE.NS","ASIANPAINT.NS", "MARUTI.NS",      "TITAN.NS",
  "ULTRACEMCO.NS","NTPC.NS",       "POWERGRID.NS",   "SUNPHARMA.NS",
  "BAJAJFINSV.NS","HCLTECH.NS",    "TATACONSUM.NS",  "INDUSINDBK.NS",
  "WIPRO.NS",     "ONGC.NS",       "ADANIENT.NS",    "ADANIPORTS.NS",
  "JSWSTEEL.NS",  "TATASTEEL.NS",  "HINDALCO.NS",    "M%26M.NS",
  "NESTLEIND.NS", "CIPLA.NS",      "DRREDDY.NS",     "DIVISLAB.NS",
  "APOLLOHOSP.NS","EICHERMOT.NS",  "TECHM.NS",       "GRASIM.NS",
  "BPCL.NS",      "COALINDIA.NS",  "HEROMOTOCO.NS",  "BRITANNIA.NS",
  "SHRIRAMFIN.NS","TRENT.NS",      "BEL.NS",         "BAJAJ-AUTO.NS",
  "SBILIFE.NS",   "HDFCLIFE.NS",
];

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://finance.yahoo.com/",
};

export function nseDisplaySym(s: string): string {
  return s
    .replace(/^M%26M/, "MM")
    .replace(".NS", "")
    .replace("-", "-"); // keep BAJAJ-AUTO as-is
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let started = false;
let broadcastFn: ((data: unknown) => void) | null = null;

export interface NseQuote {
  sym: string;
  fullSym: string;
  price: number;
  open: number;
  prevClose: number;
  change: number;
  changePct: number;
  currency: string;
  exchange: "NSE";
  fetchedAt: number;
}

const quoteCache = new Map<string, NseQuote>();

export function startNseFeed(broadcast: (data: unknown) => void) {
  if (started) return;
  started = true;
  broadcastFn = broadcast;
  fetchAll();
  pollTimer = setInterval(fetchAll, 10_000); // 10s — chart endpoint is per-symbol
}

export function stopNseFeed() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

export function sendNseSnapshot(sendFn: (data: string) => void) {
  for (const q of quoteCache.values()) {
    sendFn(JSON.stringify({ type: "stock_quote", ...q }));
  }
}

// Yahoo Finance chart endpoint — works without crumb/cookie, one symbol per call
async function fetchOne(rawSym: string): Promise<void> {
  const encodedSym = rawSym; // e.g. "M%26M.NS" — kept as-is in URL path
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSym}?interval=1d&range=1d`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      headers: BROWSER_HEADERS,
    });
    if (!res.ok) {
      logger.warn({ sym: rawSym, status: res.status }, "NSE chart fetch non-200");
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

    const q: NseQuote = {
      sym:      nseDisplaySym(rawSym),
      fullSym:  rawSym,
      price,
      open,
      prevClose,
      change,
      changePct,
      currency:  meta.currency ?? "INR",
      exchange:  "NSE",
      fetchedAt: Date.now(),
    };

    quoteCache.set(rawSym, q);
    broadcastFn?.({ type: "stock_quote", ...q });
  } catch (err) {
    logger.warn({ sym: rawSym, err }, "NSE chart fetch error");
  }
}

async function fetchAll() {
  // Fire all 50 requests concurrently; failures are isolated per symbol
  await Promise.allSettled(NSE_SYMBOLS.map(sym => fetchOne(sym)));
}
