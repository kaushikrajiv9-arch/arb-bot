import { v4 as uuidv4 } from "uuid";
import { blackScholes, getExpiryYears, getExpiryLabel } from "./blackScholes.js";
import { getAllPrices, getPairIndicators, PAIRS } from "./priceSimulator.js";
import { BotConfig } from "./botConfig.js";

const RISK_FREE_RATE = 0.053; // ~5.3% fed funds rate

const BASE_IV: Record<string, number> = {
  "BTC-USD": 0.75,
  "ETH-USD": 0.85,
  "XRP-USD": 1.1,
  "DOGE-USD": 1.3,
  "AVAX-USD": 1.0,
};

export type OptionsContract = {
  id: string;
  pair: string;
  type: "call" | "put";
  strike: number;
  expiry: string;
  expiryLabel: string;
  spotPrice: number;
  price: number;
  bid: number;
  ask: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  openInterest: number;
  volume: number;
  inTheMoney: boolean;
};

export type OptionsChain = {
  pair: string;
  spotPrice: number;
  expiry: string;
  expiryLabel: string;
  calls: OptionsContract[];
  puts: OptionsContract[];
  updatedAt: Date;
};

export type OptionsSignal = {
  id: string;
  strategy: "0dte_momentum" | "swing_call" | "swing_put" | "iv_crush" | "gamma_scalp";
  pair: string;
  type: "call" | "put";
  action: "buy" | "sell";
  strike: number;
  expiry: string;
  expiryLabel: string;
  contractPrice: number;
  spotPrice: number;
  delta: number;
  theta: number;
  iv: number;
  strength: number;
  reason: string;
  stopLoss: number;
  takeProfit: number;
  timestamp: Date;
  executed: boolean;
};

export type OptionsPosition = {
  id: string;
  strategy: string;
  pair: string;
  type: "call" | "put";
  action: "buy" | "sell";
  strike: number;
  expiry: string;
  expiryLabel: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  spotAtEntry: number;
  currentSpot: number;
  delta: number;
  theta: number;
  iv: number;
  pnl: number;
  pnlPct: number;
  stopLoss: number;
  takeProfit: number;
  status: "open" | "closed";
  exitPrice: number | null;
  exitReason: "take_profit" | "stop_loss" | "expired" | null;
  openedAt: Date;
  closedAt: Date | null;
};

export type OptionsStats = {
  totalPositions: number;
  openPositions: number;
  closedPositions: number;
  winningPositions: number;
  winRate: number;
  totalPnl: number;
  avgDelta: number;
  byStrategy: { strategy: string; positions: number; winRate: number; totalPnl: number }[];
};

const optionsPositions: OptionsPosition[] = [];
let lastOptionsSignals: OptionsSignal[] = [];

function getStrikes(spotPrice: number, count = 7): number[] {
  const tickSize = spotPrice > 10000 ? 500 : spotPrice > 1000 ? 50 : spotPrice > 1 ? 0.02 : 0.001;
  const atm = Math.round(spotPrice / tickSize) * tickSize;
  const strikes: number[] = [];
  for (let i = -Math.floor(count / 2); i <= Math.floor(count / 2); i++) {
    strikes.push(parseFloat((atm + i * tickSize).toFixed(6)));
  }
  return strikes;
}

function getIV(pair: string, strike: number, spot: number, type: "call" | "put", expiry: string): number {
  const base = BASE_IV[pair] ?? 0.8;
  const moneyness = Math.log(strike / spot);
  const skew = type === "put" ? 0.05 : -0.02;
  const smile = 0.2 * moneyness * moneyness;
  const termAdj = expiry === "0dte" ? 0.15 : expiry === "1w" ? 0.05 : 0;
  return Math.max(0.2, base + skew + smile + termAdj + (Math.random() - 0.5) * 0.03);
}

