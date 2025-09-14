/**
 * Fixed Technical Indicators for Market Analysis
 *
 * This module provides various technical indicators with proper null safety
 */

/**
 * Simple Moving Average (SMA) - Fixed version
 */
export function calculateSMA(prices: number[], period: number): number[] {
  if (prices.length < period) return []

  const sma: number[] = []
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
    sma.push(sum / period)
  }

  return sma
}

/**
 * Exponential Moving Average (EMA) - Fixed version
 */
export function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return []

  const ema: number[] = []
  const multiplier = 2 / (period + 1)

  // First EMA is SMA
  if (prices.length >= period) {
    const sma = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
    ema.push(sma)
  } else {
    ema.push(prices[0] || 0)
  }

  // Calculate subsequent EMAs
  for (let i = 1; i < prices.length; i++) {
    const prevEMA = ema[i - 1] || 0
    const currentPrice = prices[i] || 0
    const currentEMA = currentPrice * multiplier + prevEMA * (1 - multiplier)
    ema.push(currentEMA)
  }

  return ema
}

/**
 * Relative Strength Index (RSI) - Fixed version
 */
export function calculateRSI(prices: number[], period: number = 14): number[] {
  if (prices.length < period + 1) return []

  const gains: number[] = []
  const losses: number[] = []

  // Calculate price changes
  for (let i = 1; i < prices.length; i++) {
    const currentPrice = prices[i] || 0
    const prevPrice = prices[i - 1] || 0
    const change = currentPrice - prevPrice
    gains.push(change > 0 ? change : 0)
    losses.push(change < 0 ? Math.abs(change) : 0)
  }

  const rsi: number[] = []

  // Calculate initial average gain and loss
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period

  // Calculate first RSI
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
  rsi.push(100 - 100 / (1 + rs))

  // Calculate subsequent RSI values using Wilder's smoothing
  for (let i = period; i < gains.length; i++) {
    const currentGain = gains[i] || 0
    const currentLoss = losses[i] || 0
    avgGain = (avgGain * (period - 1) + currentGain) / period
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    rsi.push(100 - 100 / (1 + rs))
  }

  return rsi
}

/**
 * Moving Average Convergence Divergence (MACD) - Fixed version
 */
export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): {
  macd: number[]
  signal: number[]
  histogram: number[]
} {
  const fastEMA = calculateEMA(prices, fastPeriod)
  const slowEMA = calculateEMA(prices, slowPeriod)

  const macd: number[] = []
  const minLength = Math.min(fastEMA.length, slowEMA.length)

  for (let i = 0; i < minLength; i++) {
    const fastValue = fastEMA[i] || 0
    const slowValue = slowEMA[i] || 0
    macd.push(fastValue - slowValue)
  }

  const signal = calculateEMA(macd, signalPeriod)
  const histogram: number[] = []

  const minSignalLength = Math.min(macd.length, signal.length)
  for (let i = 0; i < minSignalLength; i++) {
    const macdValue = macd[i] || 0
    const signalValue = signal[i] || 0
    histogram.push(macdValue - signalValue)
  }

  return { macd, signal, histogram }
}

/**
 * Bollinger Bands - Fixed version
 */
export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDev: number = 2
): {
  upper: number[]
  middle: number[]
  lower: number[]
  bandwidth: number[]
} {
  const sma = calculateSMA(prices, period)
  const upper: number[] = []
  const lower: number[] = []
  const bandwidth: number[] = []

  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1)
    const mean = sma[i - period + 1] || 0

    // Calculate standard deviation
    const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period
    const standardDeviation = Math.sqrt(variance)

    const upperBand = mean + stdDev * standardDeviation
    const lowerBand = mean - stdDev * standardDeviation
    const bandWidth = mean > 0 ? (upperBand - lowerBand) / mean : 0

    upper.push(upperBand)
    lower.push(lowerBand)
    bandwidth.push(bandWidth)
  }

  return {
    upper,
    middle: sma,
    lower,
    bandwidth,
  }
}

/**
 * Stochastic Oscillator - Fixed version
 */
export function calculateStochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  kPeriod: number = 14,
  dPeriod: number = 3
): {
  k: number[]
  d: number[]
} {
  if (highs.length !== lows.length || highs.length !== closes.length) {
    throw new Error('High, low, and close arrays must have the same length')
  }

  const k: number[] = []

  for (let i = kPeriod - 1; i < highs.length; i++) {
    const highSlice = highs.slice(i - kPeriod + 1, i + 1)
    const lowSlice = lows.slice(i - kPeriod + 1, i + 1)

    const highestHigh = Math.max(...highSlice)
    const lowestLow = Math.min(...lowSlice)
    const currentClose = closes[i] || 0

    const kValue = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100
    k.push(kValue)
  }

  const d = calculateSMA(k, dPeriod)

  return { k, d }
}

