import { calcEMA, calcRSI, calcVolatility } from "./indicators.js";

export const PAIRS = ["BTC-USD", "ETH-USD", "XRP-USD", "DOGE-USD", "AVAX-USD"];
export const EXCHANGES = ["Coinbase", "Kraken", "OKX"];

const BASE_PRICES: Record<string, number> = {
  "BTC-USD": 67500,
  "ETH-USD": 3850,
  "XRP-USD": 0.52,
  "DOGE-USD": 0.165,
  "AVAX-USD": 38.5,
};

const SPREADS: Record<string, number> = {
  "BTC-USD": 0.0005,
  "ETH-USD": 0.001,
  "XRP-USD": 0.002,
  "DOGE-USD": 0.003,
  "AVAX-USD": 0.002,
};

const EXCHANGE_OFFSETS: Record<string, number> = {
  Coinbase: 0,
  Kraken: -0.0002,
  OKX: 0.0003,
};

const HISTORY_LENGTH = 100;
const TICK_MS = 1500;

type PricePoint = {
  pair: string;
  exchange: string;
  price: number;
  bid: number;
  ask: number;
  volume24h: number;
  change24h: number;
  timestamp: Date;
};

type PriceHistory = Record<string, Record<string, number[]>>;

const history: PriceHistory = {};
const currentPrices: Record<string, Record<string, PricePoint>> = {};
let volatilityBoost = false;

for (const pair of PAIRS) {
  history[pair] = {};
  currentPrices[pair] = {};
  for (const exchange of EXCHANGES) {
    history[pair][exchange] = [BASE_PRICES[pair]];
  }
}

function nextPrice(pair: string, exchange: string): number {
  const hist = history[pair][exchange];
  const last = hist[hist.length - 1];
  const base = BASE_PRICES[pair];
  const drift = (Math.random() - 0.499) * 0.002;
  const noise = (Math.random() - 0.5) * 0.001;
  const revert = (base - last) / base * 0.001;
  const boost = volatilityBoost ? (Math.random() - 0.5) * 0.015 : 0;
  const offset = EXCHANGE_OFFSETS[exchange];
  const newPrice = last * (1 + drift + noise + revert + boost + offset);
  return Math.max(newPrice, base * 0.5);
}

function tick() {
  const now = new Date();
  for (const pair of PAIRS) {
    const spread = SPREADS[pair];
    for (const exchange of EXCHANGES) {
      const price = nextPrice(pair, exchange);
      const hist = history[pair][exchange];
      hist.push(price);
      if (hist.length > HISTORY_LENGTH) hist.shift();

      const open24h = hist[0];
      const change24h = ((price - open24h) / open24h) * 100;
      const bid = price * (1 - spread);
      const ask = price * (1 + spread);
      const baseVol = BASE_PRICES[pair] * 1000;

      currentPrices[pair][exchange] = {
        pair,
        exchange,
        price,
        bid,
        ask,
        volume24h: baseVol * (0.8 + Math.random() * 0.4),
        change24h,
        timestamp: now,
      };
    }
  }

  // randomly toggle volatility boost
  if (Math.random() < 0.01) volatilityBoost = !volatilityBoost;
}

export function startSimulator() {
  setInterval(tick, TICK_MS);
  tick();
}

export function getAllPrices(): PricePoint[] {
  return PAIRS.flatMap((pair) =>
    EXCHANGES.map((exchange) => currentPrices[pair]?.[exchange]).filter(Boolean)
  );
}

export function getPriceHistory(pair: string, exchange: string): number[] {
  return history[pair]?.[exchange] ?? [];
}

export type { PricePoint };

export function getPairIndicators(pair: string, exchange: string) {
  const prices = getPriceHistory(pair, exchange);
  const current = currentPrices[pair]?.[exchange];
  if (!current || prices.length < 30) {
    return null;
  }
  const rsi = calcRSI(prices, 14);
  const ema9Arr = calcEMA(prices, 9);
  const ema21Arr = calcEMA(prices, 21);
  const ema9 = ema9Arr[ema9Arr.length - 1] ?? current.price;
  const ema21 = ema21Arr[ema21Arr.length - 1] ?? current.price;

  let emaCrossover: "bullish" | "bearish" | "neutral" = "neutral";
  if (ema9Arr.length >= 2 && ema21Arr.length >= 2) {
    const prevEma9 = ema9Arr[ema9Arr.length - 2];
    const prevEma21 = ema21Arr[ema21Arr.length - 2];
    if (prevEma9 < prevEma21 && ema9 > ema21) emaCrossover = "bullish";
    else if (prevEma9 > prevEma21 && ema9 < ema21) emaCrossover = "bearish";
  }

  const volatility5m = calcVolatility(prices, 5);
  const isHighVolatility = volatility5m >= 2;

  return {
    pair,
    exchange,
    rsi,
    ema9,
    ema21,
    emaCrossover,
    volatility5m,
    isHighVolatility,
    currentPrice: current.price,
    priceHistory: prices.slice(-30),
  };
}
