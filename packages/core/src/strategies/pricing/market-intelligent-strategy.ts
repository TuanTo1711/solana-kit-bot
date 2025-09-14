import { AbstractPriceStrategy } from '~/abstract'
import type { PriceContext, PriceResult, PriceStrategyConfig } from '~/types'
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR,
  calculateStochastic,
} from './technical-indicators'
import { RiskManager, type RiskManagerConfig } from './risk-manager'

/**
 * Market condition types
 */
export type MarketCondition = 'bull' | 'bear' | 'sideways' | 'volatile' | 'trending'

/**
 * Trading signal strength
 */
export type SignalStrength = 'weak' | 'moderate' | 'strong' | 'very_strong'

/**
 * Market analysis data with technical indicators
 */
interface MarketAnalysis {
  /** Current market condition */
  condition: MarketCondition
  /** Trend direction (-1 to 1) */
  trendDirection: number
  /** Market volatility (0-1) */
  volatility: number
  /** Volume analysis */
  volumeAnalysis: {
    current: number
    average: number
    trend: 'increasing' | 'decreasing' | 'stable'
  }
  /** Price momentum */
  momentum: {
    short: number // 5-period momentum
    medium: number // 10-period momentum
    long: number // 20-period momentum
  }
  /** Support and resistance levels */
  levels: {
    support: number
    resistance: number
    current: number
  }
  /** Market sentiment */
  sentiment: {
    fear: number // 0-1, higher = more fear
    greed: number // 0-1, higher = more greed
    confidence: number // 0-1, overall market confidence
  }
  /** Technical indicators */
  indicators: {
    sma20: number
    ema12: number
    ema26: number
    rsi: number
    macd: number
    macdSignal: number
    macdHistogram: number
    bbUpper: number
    bbMiddle: number
    bbLower: number
    bbBandwidth: number
    atr: number
    stochasticK: number
    stochasticD: number
  }
}

/**
 * Trading position data
 */
interface TradingPosition {
  /** Current position size */
  size: number
  /** Average entry price */
  entryPrice: number
  /** Current profit/loss percentage */
  pnl: number
  /** Position duration in iterations */
  duration: number
  /** Risk level of current position */
  riskLevel: 'low' | 'medium' | 'high' | 'very_high'
}

/**
 * Configuration for Market Intelligent Strategy
 */
export interface MarketIntelligentConfig extends PriceStrategyConfig {
  /** Base price for calculations */
  basePrice: number
  /** Maximum position size as percentage of capital */
  maxPositionSize: number
  /** Risk tolerance (0-1) */
  riskTolerance: number
  /** Market analysis lookback period */
  analysisPeriod: number
  /** Enable dynamic position sizing */
  dynamicSizing: boolean
  /** Enable trend following */
  trendFollowing: boolean
  /** Enable mean reversion */
  meanReversion: boolean
  /** Enable momentum trading */
  momentumTrading: boolean
  /** Stop loss percentage */
  stopLoss: number
  /** Take profit percentage */
  takeProfit: number
  /** Market condition weights for strategy selection */
  conditionWeights: {
    bull: number
    bear: number
    sideways: number
    volatile: number
    trending: number
  }
  /** Risk manager configuration */
  riskConfig?: RiskManagerConfig
  /** Enable technical indicators */
  useTechnicalIndicators: boolean
  /** Enable advanced risk management */
  useRiskManagement: boolean
}

/**
 * Market Intelligent Trading Strategy
 *
 * A sophisticated trading strategy that adapts to market conditions using:
 * - Technical analysis (trends, momentum, support/resistance)
 * - Market sentiment analysis
 * - Dynamic position sizing
 * - Risk management
 * - Multiple trading approaches (trend following, mean reversion, momentum)
 *
 * @example
 * ```typescript
 * const strategy = new MarketIntelligentStrategy({
 *   basePrice: 0.01,
 *   maxPositionSize: 0.1,
 *   riskTolerance: 0.05,
 *   analysisPeriod: 20,
 *   dynamicSizing: true,
 *   trendFollowing: true,
 *   meanReversion: true,
 *   momentumTrading: true,
 *   stopLoss: 0.05,
 *   takeProfit: 0.15,
 *   conditionWeights: {
 *     bull: 0.3,
 *     bear: 0.2,
 *     sideways: 0.2,
 *     volatile: 0.15,
 *     trending: 0.15
 *   }
 * })
 * ```
 */
