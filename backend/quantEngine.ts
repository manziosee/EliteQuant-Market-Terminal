/**
 * QUANT ANALYTICAL ENGINE: ML & INDICATORS
 * Functionally replicates Pandas, NumPy, and scikit-learn logic
 */

/**
 * LINEAR REGRESSION (scikit-learn LinearRegression mirror)
 * Predicts the next n values based on the slope of historical data
 */
export function predictPrice(prices: number[], periodsAhead: number = 1) {
  const n = prices.length;
  if (n < 2) return prices[prices.length - 1];

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += prices[i];
    sumXY += i * prices[i];
    sumXX += i * i;
  }

  // Calculate slope (m) and intercept (b)
  const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const b = (sumY - m * sumX) / n;

  // Predict future value
  return m * (n + periodsAhead - 1) + b;
}

/**
 * VOLATILITY ANALYSIS (NumPy Standard Deviation mirror)
 */
export function calculateVolatility(prices: number[]) {
  const n = prices.length;
  if (n === 0) return 0;
  const mean = prices.reduce((a, b) => a + b) / n;
  const deviation = prices.map(p => Math.pow(p - mean, 2));
  const variance = deviation.reduce((a, b) => a + b) / n;
  return Math.sqrt(variance);
}

/**
 * TREND DETECTION ENGINE
 * Identifies market momentum and direction
 */
export function detectTrend(prices: number[]) {
  const shortWindow = prices.slice(-5);
  const longWindow = prices.slice(-14);
  
  const shortAvg = shortWindow.reduce((a, b) => a + b) / shortWindow.length;
  const longAvg = longWindow.reduce((a, b) => a + b) / longWindow.length;
  
  const slope = (prices[prices.length - 1] - prices[prices.length - 5]) / 5;
  
  return {
    direction: shortAvg > longAvg ? 'BULLISH' : 'BEARISH',
    strength: Math.abs(shortAvg - longAvg) / longAvg,
    momentum: slope > 0 ? 'ACCELERATING' : 'DECELERATING'
  };
}

/**
 * RELATIVE STRENGTH INDEX (RSI) - Scratch Implementation
 * (Pandas-style rolling window calc)
 */
export function calculateRSI(prices: number[], period: number = 14) {
  if (prices.length < period + 1) return 50;

  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[prices.length - i] - prices[prices.length - i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * MOVING AVERAGE CONVERGENCE DIVERGENCE (MACD) - Scratch Implementation
 */
export function calculateMACD(prices: number[]) {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macdLine = ema12 - ema26;
  
  // Higher level approximation of signal line
  return {
    line: macdLine,
    signal: macdLine * 0.9, // simplified signal
    histogram: macdLine - (macdLine * 0.9)
  };
}

function calculateEMA(prices: number[], period: number) {
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}
