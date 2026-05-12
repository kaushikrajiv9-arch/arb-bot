export type Trade = {
  id: string;
  strategy: string;
  pair: string;
  exchange: string;
  action: "buy" | "sell";
  price: number;
  quantity: number;
  value: number;
  stopLoss: number;
  takeProfit: number;
  exitPrice: number | null;
  exitReason: "take_profit" | "stop_loss" | "signal" | null;
  pnl: number | null;
  pnlPct: number | null;
  status: "open" | "closed";
  openedAt: Date;
  closedAt: Date | null;
};

const trades: Trade[] = [];

export function addTrade(trade: Trade) {
  trades.unshift(trade);
  if (trades.length > 500) trades.splice(500);
}

export function getTrades(limit = 50, pair?: string): Trade[] {
  let result = pair ? trades.filter((t) => t.pair === pair) : trades;
  return result.slice(0, limit);
}

export function getOpenTrades(): Trade[] {
  return trades.filter((t) => t.status === "open");
}

export function closeTrade(
  id: string,
  exitPrice: number,
  exitReason: "take_profit" | "stop_loss" | "signal"
) {
  const trade = trades.find((t) => t.id === id);
  if (!trade || trade.status !== "open") return;
  trade.exitPrice = exitPrice;
  trade.exitReason = exitReason;
  trade.closedAt = new Date();
  trade.status = "closed";
  if (trade.action === "buy") {
    trade.pnl = (exitPrice - trade.price) * trade.quantity;
    trade.pnlPct = ((exitPrice - trade.price) / trade.price) * 100;
  } else {
    trade.pnl = (trade.price - exitPrice) * trade.quantity;
    trade.pnlPct = ((trade.price - exitPrice) / trade.price) * 100;
  }
}

export function getTradeStats() {
  const closed = trades.filter((t) => t.status === "closed");
  const open = trades.filter((t) => t.status === "open");
  const winners = closed.filter((t) => (t.pnl ?? 0) > 0);
  const losers = closed.filter((t) => (t.pnl ?? 0) <= 0);
  const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const totalValue = closed.reduce((sum, t) => sum + t.value, 0);

  const byStrategy = groupStats(closed, "strategy");
  const byPair = groupStats(closed, "pair");

  return {
    totalTrades: trades.length,
    openTrades: open.length,
    closedTrades: closed.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    winRate: closed.length ? (winners.length / closed.length) * 100 : 0,
    totalPnl,
    totalPnlPct: totalValue ? (totalPnl / totalValue) * 100 : 0,
    avgPnlPct:
      closed.length
        ? closed.reduce((sum, t) => sum + (t.pnlPct ?? 0), 0) / closed.length
        : 0,
    byStrategy,
    byPair,
  };
}

function groupStats(trades: Trade[], key: "strategy" | "pair") {
  const map = new Map<string, Trade[]>();
  for (const t of trades) {
    const k = t[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(t);
  }
  return Array.from(map.entries()).map(([k, group]) => {
    const winners = group.filter((t) => (t.pnl ?? 0) > 0);
    return {
      [key]: k,
      trades: group.length,
      winRate: (winners.length / group.length) * 100,
      totalPnl: group.reduce((sum, t) => sum + (t.pnl ?? 0), 0),
    };
  });
}