export class MarketIntelligentStrategy extends AbstractPriceStrategy {
  private basePrice: number
  private maxPositionSize: number
  private riskTolerance: number
  private analysisPeriod: number
  private dynamicSizing: boolean
  private trendFollowing: boolean
  private meanReversion: boolean
  private momentumTrading: boolean
  private stopLoss: number
  private takeProfit: number
  private conditionWeights: Required<MarketIntelligentConfig['conditionWeights']>
  private useTechnicalIndicators: boolean
  private useRiskManagement: boolean

  private marketAnalysis: MarketAnalysis
  private tradingPosition: TradingPosition
  private priceHistory: number[]
  private volumeHistory: number[]
  private highHistory: number[]
  private lowHistory: number[]
  private riskManager: RiskManager
  private performanceHistory: {
    trades: number
    wins: number
    losses: number
    totalPnl: number
    maxDrawdown: number
    sharpeRatio: number
  }

  constructor(config: MarketIntelligentConfig) {
    super('MarketIntelligent', config)

    this.basePrice = config.basePrice
    this.maxPositionSize = config.maxPositionSize || 0.1
    this.riskTolerance = config.riskTolerance || 0.05
    this.analysisPeriod = config.analysisPeriod || 20
    this.dynamicSizing = config.dynamicSizing ?? true
    this.trendFollowing = config.trendFollowing ?? true
    this.meanReversion = config.meanReversion ?? true
    this.momentumTrading = config.momentumTrading ?? true
    this.stopLoss = config.stopLoss || 0.05
    this.takeProfit = config.takeProfit || 0.15
    this.useTechnicalIndicators = config.useTechnicalIndicators ?? true
    this.useRiskManagement = config.useRiskManagement ?? true
    this.conditionWeights = config.conditionWeights || {
      bull: 0.3,
      bear: 0.2,
      sideways: 0.2,
      volatile: 0.15,
      trending: 0.15,
    }

    this.priceHistory = [config.basePrice]
    this.volumeHistory = []
    this.highHistory = [config.basePrice * 1.01]
    this.lowHistory = [config.basePrice * 0.99]

    // Initialize risk manager
    this.riskManager = new RiskManager(
      config.riskConfig || {
        maxRiskPerTrade: this.riskTolerance,
        maxDrawdown: 0.15,
        riskFreeRate: 0.02,
        varConfidence: 0.95,
        lookbackPeriod: this.analysisPeriod,
        dynamicSizing: this.dynamicSizing,
        correlationAdjustment: true,
        maxCorrelation: 0.7,
        volatilitySizing: true,
        targetVolatility: 0.12,
      }
    )

    this.marketAnalysis = this.initializeMarketAnalysis()
    this.tradingPosition = this.initializeTradingPosition()
    this.performanceHistory = this.initializePerformanceHistory()
  }

  /**
   * Calculates the optimal trading price based on market analysis
   */
  calculatePrice(context: PriceContext): PriceResult {
    // Update market analysis
    this.updateMarketAnalysis(context)

    // Update trading position
    this.updateTradingPosition(context)

    // Generate trading signal
    const signal = this.generateTradingSignal()

    // Calculate optimal price based on signal and market conditions
    const price = this.calculateOptimalPrice(signal, context)

    // Calculate confidence based on signal strength and market analysis
    const confidence = this.calculateConfidence(signal)

    // Generate reasoning
    const reason = this.generateReasoning(signal, this.marketAnalysis)

    return this.createResult(price, confidence, reason, {
      strategy: 'market-intelligent',
      marketAnalysis: { ...this.marketAnalysis },
      tradingPosition: { ...this.tradingPosition },
      signal: signal,
      performance: { ...this.performanceHistory },
      iteration: context.iteration,
    })
  }

