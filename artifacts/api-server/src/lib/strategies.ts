import { v4 as uuidv4 } from "uuid";
import { getPairIndicators, PAIRS, EXCHANGES } from "./priceSimulator.js";
import { BotConfig } from "./botConfig.js";
import { Trade, addTrade, getOpenTrades, closeTrade } from "./tradeStore.js";

export type Signal = {
  id: string;
  strategy: "rsi" | "ema_crossover" | "scalping" | "arbitrage" | "volatility";
  pair: string;
  exchange: string;
  action: "buy" | "sell" | "hold";
  strength: number;
  price: number;
  stopLoss: number;
  takeProfit: number;
  reason: string;
  timestamp: Date;
  executed: boolean;
};

let lastSignals: Signal[] = [];

function makeSignal(
  strategy: Signal["strategy"],
  pair: string,
  exchange: string,
  action: "buy" | "sell" | "hold",
  strength: number,
  price: number,
  reason: string,
  config: BotConfig
): Signal {
  const stopLoss =
    action === "buy"
      ? price * (1 - config.stopLossPct / 100)
      : price * (1 + config.stopLossPct / 100);
  const takeProfit =
    action === "buy"
      ? price * (1 + config.takeProfitPct / 100)
      : price * (1 - config.takeProfitPct / 100);
  return {
    id: uuidv4(),
    strategy,
    pair,
    exchange,
    action,
    strength,
    price,
    stopLoss,
    takeProfit,
    reason,
    timestamp: new Date(),
    executed: false,
  };
}

function rsiStrategy(config: BotConfig): Signal[] {
  if (!config.strategies.rsi) return [];
  const signals: Signal[] = [];
  for (const pair of PAIRS) {
    for (const exchange of EXCHANGES) {
      const ind = getPairIndicators(pair, exchange);
      if (!ind) continue;
      const freq = ind.isHighVolatility ? 1 : 0.4;
      if (Math.random() > freq) continue;
      if (ind.rsi < config.rsiOversold) {
        signals.push(
          makeSignal(
            "rsi",
            pair,
            exchange,
            "buy",
            (config.rsiOversold - ind.rsi) / config.rsiOversold,
            ind.currentPrice,
            `RSI oversold at ${ind.rsi.toFixed(1)} (threshold: ${config.rsiOversold})`,
            config
          )
        );
      } else if (ind.rsi > config.rsiOverbought) {
        signals.push(
          makeSignal(
            "rsi",
            pair,
            exchange,
            "sell",
            (ind.rsi - config.rsiOverbought) / (100 - config.rsiOverbought),
            ind.currentPrice,
            `RSI overbought at ${ind.rsi.toFixed(1)} (threshold: ${config.rsiOverbought})`,
            config
          )
        );
      }
    }
  }
  return signals;
}

function emaCrossoverStrategy(config: BotConfig): Signal[] {
  if (!config.strategies.emaCrossover) return [];
  const signals: Signal[] = [];
  for (const pair of PAIRS) {
    for (const exchange of EXCHANGES) {
      const ind = getPairIndicators(pair, exchange);
      if (!ind) continue;
      if (ind.emaCrossover === "bullish") {
        signals.push(
          makeSignal(
            "ema_crossover",
            pair,
            exchange,
            "buy",
            0.75,
            ind.currentPrice,
            `EMA9 (${ind.ema9.toFixed(4)}) crossed above EMA21 (${ind.ema21.toFixed(4)}) — bullish crossover`,
            config
          )
        );
      } else if (ind.emaCrossover === "bearish") {
        signals.push(
          makeSignal(
            "ema_crossover",
            pair,
            exchange,
            "sell",
            0.75,
            ind.currentPrice,
            `EMA9 (${ind.ema9.toFixed(4)}) crossed below EMA21 (${ind.ema21.toFixed(4)}) — bearish crossover`,
            config
          )
        );
      }
    }
  }
  return signals;
}