export function buildOptionsChain(pair: string, expiry = "0dte"): OptionsChain {
  const prices = getAllPrices().filter(p => p.pair === pair && p.exchange === "Coinbase");
  const spot = prices[0]?.price ?? 0;
  if (!spot) return { pair, spotPrice: 0, expiry, expiryLabel: getExpiryLabel(expiry), calls: [], puts: [], updatedAt: new Date() };

  const T = getExpiryYears(expiry);
  const strikes = getStrikes(spot);

  const makeContract = (strike: number, type: "call" | "put"): OptionsContract => {
    const iv = getIV(pair, strike, spot, type, expiry);
    const { price, greeks } = blackScholes(spot, strike, T, RISK_FREE_RATE, iv, type);
    const spread = price * 0.03;
    const inTheMoney = type === "call" ? spot > strike : spot < strike;
    return {
      id: `${pair}-${type}-${strike}-${expiry}`,
      pair,
      type,
      strike,
      expiry,
      expiryLabel: getExpiryLabel(expiry),
      spotPrice: spot,
      price: parseFloat(price.toFixed(4)),
      bid: parseFloat(Math.max(price - spread, 0.0001).toFixed(4)),
      ask: parseFloat((price + spread).toFixed(4)),
      iv: parseFloat((iv * 100).toFixed(1)),
      delta: parseFloat(greeks.delta.toFixed(4)),
      gamma: parseFloat(greeks.gamma.toFixed(6)),
      theta: parseFloat(greeks.theta.toFixed(4)),
      vega: parseFloat(greeks.vega.toFixed(4)),
      rho: parseFloat(greeks.rho.toFixed(4)),
      openInterest: Math.floor(Math.random() * 5000 + 100),
      volume: Math.floor(Math.random() * 2000 + 10),
      inTheMoney,
    };
  };

  return {
    pair,
    spotPrice: spot,
    expiry,
    expiryLabel: getExpiryLabel(expiry),
    calls: strikes.map(s => makeContract(s, "call")),
    puts: strikes.map(s => makeContract(s, "put")),
    updatedAt: new Date(),
  };
}

function generate0DTESignals(config: BotConfig): OptionsSignal[] {
  const signals: OptionsSignal[] = [];
  for (const pair of PAIRS) {
    const ind = getPairIndicators(pair, "Coinbase");
    if (!ind || Math.random() > 0.3) continue;

    const chain = buildOptionsChain(pair, "0dte");
    if (!chain.spotPrice) continue;

    const isBreakout = ind.volatility5m > 1.5;
    const isBullish = ind.emaCrossover === "bullish" || ind.rsi < 35;
    const isBearish = ind.emaCrossover === "bearish" || ind.rsi > 65;

    if (!isBreakout && !isBullish && !isBearish) continue;

    const type: "call" | "put" = isBullish ? "call" : "put";
    const contracts = type === "call" ? chain.calls : chain.puts;
    // Target ~0.30 delta OTM contract for 0DTE
    const target = contracts.find(c => Math.abs(c.delta) >= 0.25 && Math.abs(c.delta) <= 0.40 && !c.inTheMoney);
    if (!target) continue;

    const tp = target.price * 2.5;
    const sl = target.price * 0.5;

    signals.push({
      id: uuidv4(),
      strategy: "0dte_momentum",
      pair,
      type,
      action: "buy",
      strike: target.strike,
      expiry: "0dte",
      expiryLabel: "0DTE",
      contractPrice: target.price,
      spotPrice: chain.spotPrice,
      delta: target.delta,
      theta: target.theta,
      iv: target.iv,
      strength: Math.min(ind.volatility5m / 3, 1),
      reason: `0DTE ${type.toUpperCase()} — ${isBreakout ? `${ind.volatility5m.toFixed(2)}% breakout` : isBullish ? `RSI ${ind.rsi.toFixed(1)} oversold + bullish EMA` : `RSI ${ind.rsi.toFixed(1)} overbought + bearish EMA`}. Delta: ${target.delta.toFixed(2)}, IV: ${target.iv}%`,
      stopLoss: sl,
      takeProfit: tp,
      timestamp: new Date(),
      executed: false,
    });
  }
  return signals;
}