  /**
   * Analyzes market conditions and updates internal state
   */
  private updateMarketAnalysis(context: PriceContext): void {
    // Update price history
    if (context.previousPrice !== undefined) {
      this.priceHistory.push(context.previousPrice)
      if (this.priceHistory.length > this.analysisPeriod) {
        this.priceHistory.shift()
      }
    }

    // Update volume history
    if (context.metadata?.['volume'] !== undefined) {
      this.volumeHistory.push(context.metadata['volume'] as number)
      if (this.volumeHistory.length > this.analysisPeriod) {
        this.volumeHistory.shift()
      }
    }

    // Update high/low history
    if (context.metadata?.['high'] !== undefined) {
      this.highHistory.push(context.metadata['high'] as number)
      if (this.highHistory.length > this.analysisPeriod) {
        this.highHistory.shift()
      }
    }

    if (context.metadata?.['low'] !== undefined) {
      this.lowHistory.push(context.metadata['low'] as number)
      if (this.lowHistory.length > this.analysisPeriod) {
        this.lowHistory.shift()
      }
    }

    // Analyze market condition
    this.marketAnalysis.condition = this.determineMarketCondition()
    this.marketAnalysis.trendDirection = this.calculateTrendDirection()
    this.marketAnalysis.volatility = this.calculateVolatility()
    this.marketAnalysis.volumeAnalysis = this.analyzeVolume()
    this.marketAnalysis.momentum = this.calculateMomentum()
    this.marketAnalysis.levels = this.calculateSupportResistance()
    this.marketAnalysis.sentiment = this.calculateSentiment()

    // Calculate technical indicators if enabled
    if (this.useTechnicalIndicators) {
      this.marketAnalysis.indicators = this.calculateTechnicalIndicators()
    }
  }

  /**
   * Determines current market condition
   */
  private determineMarketCondition(): MarketCondition {
    const prices = this.priceHistory
    if (prices.length < 5) return 'sideways'

    const volatility = this.calculateVolatility()
    const trend = this.calculateTrendDirection()

    // High volatility = volatile market
    if (volatility > 0.3) return 'volatile'

    // Strong trend = trending market
    if (Math.abs(trend) > 0.6) return 'trending'

    // Positive trend = bull market
    if (trend > 0.2) return 'bull'

    // Negative trend = bear market
    if (trend < -0.2) return 'bear'

    // Default = sideways
    return 'sideways'
  }

  /**
   * Calculates trend direction using linear regression
   */
  private calculateTrendDirection(): number {
    const prices = this.priceHistory
    if (prices.length < 3) return 0

    const n = prices.length
    const x = Array.from({ length: n }, (_, i) => i)
    const y = prices

    // Calculate linear regression slope
    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((sum, xi, i) => sum + xi * (y[i] || 0), 0)
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)