function scalpingStrategy(config: BotConfig): Signal[] {
  if (!config.strategies.scalping) return [];
  const signals: Signal[] = [];
  for (const pair of PAIRS) {
    for (const exchange of EXCHANGES) {
      const ind = getPairIndicators(pair, exchange);
      if (!ind) continue;
      const hist = ind.priceHistory;
      if (hist.length < 5) continue;
      const recent = hist.slice(-5);
      const movePct = Math.abs((recent[recent.length - 1] - recent[0]) / recent[0]) * 100;
      const freq = ind.isHighVolatility ? 0.7 : 0.25;
      if (Math.random() > freq) continue;
      if (movePct >= config.scalpingMinPct && movePct <= config.scalpingMaxPct) {
        const trending = recent[recent.length - 1] > recent[0];
        signals.push(
          makeSignal(
            "scalping",
            pair,
            exchange,
            trending ? "buy" : "sell",
            movePct / config.scalpingMaxPct,
            ind.currentPrice,
            `Scalp: ${movePct.toFixed(3)}% move detected in last 5 ticks`,
            config
          )
        );
      }
    }
  }
  return signals;
}

function volatilityStrategy(config: BotConfig): Signal[] {
  const signals: Signal[] = [];
  for (const pair of PAIRS) {
    for (const exchange of EXCHANGES) {
      const ind = getPairIndicators(pair, exchange);
      if (!ind) continue;
      if (!ind.isHighVolatility) continue;
      // Volatility detector — ride momentum direction
      const hist = ind.priceHistory;
      if (hist.length < 10) continue;
      const recentMove = hist[hist.length - 1] - hist[hist.length - 10];
      const action = recentMove > 0 ? "buy" : "sell";
      const freq = 0.6;
      if (Math.random() > freq) continue;
      signals.push(
        makeSignal(
          "volatility",
          pair,
          exchange,
          action,
          Math.min(ind.volatility5m / 5, 1),
          ind.currentPrice,
          `High volatility: ${ind.volatility5m.toFixed(2)}% move in 5m — riding momentum`,
          config
        )
      );
    }
  }
  return signals;
}

function checkOpenTrades(config: BotConfig) {
  const open = getOpenTrades();
  for (const trade of open) {
    const ind = getPairIndicators(trade.pair, trade.exchange);
    if (!ind) continue;
    const price = ind.currentPrice;
    if (trade.action === "buy") {
      if (price <= trade.stopLoss) {
        closeTrade(trade.id, price, "stop_loss");
      } else if (price >= trade.takeProfit) {
        closeTrade(trade.id, price, "take_profit");
      }
    } else {
      if (price >= trade.stopLoss) {
        closeTrade(trade.id, price, "stop_loss");
      } else if (price <= trade.takeProfit) {
        closeTrade(trade.id, price, "take_profit");
      }
    }
  }
}

function executeSignal(signal: Signal & { action: "buy" | "sell" }, config: BotConfig): Trade {
  const trade: Trade = {
    id: uuidv4(),
    strategy: signal.strategy,
    pair: signal.pair,
    exchange: signal.exchange,
    action: signal.action,
    price: signal.price,
    quantity: config.tradeSize / signal.price,
    value: config.tradeSize,
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
    exitPrice: null,
    exitReason: null,
    pnl: null,
    pnlPct: null,
    status: "open",
    openedAt: new Date(),
    closedAt: null,
  };
  addTrade(trade);
  return trade;
}

export function runStrategyCycle(config: BotConfig): Signal[] {
  if (!config.isRunning) return lastSignals;

  checkOpenTrades(config);

  const newSignals: Signal[] = [
    ...rsiStrategy(config),
    ...emaCrossoverStrategy(config),
    ...scalpingStrategy(config),
    ...volatilityStrategy(config),
  ];

  for (const signal of newSignals) {
    if (signal.action === "buy" || signal.action === "sell") {
      executeSignal(signal as Signal & { action: "buy" | "sell" }, config);
      signal.executed = true;
    }
  }

  lastSignals = [...newSignals, ...lastSignals].slice(0, 100);
  return lastSignals;
}

export function getLastSignals(): Signal[] {
  return lastSignals;
}
