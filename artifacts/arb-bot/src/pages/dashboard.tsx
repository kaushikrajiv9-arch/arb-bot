import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  useGetMarketPrices, 
  getGetMarketPricesQueryKey,
  useGetStrategySignals,
  getGetStrategySignalsQueryKey,
  useGetIndicators,
  getGetIndicatorsQueryKey,
  useGetTrades,
  getGetTradesQueryKey,
  useGetTradeStats,
  getGetTradeStatsQueryKey,
  useGetConfig,
  getGetConfigQueryKey,
  useUpdateConfig
} from "@workspace/api-client-react";

export function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch all required data with refetch intervals
  const { data: marketData } = useGetMarketPrices({ 
    query: { refetchInterval: 2000, queryKey: getGetMarketPricesQueryKey() } 
  });
  
  const { data: signalsData } = useGetStrategySignals({ 
    query: { refetchInterval: 2000, queryKey: getGetStrategySignalsQueryKey() } 
  });

  const { data: indicatorsData } = useGetIndicators({ 
    query: { refetchInterval: 2000, queryKey: getGetIndicatorsQueryKey() } 
  });

  const { data: tradesData } = useGetTrades({ limit: 50 }, { 
    query: { refetchInterval: 2000, queryKey: getGetTradesQueryKey({ limit: 50 }) } 
  });

  const { data: tradeStats } = useGetTradeStats({ 
    query: { refetchInterval: 5000, queryKey: getGetTradeStatsQueryKey() } 
  });

  const { data: config } = useGetConfig({ 
    query: { queryKey: getGetConfigQueryKey() } 
  });

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground w-full p-4 overflow-hidden">
      <header className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
            A
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">ARB_TERMINAL</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted-foreground uppercase tracking-widest">STATUS</span>
            <span className="text-sm font-bold text-primary flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              ONLINE
            </span>
          </div>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid grid-cols-6 mb-4 bg-muted/50 p-1 border border-border">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold tracking-widest text-xs uppercase" data-testid="tab-overview">OVERVIEW</TabsTrigger>
          <TabsTrigger value="signals" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold tracking-widest text-xs uppercase" data-testid="tab-signals">SIGNALS</TabsTrigger>
          <TabsTrigger value="indicators" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold tracking-widest text-xs uppercase" data-testid="tab-indicators">INDICATORS</TabsTrigger>
          <TabsTrigger value="trades" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold tracking-widest text-xs uppercase" data-testid="tab-trades">TRADE LOG</TabsTrigger>
          <TabsTrigger value="stats" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold tracking-widest text-xs uppercase" data-testid="tab-stats">ANALYTICS</TabsTrigger>
          <TabsTrigger value="config" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold tracking-widest text-xs uppercase" data-testid="tab-config">CONFIG</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto">
          <TabsContent value="overview" className="h-full m-0 data-[state=inactive]:hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
              {/* Add overview content here */}
              <div className="md:col-span-2 border border-border bg-card p-4 rounded flex flex-col gap-4">
                 <h2 className="text-primary uppercase text-sm font-bold tracking-widest border-b border-border pb-2">Market Overview</h2>
                 {marketData?.prices ? (
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                     {marketData.prices.map((p) => (
                       <div key={`${p.exchange}-${p.pair}`} className="p-3 border border-border bg-background rounded">
                         <div className="flex justify-between items-center mb-1">
                           <span className="text-xs text-muted-foreground">{p.exchange}</span>
                           <span className="text-xs font-bold">{p.pair}</span>
                         </div>
                         <div className={`text-lg font-bold ${p.change24h >= 0 ? 'text-primary' : 'text-destructive'}`}>
                           ${p.price.toFixed(2)}
                         </div>
                         <div className="flex justify-between mt-2 text-[10px]">
                           <span className="text-muted-foreground">Vol: {p.volume24h.toFixed(1)}</span>
                           <span className={p.change24h >= 0 ? 'text-primary' : 'text-destructive'}>
                             {p.change24h >= 0 ? '+' : ''}{(p.change24h * 100).toFixed(2)}%
                           </span>
                         </div>
                       </div>
                     ))}
                   </div>
                 ) : (
                   <div className="text-sm text-muted-foreground">Loading market data...</div>
                 )}
              </div>
              <div className="border border-border bg-card p-4 rounded flex flex-col gap-4">
                <h2 className="text-secondary uppercase text-sm font-bold tracking-widest border-b border-border pb-2">Bot Status</h2>
                {tradeStats ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between border-b border-border/50 pb-2">
                      <span className="text-xs text-muted-foreground">Total PnL</span>
                      <span className={`text-sm font-bold ${tradeStats.totalPnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        ${tradeStats.totalPnl.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/50 pb-2">
                      <span className="text-xs text-muted-foreground">Win Rate</span>
                      <span className="text-sm font-bold text-foreground">
                        {(tradeStats.winRate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/50 pb-2">
                      <span className="text-xs text-muted-foreground">Active Trades</span>
                      <span className="text-sm font-bold text-secondary">
                        {tradeStats.openTrades}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Loading stats...</div>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="signals" className="h-full m-0 data-[state=inactive]:hidden">
             <div className="border border-border bg-card p-4 rounded h-full flex flex-col">
                 <h2 className="text-primary uppercase text-sm font-bold tracking-widest border-b border-border pb-2 mb-4">Live Signals</h2>
                 <div className="overflow-auto flex-1">
                   <table className="w-full text-sm text-left">
                     <thead className="text-xs text-muted-foreground uppercase bg-background sticky top-0">
                       <tr>
                         <th className="px-4 py-2 border-b border-border">Time</th>
                         <th className="px-4 py-2 border-b border-border">Pair</th>
                         <th className="px-4 py-2 border-b border-border">Strategy</th>
                         <th className="px-4 py-2 border-b border-border">Action</th>
                         <th className="px-4 py-2 border-b border-border">Price</th>
                         <th className="px-4 py-2 border-b border-border">Strength</th>
                       </tr>
                     </thead>
                     <tbody>
                       {signalsData?.signals?.map(signal => (
                         <tr key={signal.id} className="border-b border-border hover:bg-muted/50">
                           <td className="px-4 py-2">{new Date(signal.timestamp).toLocaleTimeString()}</td>
                           <td className="px-4 py-2 font-bold">{signal.pair} <span className="text-xs text-muted-foreground font-normal">({signal.exchange})</span></td>
                           <td className="px-4 py-2 text-secondary">{signal.strategy}</td>
                           <td className={`px-4 py-2 font-bold uppercase ${signal.action === 'buy' ? 'text-primary' : signal.action === 'sell' ? 'text-destructive' : 'text-foreground'}`}>
                             {signal.action}
                           </td>
                           <td className="px-4 py-2">${signal.price.toFixed(2)}</td>
                           <td className="px-4 py-2">
                             <div className="w-full bg-background h-2 rounded overflow-hidden flex items-center">
                               <div className="h-full bg-primary" style={{ width: `${signal.strength * 100}%` }}></div>
                             </div>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
             </div>
          </TabsContent>

          <TabsContent value="indicators" className="h-full m-0 data-[state=inactive]:hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {indicatorsData?.indicators?.map(ind => (
                <div key={`${ind.exchange}-${ind.pair}`} className="border border-border bg-card p-4 rounded">
                  <div className="flex justify-between items-center border-b border-border pb-2 mb-3">
                    <span className="font-bold text-lg">{ind.pair}</span>
                    <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded">{ind.exchange}</span>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">RSI</span>
                        <span className={`font-bold ${ind.rsi < 30 ? 'text-destructive' : ind.rsi > 70 ? 'text-primary' : 'text-foreground'}`}>
                          {ind.rsi.toFixed(1)}
                        </span>
                      </div>
                      <div className="w-full bg-background h-2 rounded overflow-hidden">
                        <div className={`h-full ${ind.rsi < 30 ? 'bg-destructive' : ind.rsi > 70 ? 'bg-primary' : 'bg-secondary'}`} style={{ width: `${ind.rsi}%` }}></div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="bg-background p-2 rounded border border-border">
                        <div className="text-[10px] text-muted-foreground mb-1">EMA CROSSOVER</div>
                        <div className={`text-sm font-bold uppercase ${ind.emaCrossover === 'bullish' ? 'text-primary' : ind.emaCrossover === 'bearish' ? 'text-destructive' : 'text-foreground'}`}>
                          {ind.emaCrossover}
                        </div>
                      </div>
                      <div className="bg-background p-2 rounded border border-border">
                        <div className="text-[10px] text-muted-foreground mb-1">VOLATILITY (5m)</div>
                        <div className={`text-sm font-bold ${ind.isHighVolatility ? 'text-secondary animate-pulse' : 'text-foreground'}`}>
                          {(ind.volatility5m * 100).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="trades" className="h-full m-0 data-[state=inactive]:hidden">
             <div className="border border-border bg-card p-4 rounded h-full flex flex-col">
                 <h2 className="text-primary uppercase text-sm font-bold tracking-widest border-b border-border pb-2 mb-4">Trade Log</h2>
                 <div className="overflow-auto flex-1">
                   <table className="w-full text-sm text-left">
                     <thead className="text-xs text-muted-foreground uppercase bg-background sticky top-0">
                       <tr>
                         <th className="px-4 py-2 border-b border-border">ID</th>
                         <th className="px-4 py-2 border-b border-border">Pair</th>
                         <th className="px-4 py-2 border-b border-border">Action</th>
                         <th className="px-4 py-2 border-b border-border">Price</th>
                         <th className="px-4 py-2 border-b border-border">Status</th>
                         <th className="px-4 py-2 border-b border-border">PnL</th>
                       </tr>
                     </thead>
                     <tbody>
                       {tradesData?.trades?.map(trade => (
                         <tr key={trade.id} className="border-b border-border hover:bg-muted/50">
                           <td className="px-4 py-2 text-xs font-mono text-muted-foreground">{trade.id.slice(0, 8)}</td>
                           <td className="px-4 py-2 font-bold">{trade.pair}</td>
                           <td className={`px-4 py-2 font-bold uppercase ${trade.action === 'buy' ? 'text-primary' : 'text-destructive'}`}>
                             {trade.action}
                           </td>
                           <td className="px-4 py-2">${trade.price.toFixed(2)}</td>
                           <td className="px-4 py-2 text-xs">
                             <span className={`px-2 py-1 rounded bg-background border ${trade.status === 'open' ? 'border-secondary text-secondary' : 'border-border text-foreground'}`}>
                               {trade.status}
                             </span>
                           </td>
                           <td className={`px-4 py-2 font-bold ${trade.pnl && trade.pnl > 0 ? 'text-primary' : trade.pnl && trade.pnl < 0 ? 'text-destructive' : 'text-foreground'}`}>
                             {trade.pnl ? `$${trade.pnl.toFixed(2)}` : '-'}
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
             </div>
          </TabsContent>

          <TabsContent value="stats" className="h-full m-0 data-[state=inactive]:hidden">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               <div className="border border-border bg-card p-4 rounded">
                 <div className="text-xs text-muted-foreground uppercase mb-1">Total PnL</div>
                 <div className={`text-2xl font-bold ${tradeStats?.totalPnl && tradeStats.totalPnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                   ${tradeStats?.totalPnl?.toFixed(2) ?? '0.00'}
                 </div>
               </div>
               <div className="border border-border bg-card p-4 rounded">
                 <div className="text-xs text-muted-foreground uppercase mb-1">Win Rate</div>
                 <div className="text-2xl font-bold text-foreground">
                   {tradeStats?.winRate ? (tradeStats.winRate * 100).toFixed(1) : '0.0'}%
                 </div>
               </div>
               <div className="border border-border bg-card p-4 rounded">
                 <div className="text-xs text-muted-foreground uppercase mb-1">Total Trades</div>
                 <div className="text-2xl font-bold text-secondary">
                   {tradeStats?.totalTrades ?? 0}
                 </div>
               </div>
               <div className="border border-border bg-card p-4 rounded">
                 <div className="text-xs text-muted-foreground uppercase mb-1">Avg PnL %</div>
                 <div className={`text-2xl font-bold ${tradeStats?.avgPnlPct && tradeStats.avgPnlPct >= 0 ? 'text-primary' : 'text-destructive'}`}>
                   {tradeStats?.avgPnlPct ? (tradeStats.avgPnlPct * 100).toFixed(2) : '0.00'}%
                 </div>
               </div>
             </div>
          </TabsContent>

          <TabsContent value="config" className="h-full m-0 data-[state=inactive]:hidden">
            {config ? (
               <div className="border border-border bg-card p-6 rounded max-w-2xl">
                 <h2 className="text-primary uppercase text-sm font-bold tracking-widest border-b border-border pb-2 mb-6">Bot Configuration</h2>
                 
                 <div className="grid grid-cols-2 gap-6">
                   <div>
                     <h3 className="text-xs text-muted-foreground uppercase mb-3">Strategies</h3>
                     <div className="flex flex-col gap-3">
                       {Object.entries(config.strategies).map(([strategy, enabled]) => (
                         <div key={strategy} className="flex justify-between items-center border border-border bg-background p-2 rounded">
                           <span className="text-sm font-mono">{strategy}</span>
                           <span className={`text-xs px-2 py-1 rounded ${enabled ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                             {enabled ? 'ON' : 'OFF'}
                           </span>
                         </div>
                       ))}
                     </div>
                   </div>
                   
                   <div>
                     <h3 className="text-xs text-muted-foreground uppercase mb-3">Parameters</h3>
                     <div className="flex flex-col gap-3">
                       <div className="flex justify-between border-b border-border pb-2">
                         <span className="text-sm">RSI Oversold/Bought</span>
                         <span className="text-sm font-mono text-secondary">{config.rsiOversold} / {config.rsiOverbought}</span>
                       </div>
                       <div className="flex justify-between border-b border-border pb-2">
                         <span className="text-sm">Stop Loss / Take Profit</span>
                         <span className="text-sm font-mono text-secondary">{(config.stopLossPct * 100).toFixed(1)}% / {(config.takeProfitPct * 100).toFixed(1)}%</span>
                       </div>
                       <div className="flex justify-between border-b border-border pb-2">
                         <span className="text-sm">Trade Size</span>
                         <span className="text-sm font-mono text-secondary">${config.tradeSize}</span>
                       </div>
                     </div>
                   </div>
                 </div>
               </div>
            ) : (
               <div className="text-sm text-muted-foreground">Loading config...</div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
