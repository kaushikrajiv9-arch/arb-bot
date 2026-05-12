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
  useUpdateConfig,
  useGetOptionsChain,
  getGetOptionsChainQueryKey,
  useGetOptionsSignals,
  getGetOptionsSignalsQueryKey,
  useGetOptionsPositions,
  getGetOptionsPositionsQueryKey,
  type GetOptionsChainExpiry
} from "@workspace/api-client-react";

export function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedPair, setSelectedPair] = useState("BTC-USD");
  const [selectedExpiry, setSelectedExpiry] = useState<GetOptionsChainExpiry>("0dte");

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

  // Options Data
  const { data: chain } = useGetOptionsChain({ pair: selectedPair, expiry: selectedExpiry }, {
    query: { refetchInterval: 3000, queryKey: getGetOptionsChainQueryKey({ pair: selectedPair, expiry: selectedExpiry }) }
  });
  
  const { data: optSignals } = useGetOptionsSignals({ 
    query: { refetchInterval: 3000, queryKey: getGetOptionsSignalsQueryKey() } 
  });
  
  const { data: optPositions } = useGetOptionsPositions({ 
    query: { refetchInterval: 3000, queryKey: getGetOptionsPositionsQueryKey() } 
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
        <TabsList className="grid grid-cols-7 mb-4 bg-muted/50 p-1 border border-border">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold tracking-widest text-xs uppercase" data-testid="tab-overview">OVERVIEW</TabsTrigger>
          <TabsTrigger value="signals" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold tracking-widest text-xs uppercase" data-testid="tab-signals">SIGNALS</TabsTrigger>
          <TabsTrigger value="options" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold tracking-widest text-xs uppercase" data-testid="tab-options">OPTIONS</TabsTrigger>
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

          {/* OPTIONS TAB */}
          <TabsContent value="options" className="h-full m-0 data-[state=inactive]:hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
              {/* Options Chain Panel */}
              <div className="lg:col-span-2 flex flex-col gap-4 h-full">
                <div className="border border-border bg-card p-4 rounded flex flex-col h-full">
                  <div className="flex justify-between items-center border-b border-border pb-4 mb-4">
                    <div className="flex gap-4 items-center">
                      <h2 className="text-primary uppercase text-sm font-bold tracking-widest">Options Chain</h2>
                      <div className="flex gap-2">
                        <select 
                          className="bg-background border border-border text-xs px-2 py-1 outline-none" 
                          value={selectedPair} 
                          onChange={(e) => setSelectedPair(e.target.value)}
                          data-testid="select-pair"
                        >
                          {["BTC-USD", "ETH-USD", "XRP-USD", "DOGE-USD", "AVAX-USD"].map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        <select 
                          className="bg-background border border-border text-xs px-2 py-1 outline-none" 
                          value={selectedExpiry} 
                          onChange={(e) => setSelectedExpiry(e.target.value as GetOptionsChainExpiry)}
                          data-testid="select-expiry"
                        >
                          <option value="0dte">0DTE</option>
                          <option value="1w">1W</option>
                          <option value="2w">2W</option>
                          <option value="1m">1m</option>
                        </select>
                      </div>
                    </div>
                    {chain?.spotPrice && (
                      <div className="text-sm border border-primary px-3 py-1 rounded bg-primary/10 text-primary font-bold">
                        SPOT: ${chain.spotPrice.toFixed(2)}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-auto">
                    <div className="grid grid-cols-2 gap-4">
                      {/* CALLS */}
                      <div>
                        <div className="text-center font-bold text-primary mb-2 text-xs tracking-widest border-b border-border pb-1">CALLS</div>
                        <table className="w-full text-xs text-right">
                          <thead className="text-[10px] text-muted-foreground bg-background sticky top-0">
                            <tr>
                              <th className="py-1 px-2 border-b border-border">Vol</th>
                              <th className="py-1 px-2 border-b border-border">OI</th>
                              <th className="py-1 px-2 border-b border-border">Vega</th>
                              <th className="py-1 px-2 border-b border-border">Theta</th>
                              <th className="py-1 px-2 border-b border-border">Gamma</th>
                              <th className="py-1 px-2 border-b border-border">Delta</th>
                              <th className="py-1 px-2 border-b border-border">IV%</th>
                              <th className="py-1 px-2 border-b border-border">Bid/Ask</th>
                              <th className="py-1 px-2 border-b border-border font-bold">Strike</th>
                            </tr>
                          </thead>
                          <tbody>
                            {chain?.calls.map(c => (
                              <tr key={c.id} className={`border-b border-border/50 hover:bg-muted/50 ${c.inTheMoney ? 'bg-primary/5' : ''}`}>
                                <td className="py-1 px-2 text-muted-foreground">{c.volume}</td>
                                <td className="py-1 px-2 text-muted-foreground">{c.openInterest}</td>
                                <td className="py-1 px-2">{c.vega.toFixed(4)}</td>
                                <td className="py-1 px-2">{c.theta.toFixed(4)}</td>
                                <td className="py-1 px-2">{c.gamma.toFixed(5)}</td>
                                <td className="py-1 px-2">{c.delta.toFixed(2)}</td>
                                <td className="py-1 px-2">{(c.iv * 100).toFixed(1)}%</td>
                                <td className="py-1 px-2">{c.bid.toFixed(2)}/{c.ask.toFixed(2)}</td>
                                <td className={`py-1 px-2 font-bold ${c.inTheMoney ? 'text-primary' : ''}`}>{c.strike}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* PUTS */}
                      <div>
                        <div className="text-center font-bold text-destructive mb-2 text-xs tracking-widest border-b border-border pb-1">PUTS</div>
                        <table className="w-full text-xs text-left">
                          <thead className="text-[10px] text-muted-foreground bg-background sticky top-0">
                            <tr>
                              <th className="py-1 px-2 border-b border-border font-bold">Strike</th>
                              <th className="py-1 px-2 border-b border-border">Bid/Ask</th>
                              <th className="py-1 px-2 border-b border-border">IV%</th>
                              <th className="py-1 px-2 border-b border-border">Delta</th>
                              <th className="py-1 px-2 border-b border-border">Gamma</th>
                              <th className="py-1 px-2 border-b border-border">Theta</th>
                              <th className="py-1 px-2 border-b border-border">Vega</th>
                              <th className="py-1 px-2 border-b border-border">OI</th>
                              <th className="py-1 px-2 border-b border-border">Vol</th>
                            </tr>
                          </thead>
                          <tbody>
                            {chain?.puts.map(p => (
                              <tr key={p.id} className={`border-b border-border/50 hover:bg-muted/50 ${p.inTheMoney ? 'bg-destructive/5' : ''}`}>
                                <td className={`py-1 px-2 font-bold ${p.inTheMoney ? 'text-destructive' : ''}`}>{p.strike}</td>
                                <td className="py-1 px-2">{p.bid.toFixed(2)}/{p.ask.toFixed(2)}</td>
                                <td className="py-1 px-2">{(p.iv * 100).toFixed(1)}%</td>
                                <td className="py-1 px-2">{p.delta.toFixed(2)}</td>
                                <td className="py-1 px-2">{p.gamma.toFixed(5)}</td>
                                <td className="py-1 px-2">{p.theta.toFixed(4)}</td>
                                <td className="py-1 px-2">{p.vega.toFixed(4)}</td>
                                <td className="py-1 px-2 text-muted-foreground">{p.openInterest}</td>
                                <td className="py-1 px-2 text-muted-foreground">{p.volume}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Options Positions */}
                <div className="border border-border bg-card p-4 rounded flex flex-col min-h-[300px]">
                  <div className="flex justify-between items-center border-b border-border pb-2 mb-4">
                     <h2 className="text-primary uppercase text-sm font-bold tracking-widest">Options Positions</h2>
                     {optPositions?.stats && (
                       <div className="flex gap-4 text-xs">
                         <div>Total: <span className="font-bold">{optPositions.stats.totalPositions}</span></div>
                         <div>Open: <span className="font-bold text-secondary">{optPositions.stats.openPositions}</span></div>
                         <div>Win Rate: <span className="font-bold">{(optPositions.stats.winRate * 100).toFixed(1)}%</span></div>
                         <div>PnL: <span className={`font-bold ${optPositions.stats.totalPnl >= 0 ? 'text-primary' : 'text-destructive'}`}>${optPositions.stats.totalPnl.toFixed(2)}</span></div>
                       </div>
                     )}
                  </div>
                  <div className="overflow-auto flex-1">
                    <table className="w-full text-xs text-left">
                      <thead className="text-[10px] text-muted-foreground uppercase bg-background sticky top-0">
                        <tr>
                          <th className="px-2 py-2 border-b border-border">Pair</th>
                          <th className="px-2 py-2 border-b border-border">Type</th>
                          <th className="px-2 py-2 border-b border-border">Strike</th>
                          <th className="px-2 py-2 border-b border-border">Expiry</th>
                          <th className="px-2 py-2 border-b border-border">Qty</th>
                          <th className="px-2 py-2 border-b border-border">Entry</th>
                          <th className="px-2 py-2 border-b border-border">Current</th>
                          <th className="px-2 py-2 border-b border-border">Delta</th>
                          <th className="px-2 py-2 border-b border-border">Theta</th>
                          <th className="px-2 py-2 border-b border-border">PnL</th>
                          <th className="px-2 py-2 border-b border-border">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {optPositions?.positions?.map(pos => (
                          <tr key={pos.id} className="border-b border-border hover:bg-muted/50">
                            <td className="px-2 py-2 font-bold">{pos.pair}</td>
                            <td className={`px-2 py-2 font-bold uppercase ${pos.type === 'call' ? 'text-primary' : 'text-destructive'}`}>{pos.type}</td>
                            <td className="px-2 py-2">{pos.strike}</td>
                            <td className="px-2 py-2">{pos.expiryLabel}</td>
                            <td className="px-2 py-2">{pos.quantity}</td>
                            <td className="px-2 py-2">${pos.entryPrice.toFixed(2)}</td>
                            <td className="px-2 py-2">${pos.currentPrice.toFixed(2)}</td>
                            <td className="px-2 py-2">{pos.delta.toFixed(2)}</td>
                            <td className="px-2 py-2">{pos.theta.toFixed(4)}</td>
                            <td className={`px-2 py-2 font-bold ${pos.pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                              ${pos.pnl.toFixed(2)} <span className="text-[10px] opacity-80">({(pos.pnlPct * 100).toFixed(1)}%)</span>
                            </td>
                            <td className="px-2 py-2">
                              <span className={`px-1 py-0.5 rounded bg-background border ${pos.status === 'open' ? 'border-secondary text-secondary' : 'border-border text-muted-foreground'}`}>
                                {pos.status}
                                {pos.exitReason && <span className="ml-1 opacity-70">({pos.exitReason})</span>}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Options Signals */}
              <div className="border border-border bg-card p-4 rounded flex flex-col h-full">
                <h2 className="text-secondary uppercase text-sm font-bold tracking-widest border-b border-border pb-2 mb-4">Options Signals</h2>
                <div className="overflow-auto flex-1 flex flex-col gap-3 pr-2">
                  {optSignals?.signals?.map(sig => (
                    <div key={sig.id} className="p-3 border border-border bg-background rounded flex flex-col gap-2 relative overflow-hidden">
                      <div className={`absolute top-0 left-0 w-1 h-full ${sig.type === 'call' ? 'bg-primary' : 'bg-destructive'}`}></div>
                      
                      <div className="flex justify-between items-start">
                        <div className="flex gap-2 items-center">
                          <span className="font-bold">{sig.pair}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/50 text-muted-foreground">
                            {sig.strategy}
                          </span>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${sig.type === 'call' ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'}`}>
                          {sig.type.toUpperCase()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs mt-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Strike</span>
                          <span>{sig.strike}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Expiry</span>
                          <span>{sig.expiryLabel}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Price</span>
                          <span>${sig.contractPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">IV</span>
                          <span>{(sig.iv * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Delta</span>
                          <span>{sig.delta.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Theta</span>
                          <span>{sig.theta.toFixed(4)}</span>
                        </div>
                      </div>

                      <div className="mt-2 text-[10px] text-muted-foreground italic border-l-2 border-border pl-2">
                        "{sig.reason}"
                      </div>
                      
                      <div className="mt-1">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-muted-foreground">Conviction</span>
                          <span className="font-bold">{(sig.strength * 100).toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-muted h-1 rounded overflow-hidden">
                          <div className={`h-full ${sig.type === 'call' ? 'bg-primary' : 'bg-destructive'}`} style={{ width: `${sig.strength * 100}%` }}></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