    // Normalize to [-1, 1] range
    return Math.max(-1, Math.min(1, slope / this.basePrice))
  }

  /**
   * Calculates market volatility using standard deviation
   */
  private calculateVolatility(): number {
    const prices = this.priceHistory
    if (prices.length < 2) return 0

    const returns = []
    for (let i = 1; i < prices.length; i++) {
      const prevPrice = prices[i - 1]
      const currPrice = prices[i]
      if (prevPrice !== undefined && currPrice !== undefined && prevPrice !== 0) {
        returns.push((currPrice - prevPrice) / prevPrice)
      }
    }

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length

    return Math.sqrt(variance)
  }

  /**
   * Analyzes volume patterns
   */
  private analyzeVolume(): MarketAnalysis['volumeAnalysis'] {
    const volumes = this.volumeHistory
    if (volumes.length === 0) {
      return {
        current: 0,
        average: 0,
        trend: 'stable',
      }
    }

    const current = volumes[volumes.length - 1] || 0
    const average = volumes.reduce((sum, vol) => sum + (vol || 0), 0) / volumes.length

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable'
    if (volumes.length >= 3) {
      const recent = volumes.slice(-3)
      const vol0 = recent[0] || 0
      const vol1 = recent[1] || 0
      const vol2 = recent[2] || 0
      if (vol2 > vol1 && vol1 > vol0) {
        trend = 'increasing'
      } else if (vol2 < vol1 && vol1 < vol0) {
        trend = 'decreasing'
      }
    }

    return { current, average, trend }
  }

  /**
   * Calculates momentum indicators
   */
  private calculateMomentum(): MarketAnalysis['momentum'] {
    const prices = this.priceHistory
    if (prices.length < 20) {
      return { short: 0, medium: 0, long: 0 }
    }

    const current = prices[prices.length - 1] || this.basePrice

    return {
      short:
        prices.length >= 5
          ? (current - (prices[prices.length - 5] || this.basePrice)) /
            (prices[prices.length - 5] || this.basePrice)
          : 0,
      medium:
        prices.length >= 10
          ? (current - (prices[prices.length - 10] || this.basePrice)) /
            (prices[prices.length - 10] || this.basePrice)
          : 0,
      long:
        prices.length >= 20
          ? (current - (prices[prices.length - 20] || this.basePrice)) /
            (prices[prices.length - 20] || this.basePrice)
          : 0,
    }
  }

  /**
   * Calculates support and resistance levels
   */
  private calculateSupportResistance(): MarketAnalysis['levels'] {
    const prices = this.priceHistory
    if (prices.length < 5) {
      return {
        support: this.basePrice * 0.9,
        resistance: this.basePrice * 1.1,
        current: prices[prices.length - 1] || this.basePrice,
      }
    }

    const current = prices[prices.length - 1] || this.basePrice
    const recent = prices.slice(-10).filter(p => p !== undefined) as number[]
    const support = recent.length > 0 ? Math.min(...recent) * 0.98 : this.basePrice * 0.9
    const resistance = recent.length > 0 ? Math.max(...recent) * 1.02 : this.basePrice * 1.1

    return { support, resistance, current }
  }

  /**
   * Calculates market sentiment
   */
  private calculateSentiment(): MarketAnalysis['sentiment'] {
    const momentum = this.marketAnalysis.momentum
    const volatility = this.marketAnalysis.volatility
    const trend = this.marketAnalysis.trendDirection

    // Fear increases with negative momentum and high volatility
    const fear = Math.max(
      0,
      Math.min(
        1,
        Math.abs(momentum.short) * 0.3 + volatility * 0.4 + (trend < 0 ? Math.abs(trend) : 0) * 0.3
      )
    )

    // Greed increases with positive momentum and low volatility
    const greed = Math.max(
      0,
      Math.min(
        1,
        (momentum.short > 0 ? momentum.short : 0) * 0.4 +
          (volatility < 0.1 ? 1 - volatility * 10 : 0) * 0.3 +
          (trend > 0 ? trend : 0) * 0.3
      )
    )

    // Confidence based on consistency of signals
    const confidence = Math.max(0, Math.min(1, 1 - volatility * 2))

    return { fear, greed, confidence }
  }

  /**
   * Calculates technical indicators
   */
  private calculateTechnicalIndicators(): MarketAnalysis['indicators'] {
    const prices = this.priceHistory
    const highs = this.highHistory
    const lows = this.lowHistory

    if (prices.length < 20) {
      return {
        sma20: prices[prices.length - 1] || this.basePrice,
        ema12: prices[prices.length - 1] || this.basePrice,
        ema26: prices[prices.length - 1] || this.basePrice,
        rsi: 50,
        macd: 0,
        macdSignal: 0,
        macdHistogram: 0,
        bbUpper: prices[prices.length - 1] || this.basePrice,
        bbMiddle: prices[prices.length - 1] || this.basePrice,
        bbLower: prices[prices.length - 1] || this.basePrice,
        bbBandwidth: 0,
        atr: 0,
        stochasticK: 50,
        stochasticD: 50,
      }
    }

    // Calculate indicators
    const sma20 = calculateSMA(prices, 20)
    const ema12 = calculateEMA(prices, 12)
    const ema26 = calculateEMA(prices, 26)
    const rsi = calculateRSI(prices, 14)
    const macd = calculateMACD(prices, 12, 26, 9)
    const bb = calculateBollingerBands(prices, 20, 2)
    const atr = calculateATR(highs, lows, prices, 14)
    const stoch = calculateStochastic(highs, lows, prices, 14, 3)

    return {
      sma20: sma20[sma20.length - 1] || this.basePrice,
      ema12: ema12[ema12.length - 1] || this.basePrice,
      ema26: ema26[ema26.length - 1] || this.basePrice,
      rsi: rsi[rsi.length - 1] || 50,
      macd: macd.macd[macd.macd.length - 1] || 0,
      macdSignal: macd.signal[macd.signal.length - 1] || 0,
      macdHistogram: macd.histogram[macd.histogram.length - 1] || 0,
      bbUpper: bb.upper[bb.upper.length - 1] || this.basePrice,
      bbMiddle: bb.middle[bb.middle.length - 1] || this.basePrice,
      bbLower: bb.lower[bb.lower.length - 1] || this.basePrice,
      bbBandwidth: bb.bandwidth[bb.bandwidth.length - 1] || 0,
      atr: atr[atr.length - 1] || 0,
      stochasticK: stoch.k[stoch.k.length - 1] || 50,
      stochasticD: stoch.d[stoch.d.length - 1] || 50,
    }
  }

  /**
   * Generates trading signal based on market analysis and technical indicators
   */
  private generateTradingSignal(): { action: 'buy' | 'sell' | 'hold'; strength: SignalStrength } {
    const analysis = this.marketAnalysis
    const position = this.tradingPosition

    let buyScore = 0
    let sellScore = 0

    // Trend following signals
    if (this.trendFollowing) {
      if (analysis.trendDirection > 0.3) buyScore += 0.3
      if (analysis.trendDirection < -0.3) sellScore += 0.3
    }

    // Mean reversion signals
    if (this.meanReversion) {
      const current = analysis.levels.current
      const support = analysis.levels.support
      const resistance = analysis.levels.resistance

      if (current < support * 1.02) buyScore += 0.2
      if (current > resistance * 0.98) sellScore += 0.2
    }

    // Momentum signals
    if (this.momentumTrading) {
      if (analysis.momentum.short > 0.05 && analysis.momentum.medium > 0) buyScore += 0.2
      if (analysis.momentum.short < -0.05 && analysis.momentum.medium < 0) sellScore += 0.2
    }

    // Technical indicator signals
    if (this.useTechnicalIndicators) {
      const indicators = analysis.indicators

      // RSI signals
      if (indicators.rsi < 30) buyScore += 0.15 // Oversold
      if (indicators.rsi > 70) sellScore += 0.15 // Overbought

      // MACD signals
      if (indicators.macd > indicators.macdSignal && indicators.macdHistogram > 0) buyScore += 0.1
      if (indicators.macd < indicators.macdSignal && indicators.macdHistogram < 0) sellScore += 0.1

      // Bollinger Bands signals
      if (analysis.levels.current < indicators.bbLower) buyScore += 0.1 // Below lower band
      if (analysis.levels.current > indicators.bbUpper) sellScore += 0.1 // Above upper band

      // Stochastic signals
      if (indicators.stochasticK < 20 && indicators.stochasticD < 20) buyScore += 0.1 // Oversold
      if (indicators.stochasticK > 80 && indicators.stochasticD > 80) sellScore += 0.1 // Overbought

      // Moving average signals
      if (indicators.ema12 > indicators.ema26 && analysis.levels.current > indicators.sma20)
        buyScore += 0.1
      if (indicators.ema12 < indicators.ema26 && analysis.levels.current < indicators.sma20)
        sellScore += 0.1
    }

    // Volume confirmation
    if (analysis.volumeAnalysis.trend === 'increasing') {
      if (buyScore > sellScore) buyScore += 0.1
      else sellScore += 0.1
    }

    // Sentiment signals
    if (analysis.sentiment.fear > 0.7) buyScore += 0.1 // Fear = buying opportunity
    if (analysis.sentiment.greed > 0.7) sellScore += 0.1 // Greed = selling opportunity

    // Risk management
    if (position.pnl < -this.stopLoss) sellScore += 0.5 // Stop loss
    if (position.pnl > this.takeProfit) sellScore += 0.3 // Take profit

    // Risk manager signals
    if (this.useRiskManagement) {
      const riskAlerts = this.riskManager.getRiskAlerts()
      if (riskAlerts.length > 2) {
        // Reduce position size if too many risk alerts
        buyScore *= 0.5
        sellScore *= 0.5
      }
    }

    // Apply market condition weights
    const conditionWeight = this.conditionWeights[analysis.condition] || 1.0
    buyScore *= conditionWeight
    sellScore *= conditionWeight

    // Determine action and strength
    const netScore = buyScore - sellScore
    let action: 'buy' | 'sell' | 'hold' = 'hold'
    let strength: SignalStrength = 'weak'

    if (netScore > 0.3) {
      action = 'buy'
      strength = netScore > 0.6 ? 'strong' : netScore > 0.4 ? 'moderate' : 'weak'
    } else if (netScore < -0.3) {
      action = 'sell'
      strength = netScore < -0.6 ? 'strong' : netScore < -0.4 ? 'moderate' : 'weak'
    }

    return { action, strength }
  }

  /**
   * Calculates optimal price based on trading signal and risk management
   */
  private calculateOptimalPrice(
    signal: { action: 'buy' | 'sell' | 'hold'; strength: SignalStrength },
    context: PriceContext
  ): number {
    const currentPrice = context.previousPrice || this.basePrice
    const analysis = this.marketAnalysis

    let priceAdjustment = 0

    switch (signal.action) {
      case 'buy':
        // Aggressive buying in bull markets, conservative in bear markets
        const buyMultiplier =
          analysis.condition === 'bull' ? 1.2 : analysis.condition === 'bear' ? 0.5 : 1.0
        priceAdjustment =
          this.basePrice * 0.01 * this.getStrengthMultiplier(signal.strength) * buyMultiplier
        break

      case 'sell':
        // Aggressive selling in bear markets, conservative in bull markets
        const sellMultiplier =
          analysis.condition === 'bear' ? 1.2 : analysis.condition === 'bull' ? 0.5 : 1.0
        priceAdjustment =
          -this.basePrice * 0.01 * this.getStrengthMultiplier(signal.strength) * sellMultiplier
        break

      case 'hold':
        // Small adjustments based on market condition
        if (analysis.condition === 'volatile') {
          priceAdjustment = (Math.random() - 0.5) * this.basePrice * 0.005
        }
        break
    }

    // Apply risk management adjustments
    if (this.useRiskManagement) {
      const riskMetrics = this.riskManager.getRiskMetrics()
      const portfolioRisk = this.riskManager.calculatePortfolioRisk()

      // Reduce position size if portfolio risk is high
      if (portfolioRisk > 0.7) {
        priceAdjustment *= 0.3
      } else if (portfolioRisk > 0.5) {
        priceAdjustment *= 0.6
      }

      // Adjust based on volatility
      if (riskMetrics.volatility > this.riskManager.getRiskMetrics().volatility * 1.5) {
        priceAdjustment *= 0.5
      }
    }

    // Apply dynamic sizing based on risk tolerance
    if (this.dynamicSizing) {
      const riskAdjustment =
        1 -
        (this.tradingPosition.riskLevel === 'high'
          ? 0.5
          : this.tradingPosition.riskLevel === 'medium'
            ? 0.2
            : 0)
      priceAdjustment *= riskAdjustment

      // Apply max position size constraint
      const maxAdjustment = this.basePrice * this.maxPositionSize
      priceAdjustment = Math.max(-maxAdjustment, Math.min(maxAdjustment, priceAdjustment))
    }

    return currentPrice + priceAdjustment
  }

  /**
   * Converts signal strength to numeric multiplier
   */
  private getStrengthMultiplier(strength: SignalStrength): number {
    switch (strength) {
      case 'weak':
        return 0.5
      case 'moderate':
        return 1.0
      case 'strong':
        return 1.5
      case 'very_strong':
        return 2.0
      default:
        return 1.0
    }
  }

  /**
   * Calculates confidence based on signal strength and market analysis
   */
  private calculateConfidence(signal: {
    action: 'buy' | 'sell' | 'hold'
    strength: SignalStrength
  }): number {
    let confidence = 0.5 // Base confidence

    // Signal strength contribution
    switch (signal.strength) {
      case 'weak':
        confidence += 0.1
        break
      case 'moderate':
        confidence += 0.2
        break
      case 'strong':
        confidence += 0.3
        break
      case 'very_strong':
        confidence += 0.4
        break
    }

    // Market analysis contribution
    confidence += this.marketAnalysis.sentiment.confidence * 0.2

    // Volume confirmation
    if (this.marketAnalysis.volumeAnalysis.trend === 'increasing') {
      confidence += 0.1
    }

    // Volatility penalty
    confidence -= this.marketAnalysis.volatility * 0.2

    return Math.max(0.1, Math.min(0.95, confidence))
  }

  /**
   * Generates detailed reasoning for the trading decision
   */
  private generateReasoning(
    signal: { action: 'buy' | 'sell' | 'hold'; strength: SignalStrength },
    analysis: MarketAnalysis
  ): string {
    const reasons = []

    reasons.push(`Market: ${analysis.condition}`)
    reasons.push(
      `Trend: ${analysis.trendDirection > 0 ? 'Bullish' : 'Bearish'} (${analysis.trendDirection.toFixed(2)})`
    )
    reasons.push(`Volatility: ${(analysis.volatility * 100).toFixed(1)}%`)
    reasons.push(`Signal: ${signal.action.toUpperCase()} (${signal.strength})`)

    if (analysis.levels.current < analysis.levels.support * 1.02) {
      reasons.push('Near support level - potential bounce')
    }
    if (analysis.levels.current > analysis.levels.resistance * 0.98) {
      reasons.push('Near resistance level - potential rejection')
    }

    if (analysis.sentiment.fear > 0.6) {
      reasons.push('High fear - potential buying opportunity')
    }
    if (analysis.sentiment.greed > 0.6) {
      reasons.push('High greed - potential selling opportunity')
    }

    return reasons.join(' | ')
  }

  /**
   * Updates trading position based on current context
   */
  private updateTradingPosition(context: PriceContext): void {
    // Update position duration
    this.tradingPosition.duration++

    if (context.previousPrice !== undefined) {
      // Update P&L
      this.tradingPosition.pnl =
        (context.previousPrice - this.tradingPosition.entryPrice) / this.tradingPosition.entryPrice

      // Update risk manager
      if (this.useRiskManagement) {
        this.riskManager.updatePortfolioValue(context.previousPrice * this.tradingPosition.size)

        // Update position in risk manager
        const positionId = 'main_position'
        if (this.tradingPosition.size > 0) {
          this.riskManager.updatePosition(positionId, context.previousPrice)
        }
      }

      // Update risk level based on P&L
      if (this.tradingPosition.pnl > 0.1) {
        this.tradingPosition.riskLevel = 'low'
      } else if (this.tradingPosition.pnl > 0.05) {
        this.tradingPosition.riskLevel = 'medium'
      } else if (this.tradingPosition.pnl > -0.05) {
        this.tradingPosition.riskLevel = 'medium'
      } else if (this.tradingPosition.pnl > -0.1) {
        this.tradingPosition.riskLevel = 'high'
      } else {
        this.tradingPosition.riskLevel = 'very_high'
      }
    }
  }

  /**
   * Initializes market analysis with default values
   */
  private initializeMarketAnalysis(): MarketAnalysis {
    return {
      condition: 'sideways',
      trendDirection: 0,
      volatility: 0,
      volumeAnalysis: { current: 0, average: 0, trend: 'stable' },
      momentum: { short: 0, medium: 0, long: 0 },
      levels: {
        support: this.basePrice * 0.9,
        resistance: this.basePrice * 1.1,
        current: this.basePrice,
      },
      sentiment: { fear: 0.5, greed: 0.5, confidence: 0.5 },
      indicators: {
        sma20: this.basePrice,
        ema12: this.basePrice,
        ema26: this.basePrice,
        rsi: 50,
        macd: 0,
        macdSignal: 0,
        macdHistogram: 0,
        bbUpper: this.basePrice * 1.02,
        bbMiddle: this.basePrice,
        bbLower: this.basePrice * 0.98,
        bbBandwidth: 0.04,
        atr: 0,
        stochasticK: 50,
        stochasticD: 50,
      },
    }
  }

  /**
   * Initializes trading position with default values
   */
  private initializeTradingPosition(): TradingPosition {
    return {
      size: 0,
      entryPrice: this.basePrice,
      pnl: 0,
      duration: 0,
      riskLevel: 'low',
    }
  }

  /**
   * Initializes performance history
   */
  private initializePerformanceHistory() {
    return {
      trades: 0,
      wins: 0,
      losses: 0,
      totalPnl: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
    }
  }

  /**
   * Resets the strategy to initial state
   */
  override reset(): void {
    this.priceHistory = [this.basePrice]
    this.volumeHistory = []
    this.highHistory = [this.basePrice * 1.01]
    this.lowHistory = [this.basePrice * 0.99]
    this.marketAnalysis = this.initializeMarketAnalysis()
    this.tradingPosition = this.initializeTradingPosition()
    this.performanceHistory = this.initializePerformanceHistory()

    if (this.useRiskManagement) {
      this.riskManager.reset()
    }
  }

  /**
   * Gets current market analysis
   */
  getMarketAnalysis(): MarketAnalysis {
    return { ...this.marketAnalysis }
  }

  /**
   * Gets current trading position
   */
  getTradingPosition(): TradingPosition {
    return { ...this.tradingPosition }
  }

  /**
   * Gets performance history
   */
  getPerformanceHistory() {
    return { ...this.performanceHistory }
  }

  /**
   * Gets risk manager instance
   */
  getRiskManager(): RiskManager {
    return this.riskManager
  }

  /**
   * Gets risk alerts
   */
  getRiskAlerts(): string[] {
    if (!this.useRiskManagement) return []
    return this.riskManager.getRiskAlerts()
  }

  /**
   * Gets risk metrics
   */
  getRiskMetrics() {
    if (!this.useRiskManagement) return null
    return this.riskManager.getRiskMetrics()
  }

  /**
   * Checks if portfolio is within risk limits
   */
  isWithinRiskLimits(): boolean {
    if (!this.useRiskManagement) return true
    return this.riskManager.isWithinRiskLimits()
  }

  /**
   * Gets technical indicators
   */
  getTechnicalIndicators() {
    if (!this.useTechnicalIndicators) return null
    return this.marketAnalysis.indicators
  }

  /**
   * Updates strategy configuration
   */
  updateConfig(config: Partial<MarketIntelligentConfig>): void {
    if (config.maxPositionSize !== undefined) this.maxPositionSize = config.maxPositionSize
    if (config.riskTolerance !== undefined) this.riskTolerance = config.riskTolerance
    if (config.stopLoss !== undefined) this.stopLoss = config.stopLoss
    if (config.takeProfit !== undefined) this.takeProfit = config.takeProfit
    if (config.dynamicSizing !== undefined) this.dynamicSizing = config.dynamicSizing
    if (config.trendFollowing !== undefined) this.trendFollowing = config.trendFollowing
    if (config.meanReversion !== undefined) this.meanReversion = config.meanReversion
    if (config.momentumTrading !== undefined) this.momentumTrading = config.momentumTrading
    if (config.useTechnicalIndicators !== undefined)
      this.useTechnicalIndicators = config.useTechnicalIndicators
    if (config.useRiskManagement !== undefined) this.useRiskManagement = config.useRiskManagement

    if (config.riskConfig && this.useRiskManagement) {
      this.riskManager.updateConfig(config.riskConfig)
    }
  }
}