function generateSwingSignals(config: BotConfig): OptionsSignal[] {
  const signals: OptionsSignal[] = [];
  for (const pair of PAIRS) {
    const ind = getPairIndicators(pair, "Coinbase");
    if (!ind || Math.random() > 0.15) continue;

    const expiry = Math.random() > 0.5 ? "1w" : "2w";
    const chain = buildOptionsChain(pair, expiry);
    if (!chain.spotPrice) continue;

    const isBullish = ind.emaCrossover === "bullish" && ind.rsi < 55;
    const isBearish = ind.emaCrossover === "bearish" && ind.rsi > 45;
    if (!isBullish && !isBearish) continue;

    const type: "call" | "put" = isBullish ? "call" : "put";
    const contracts = type === "call" ? chain.calls : chain.puts;
    // Target ~0.40 delta for swing — closer to ATM
    const target = contracts.find(c => Math.abs(c.delta) >= 0.35 && Math.abs(c.delta) <= 0.55);
    if (!target) continue;

    const tp = target.price * 2.0;
    const sl = target.price * 0.4;

    signals.push({
      id: uuidv4(),
      strategy: isBullish ? "swing_call" : "swing_put",
      pair,
      type,
      action: "buy",
      strike: target.strike,
      expiry,
      expiryLabel: getExpiryLabel(expiry),
      contractPrice: target.price,
      spotPrice: chain.spotPrice,
      delta: target.delta,
      theta: target.theta,
      iv: target.iv,
      strength: 0.7,
      reason: `Swing ${type.toUpperCase()} (${getExpiryLabel(expiry)}) — EMA ${ind.emaCrossover} crossover. Target: $${target.strike}, Delta: ${target.delta.toFixed(2)}, IV: ${target.iv}%`,
      stopLoss: sl,
      takeProfit: tp,
      timestamp: new Date(),
      executed: false,
    });
  }
  return signals;
}

function generateGammaScalpSignals(config: BotConfig): OptionsSignal[] {
  const signals: OptionsSignal[] = [];
  for (const pair of PAIRS) {
    const ind = getPairIndicators(pair, "Coinbase");
    if (!ind || !ind.isHighVolatility || Math.random() > 0.2) continue;

    const chain = buildOptionsChain(pair, "0dte");
    if (!chain.spotPrice) continue;

    // ATM options have highest gamma
    const atmCall = chain.calls.reduce((best, c) => Math.abs(c.delta - 0.5) < Math.abs(best.delta - 0.5) ? c : best, chain.calls[0]);
    if (!atmCall) continue;

    signals.push({
      id: uuidv4(),
      strategy: "gamma_scalp",
      pair,
      type: "call",
      action: "buy",
      strike: atmCall.strike,
      expiry: "0dte",
      expiryLabel: "0DTE",
      contractPrice: atmCall.price,
      spotPrice: chain.spotPrice,
      delta: atmCall.delta,
      theta: atmCall.theta,
      iv: atmCall.iv,
      strength: Math.min(ind.volatility5m / 4, 1),
      reason: `Gamma scalp ATM — high vol ${ind.volatility5m.toFixed(2)}%. Gamma: ${atmCall.gamma.toFixed(5)}, Theta: ${atmCall.theta.toFixed(4)}/day`,
      stopLoss: atmCall.price * 0.6,
      takeProfit: atmCall.price * 1.8,
      timestamp: new Date(),
      executed: false,
    });
  }
  return signals;
}