/**
 * Average True Range (ATR) - Fixed version
 */
export function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number[] {
  if (highs.length !== lows.length || highs.length !== closes.length) {
    throw new Error('High, low, and close arrays must have the same length')
  }

  const trueRanges: number[] = []

  // Calculate True Range for each period
  for (let i = 1; i < highs.length; i++) {
    const currentHigh = highs[i] || 0
    const currentLow = lows[i] || 0
    const prevClose = closes[i - 1] || 0

    const tr1 = currentHigh - currentLow
    const tr2 = Math.abs(currentHigh - prevClose)
    const tr3 = Math.abs(currentLow - prevClose)

    trueRanges.push(Math.max(tr1, tr2, tr3))
  }

  // Calculate ATR using Wilder's smoothing
  const atr: number[] = []

  if (trueRanges.length >= period) {
    // Initial ATR is average of first period true ranges
    let currentATR = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period
    atr.push(currentATR)

    // Calculate subsequent ATR values
    for (let i = period; i < trueRanges.length; i++) {
      const currentTR = trueRanges[i] || 0
      currentATR = (currentATR * (period - 1) + currentTR) / period
      atr.push(currentATR)
    }
  }

  return atr
}

/**
 * On-Balance Volume (OBV) - Fixed version
 */
export function calculateOBV(closes: number[], volumes: number[]): number[] {
  if (closes.length !== volumes.length) {
    throw new Error('Close and volume arrays must have the same length')
  }

  const obv: number[] = [volumes[0] || 0]

  for (let i = 1; i < closes.length; i++) {
    let obvValue = obv[i - 1] || 0
    const currentClose = closes[i] || 0
    const prevClose = closes[i - 1] || 0

    if (currentClose > prevClose) {
      obvValue += volumes[i] || 0
    } else if (currentClose < prevClose) {
      obvValue -= volumes[i] || 0
    }
    // If close is equal, OBV remains unchanged

    obv.push(obvValue)
  }

  return obv
}

/**
 * Volume Weighted Average Price (VWAP) - Fixed version
 */
export function calculateVWAP(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[]
): number[] {
  if (
    highs.length !== lows.length ||
    highs.length !== closes.length ||
    highs.length !== volumes.length
  ) {
    throw new Error('All arrays must have the same length')
  }

  const vwap: number[] = []
  let cumulativeVolume = 0
  let cumulativeVolumePrice = 0

  for (let i = 0; i < closes.length; i++) {
    const currentHigh = highs[i] || 0
    const currentLow = lows[i] || 0
    const currentClose = closes[i] || 0
    const currentVolume = volumes[i] || 0

    const typicalPrice = (currentHigh + currentLow + currentClose) / 3
    const volumePrice = typicalPrice * currentVolume

    cumulativeVolume += currentVolume
    cumulativeVolumePrice += volumePrice

    vwap.push(cumulativeVolumePrice / cumulativeVolume)
  }

  return vwap
}

/**
 * Williams %R - Fixed version
 */
export function calculateWilliamsR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number[] {
  if (highs.length !== lows.length || highs.length !== closes.length) {
    throw new Error('High, low, and close arrays must have the same length')
  }

  const williamsR: number[] = []

  for (let i = period - 1; i < highs.length; i++) {
    const highSlice = highs.slice(i - period + 1, i + 1)
    const lowSlice = lows.slice(i - period + 1, i + 1)

    const highestHigh = Math.max(...highSlice)
    const lowestLow = Math.min(...lowSlice)
    const currentClose = closes[i] || 0

    const wr = ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100
    williamsR.push(wr)
  }

  return williamsR
}

/**
 * Commodity Channel Index (CCI) - Fixed version
 */
export function calculateCCI(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 20
): number[] {
  if (highs.length !== lows.length || highs.length !== closes.length) {
    throw new Error('High, low, and close arrays must have the same length')
  }

  const cci: number[] = []

  for (let i = period - 1; i < highs.length; i++) {
    const slice = highs.slice(i - period + 1, i + 1)
    const lowSlice = lows.slice(i - period + 1, i + 1)
    const closeSlice = closes.slice(i - period + 1, i + 1)

    // Calculate typical prices
    const typicalPrices = slice.map((high, idx) => {
      const low = lowSlice[idx] || 0
      const close = closeSlice[idx] || 0
      return (high + low + close) / 3
    })

    // Calculate SMA of typical prices
    const sma = typicalPrices.reduce((a, b) => a + b, 0) / period

    // Calculate mean deviation
    const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period

    const currentHigh = highs[i] || 0
    const currentLow = lows[i] || 0
    const currentClose = closes[i] || 0
    const currentTP = (currentHigh + currentLow + currentClose) / 3
    const cciValue = (currentTP - sma) / (0.015 * meanDeviation)

    cci.push(cciValue)
  }

  return cci
}
