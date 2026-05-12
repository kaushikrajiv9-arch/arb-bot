export type BotConfig = {
  isRunning: boolean;
  strategies: {
    rsi: boolean;
    emaCrossover: boolean;
    scalping: boolean;
    volatility: boolean;
  };
  rsiOversold: number;
  rsiOverbought: number;
  ema9Period: number;
  ema21Period: number;
  scalpingMinPct: number;
  scalpingMaxPct: number;
  volatilityThreshold: number;
  volatilityWindow: number;
  stopLossPct: number;
  takeProfitPct: number;
  tradeSize: number;
  pairs: string[];
  exchanges: string[];
};

let config: BotConfig = {
  isRunning: true,
  strategies: {
    rsi: true,
    emaCrossover: true,
    scalping: true,
    volatility: true,
  },
  rsiOversold: 30,
  rsiOverbought: 70,
  ema9Period: 9,
  ema21Period: 21,
  scalpingMinPct: 0.1,
  scalpingMaxPct: 0.3,
  volatilityThreshold: 2,
  volatilityWindow: 5,
  stopLossPct: 1,
  takeProfitPct: 0.8,
  tradeSize: 1000,
  pairs: ["BTC-USD", "ETH-USD", "XRP-USD", "DOGE-USD", "AVAX-USD"],
  exchanges: ["Coinbase", "Kraken", "OKX"],
};

export function getConfig(): BotConfig {
  return { ...config };
}

export function updateConfig(partial: Partial<BotConfig>): BotConfig {
  config = { ...config, ...partial };
  if (partial.strategies) {
    config.strategies = { ...config.strategies, ...partial.strategies };
  }
  return getConfig();
}
