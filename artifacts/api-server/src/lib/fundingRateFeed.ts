import { logger } from "./logger";
import { broadcast } from "./wsBroadcast";
import type WebSocket from "ws";

const OKX_SWAP_INSTRUMENTS = [
  "BTC-USDT-SWAP",
  "ETH-USDT-SWAP",
  "SOL-USDT-SWAP",
  "XRP-USDT-SWAP",
  "DOGE-USDT-SWAP",
  "AVAX-USDT-SWAP",
];

const SWAP_TO_PAIR: Record<string, string> = {
  "BTC-USDT-SWAP":  "BTC-USD",
  "ETH-USDT-SWAP":  "ETH-USD",
  "SOL-USDT-SWAP":  "SOL-USD",
  "XRP-USDT-SWAP":  "XRP-USD",
  "DOGE-USDT-SWAP": "DOGE-USD",
  "AVAX-USDT-SWAP": "AVAX-USD",
};

export interface FundingRateEntry {
  pair: string;
  rate: number;           // current funding rate (e.g. 0.0001 = 0.01%)
  nextRate: number | null;
  settleTime: number;     // unix ms — current period settlement
  nextSettleTime: number; // unix ms — next period settlement
  fetchedAt: number;
}

const rateCache = new Map<string, FundingRateEntry>();

let pollTimer: ReturnType<typeof setInterval> | null = null;
let started = false;

export function startFundingRateFeed() {
  if (started) return;
  started = true;
  fetchAllRates();
  pollTimer = setInterval(fetchAllRates, 15_000); // refresh every 15s for faster opportunity detection
}

export function stopFundingRateFeed() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

export function sendFundingRateSnapshot(ws: WebSocket) {
  if (rateCache.size === 0) return;
  const rates: Record<string, FundingRateEntry> = {};
  for (const [pair, entry] of rateCache) rates[pair] = entry;
  const payload = JSON.stringify({ source: "funding", rates });
  if ((ws as any).readyState === 1) ws.send(payload);
}

async function fetchAllRates() {
  const results: FundingRateEntry[] = [];

  for (const instId of OKX_SWAP_INSTRUMENTS) {
    try {
      const url = `https://www.okx.com/api/v5/public/funding-rate?instId=${instId}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) { logger.warn({ instId, status: res.status }, "funding rate fetch non-200"); continue; }
      const json = (await res.json()) as {
        code: string;
        data: Array<{
          instId: string;
          fundingRate: string;
          nextFundingRate: string;
          fundingTime: string;
          nextFundingTime: string;
        }>;
      };
      if (json.code !== "0" || !json.data?.length) continue;
      const d = json.data[0];
      const pair = SWAP_TO_PAIR[instId];
      if (!pair) continue;

      const entry: FundingRateEntry = {
        pair,
        rate:          parseFloat(d.fundingRate),
        nextRate:      d.nextFundingRate ? parseFloat(d.nextFundingRate) : null,
        settleTime:    parseInt(d.fundingTime),
        nextSettleTime: parseInt(d.nextFundingTime),
        fetchedAt:     Date.now(),
      };
      rateCache.set(pair, entry);
      results.push(entry);
    } catch (err) {
      logger.warn({ err, instId }, "funding rate fetch error");
    }
  }

  if (results.length > 0) {
    const rates: Record<string, FundingRateEntry> = {};
    for (const [pair, entry] of rateCache) rates[pair] = entry;
    broadcast(JSON.stringify({ source: "funding", rates }));
    logger.info({ count: results.length }, "Funding rates refreshed");
  }
}
