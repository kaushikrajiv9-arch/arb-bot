# ARB Terminal

A real-time crypto arbitrage and options trading bot dashboard with live price feeds, technical indicator strategies, and an options chain with Black-Scholes Greeks.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/arb-bot run dev` — run the dashboard (port varies)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (artifacts/api-server)
- Frontend: React 19 + Vite + Tailwind v4 + shadcn/ui (artifacts/arb-bot)
- Validation: Zod (`zod/v4`)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- No database — all state is in-memory (simulated exchange feeds)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas
- `artifacts/api-server/src/lib/` — core bot logic
  - `priceSimulator.ts` — live price feed simulation (Coinbase, Kraken, OKX)
  - `indicators.ts` — RSI, EMA, volatility calculations
  - `strategies.ts` — RSI, EMA crossover, scalping, volatility strategies
  - `botConfig.ts` — bot configuration state
  - `tradeStore.ts` — in-memory trade log
  - `blackScholes.ts` — Black-Scholes options pricing model
  - `optionsEngine.ts` — options chain, signals, positions (0DTE/swing/gamma scalp)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/arb-bot/src/pages/dashboard.tsx` — main dashboard UI

## Architecture decisions

- No database: all price data is simulated in-memory with realistic random walks and exchange-specific offsets
- Strategy cycle runs every 3 seconds server-side; frontend polls every 2s via React Query
- Black-Scholes with volatility smile/skew for realistic options pricing
- All 5 pairs (BTC, ETH, XRP, DOGE, AVAX) × 3 exchanges (Coinbase, Kraken, OKX) simulated independently
- Stop loss 1%, take profit 0.8% on all spot auto-trades; options use 2.5×/0.5× contract price targets

## Product

**Spot strategies:**
1. RSI — buy when RSI < 30, sell when RSI > 70
2. EMA 9/21 crossover — bullish/bearish signal on crossover
3. Scalping — captures 0.1–0.3% price movements
4. Volatility detector — increases trade frequency when 2%+ move in 5 min

**Options strategies:**
- 0DTE Momentum — buys OTM calls/puts on breakouts (targeting ~0.30 delta)
- Swing Call/Put — buys ATM-ish options on EMA crossovers with 1–2 week expiry
- Gamma Scalp — buys ATM options during high-volatility periods

**Dashboard tabs:** Overview, Signals, Options (chain + signals + positions), Indicators, Trade Log, Analytics, Config

## User preferences

- Dark terminal aesthetic (electric green on deep dark)
- No emojis in UI
- Real-time auto-refresh every 2–3 seconds

## Gotchas

- After any OpenAPI spec change, always run codegen before touching the frontend
- The api-server uses esbuild (not tsc) for bundling; typecheck is separate
- `pnpm --filter @workspace/api-server run dev` does build then start — it takes ~5s
- Options pricing recalculates fresh on each `/options/chain` request (no cache)