function closeExpiredAndHitPositions() {
  const now = Date.now();
  for (const pos of optionsPositions) {
    if (pos.status !== "open") continue;
    const chain = buildOptionsChain(pos.pair, pos.expiry);
    const contracts = pos.type === "call" ? chain.calls : chain.puts;
    const current = contracts.find(c => Math.abs(c.strike - pos.strike) < 0.001);
    if (!current) continue;

    pos.currentPrice = current.price;
    pos.currentSpot = chain.spotPrice;
    pos.delta = current.delta;
    pos.theta = current.theta;
    pos.iv = current.iv;

    const pnl = (current.price - pos.entryPrice) * pos.quantity * 100; // 1 contract = 100 units
    pos.pnl = pnl;
    pos.pnlPct = ((current.price - pos.entryPrice) / pos.entryPrice) * 100;

    if (pos.expiry === "0dte" && (now - pos.openedAt.getTime()) > 8 * 60 * 60 * 1000) {
      pos.status = "closed";
      pos.exitPrice = current.price;
      pos.exitReason = "expired";
      pos.closedAt = new Date();
    } else if (current.price >= pos.takeProfit) {
      pos.status = "closed";
      pos.exitPrice = current.price;
      pos.exitReason = "take_profit";
      pos.closedAt = new Date();
    } else if (current.price <= pos.stopLoss) {
      pos.status = "closed";
      pos.exitPrice = current.price;
      pos.exitReason = "stop_loss";
      pos.closedAt = new Date();
    }
  }
}

function executeOptionsSignal(signal: OptionsSignal, config: BotConfig) {
  const pos: OptionsPosition = {
    id: uuidv4(),
    strategy: signal.strategy,
    pair: signal.pair,
    type: signal.type,
    action: signal.action,
    strike: signal.strike,
    expiry: signal.expiry,
    expiryLabel: signal.expiryLabel,
    quantity: Math.floor(config.tradeSize / (signal.contractPrice * 100)) || 1,
    entryPrice: signal.contractPrice,
    currentPrice: signal.contractPrice,
    spotAtEntry: signal.spotPrice,
    currentSpot: signal.spotPrice,
    delta: signal.delta,
    theta: signal.theta,
    iv: signal.iv,
    pnl: 0,
    pnlPct: 0,
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
    status: "open",
    exitPrice: null,
    exitReason: null,
    openedAt: new Date(),
    closedAt: null,
  };
  optionsPositions.unshift(pos);
  if (optionsPositions.length > 200) optionsPositions.splice(200);
}

export function runOptionsStrategyCycle(config: BotConfig): OptionsSignal[] {
  if (!config.isRunning) return lastOptionsSignals;

  closeExpiredAndHitPositions();

  const newSignals: OptionsSignal[] = [
    ...generate0DTESignals(config),
    ...generateSwingSignals(config),
    ...generateGammaScalpSignals(config),
  ];

  for (const signal of newSignals) {
    executeOptionsSignal(signal, config);
    signal.executed = true;
  }

  lastOptionsSignals = [...newSignals, ...lastOptionsSignals].slice(0, 100);
  return lastOptionsSignals;
}

export function getLastOptionsSignals(): OptionsSignal[] {
  return lastOptionsSignals;
}

export function getOptionsPositions(): { positions: OptionsPosition[]; stats: OptionsStats } {
  const closed = optionsPositions.filter(p => p.status === "closed");
  const open = optionsPositions.filter(p => p.status === "open");
  const winners = closed.filter(p => p.pnl > 0);

  const byStrategy = new Map<string, OptionsPosition[]>();
  for (const p of closed) {
    if (!byStrategy.has(p.strategy)) byStrategy.set(p.strategy, []);
    byStrategy.get(p.strategy)!.push(p);
  }

  return {
    positions: optionsPositions.slice(0, 100),
    stats: {
      totalPositions: optionsPositions.length,
      openPositions: open.length,
      closedPositions: closed.length,
      winningPositions: winners.length,
      winRate: closed.length ? (winners.length / closed.length) * 100 : 0,
      totalPnl: closed.reduce((s, p) => s + p.pnl, 0),
      avgDelta: open.length ? open.reduce((s, p) => s + Math.abs(p.delta), 0) / open.length : 0,
      byStrategy: Array.from(byStrategy.entries()).map(([strategy, ps]) => ({
        strategy,
        positions: ps.length,
        winRate: (ps.filter(p => p.pnl > 0).length / ps.length) * 100,
        totalPnl: ps.reduce((s, p) => s + p.pnl, 0),
      })),
    },
  };
}
