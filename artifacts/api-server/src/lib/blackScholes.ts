function erf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function normCDF(x: number): number {
  return (1 + erf(x / Math.SQRT2)) / 2;
}

function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export type Greeks = {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  iv: number;
};

export function blackScholes(
  S: number,      // spot price
  K: number,      // strike price
  T: number,      // time to expiry in years
  r: number,      // risk-free rate
  sigma: number,  // implied volatility
  type: "call" | "put"
): { price: number; greeks: Greeks } {
  if (T <= 0) {
    const intrinsic = type === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0);
    return {
      price: intrinsic,
      greeks: { delta: type === "call" ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, theta: 0, vega: 0, rho: 0, iv: sigma },
    };
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  let price: number;
  let delta: number;

  if (type === "call") {
    price = S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2);
    delta = normCDF(d1);
  } else {
    price = K * Math.exp(-r * T) * normCDF(-d2) - S * normCDF(-d1);
    delta = normCDF(d1) - 1;
  }

  const gamma = normPDF(d1) / (S * sigma * sqrtT);
  const theta = (type === "call"
    ? -(S * normPDF(d1) * sigma) / (2 * sqrtT) - r * K * Math.exp(-r * T) * normCDF(d2)
    : -(S * normPDF(d1) * sigma) / (2 * sqrtT) + r * K * Math.exp(-r * T) * normCDF(-d2)
  ) / 365;
  const vega = S * normPDF(d1) * sqrtT / 100;
  const rho = (type === "call"
    ? K * T * Math.exp(-r * T) * normCDF(d2)
    : -K * T * Math.exp(-r * T) * normCDF(-d2)
  ) / 100;

  return { price: Math.max(price, 0), greeks: { delta, gamma, theta, vega, rho, iv: sigma } };
}

export function getExpiryYears(expiry: string): number {
  switch (expiry) {
    case "0dte": return 1 / 365;
    case "1w": return 7 / 365;
    case "2w": return 14 / 365;
    case "1m": return 30 / 365;
    default: return 1 / 365;
  }
}

export function getExpiryLabel(expiry: string): string {
  switch (expiry) {
    case "0dte": return "0DTE";
    case "1w": return "1 Week";
    case "2w": return "2 Weeks";
    case "1m": return "1 Month";
    default: return "0DTE";
  }
}
