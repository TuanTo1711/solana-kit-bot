/**
 * Advanced Risk Management System
 *
 * This module provides comprehensive risk management capabilities:
 * - Position sizing based on risk tolerance
 * - Stop loss and take profit management
 * - Portfolio risk assessment
 * - Drawdown protection
 * - Volatility-based position adjustment
 * - Correlation analysis
 */

/**
 * Risk level classification
 */
export type RiskLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high'

/**
 * Risk metrics for portfolio assessment
 */
export interface RiskMetrics {
  /** Current portfolio value */
  portfolioValue: number
  /** Maximum drawdown percentage */
  maxDrawdown: number
  /** Current drawdown percentage */
  currentDrawdown: number
  /** Value at Risk (VaR) at 95% confidence */
  var95: number
  /** Expected Shortfall (ES) at 95% confidence */
  expectedShortfall: number
  /** Sharpe ratio */
  sharpeRatio: number
  /** Sortino ratio */
  sortinoRatio: number
  /** Calmar ratio */
  calmarRatio: number
  /** Portfolio volatility */
  volatility: number
  /** Beta (market correlation) */
  beta: number
  /** Maximum position size allowed */
  maxPositionSize: number
  /** Risk-adjusted return */
  riskAdjustedReturn: number
}

/**
 * Position risk assessment
 */
export interface PositionRisk {
  /** Position size */
  size: number
  /** Entry price */
  entryPrice: number
  /** Current price */
  currentPrice: number
  /** Unrealized P&L */
  unrealizedPnl: number
  /** Unrealized P&L percentage */
  unrealizedPnlPercent: number
  /** Risk level of this position */
  riskLevel: RiskLevel
  /** Stop loss price */
  stopLoss: number
  /** Take profit price */
  takeProfit: number
  /** Position duration in periods */
  duration: number
  /** Risk per trade as percentage of portfolio */
  riskPerTrade: number
}

/**
 * Risk management configuration
 */
export interface RiskManagerConfig {
  /** Maximum portfolio risk per trade (0-1) */
  maxRiskPerTrade: number
  /** Maximum portfolio drawdown allowed (0-1) */
  maxDrawdown: number
  /** Risk-free rate for Sharpe ratio calculation */
  riskFreeRate: number
  /** Confidence level for VaR calculation (0-1) */
  varConfidence: number
  /** Lookback period for risk calculations */
  lookbackPeriod: number
  /** Enable dynamic position sizing */
  dynamicSizing: boolean
  /** Enable correlation-based risk adjustment */
  correlationAdjustment: boolean
  /** Maximum correlation allowed between positions */
  maxCorrelation: number
  /** Enable volatility-based position sizing */
  volatilitySizing: boolean
  /** Target volatility for portfolio */
  targetVolatility: number
}

/**
 * Advanced Risk Manager
 *
 * Provides comprehensive risk management for trading strategies including:
 * - Position sizing based on risk tolerance
 * - Portfolio risk assessment
 * - Drawdown protection
 * - Volatility management
 * - Correlation analysis
 */
export class RiskManager {
  private config: RiskManagerConfig
  private portfolioHistory: number[]
  private positions: Map<string, PositionRisk>
  private riskMetrics: RiskMetrics

  constructor(config: RiskManagerConfig) {
    this.config = {
      maxRiskPerTrade: config.maxRiskPerTrade || 0.02,
      maxDrawdown: config.maxDrawdown || 0.15,
      riskFreeRate: config.riskFreeRate || 0.02,
      varConfidence: config.varConfidence || 0.95,
      lookbackPeriod: config.lookbackPeriod || 252,
      dynamicSizing: config.dynamicSizing ?? true,
      correlationAdjustment: config.correlationAdjustment ?? true,
      maxCorrelation: config.maxCorrelation || 0.7,
      volatilitySizing: config.volatilitySizing ?? true,
      targetVolatility: config.targetVolatility || 0.12,
    }

    this.portfolioHistory = []
    this.positions = new Map()
    this.riskMetrics = this.initializeRiskMetrics()
  }

  /**
   * Calculates optimal position size based on risk parameters
   */
  calculatePositionSize(
    entryPrice: number,
    stopLoss: number,
    portfolioValue: number,
    volatility?: number,
    correlation?: number
  ): number {
    // Base position size calculation using Kelly Criterion
    const riskAmount = portfolioValue * this.config.maxRiskPerTrade
    const priceRisk = Math.abs(entryPrice - stopLoss)

    if (priceRisk === 0) return 0

    let baseSize = riskAmount / priceRisk

    // Apply volatility adjustment
    if (this.config.volatilitySizing && volatility !== undefined) {
      const volatilityAdjustment = this.config.targetVolatility / volatility
      baseSize *= Math.min(volatilityAdjustment, 2) // Cap at 2x
    }

    // Apply correlation adjustment
    if (this.config.correlationAdjustment && correlation !== undefined) {
      const correlationAdjustment = 1 - correlation * 0.5
      baseSize *= correlationAdjustment
    }

    // Apply dynamic sizing based on current portfolio risk
    if (this.config.dynamicSizing) {
      const portfolioRisk = this.calculatePortfolioRisk()
      const riskAdjustment = Math.max(0.1, 1 - portfolioRisk)
      baseSize *= riskAdjustment
    }

    // Ensure position size doesn't exceed maximum allowed
    const maxSize = portfolioValue * 0.1 // Maximum 10% of portfolio
    return Math.min(baseSize, maxSize)
  }

  /**
   * Calculates portfolio risk metrics
   */
  calculatePortfolioRisk(): number {
    this.updateRiskMetrics()

    // Combine multiple risk factors
    const drawdownRisk = this.riskMetrics.currentDrawdown / this.config.maxDrawdown
    const volatilityRisk = this.riskMetrics.volatility / this.config.targetVolatility
    const varRisk = Math.abs(this.riskMetrics.var95) / (this.riskMetrics.portfolioValue * 0.05)

    // Weighted risk score
    const totalRisk = drawdownRisk * 0.4 + volatilityRisk * 0.3 + varRisk * 0.3

    return Math.min(totalRisk, 1)
  }

  /**
   * Updates risk metrics based on current portfolio state
   */
  private updateRiskMetrics(): void {
    if (this.portfolioHistory.length < 2) return

    const currentValue = this.portfolioHistory[this.portfolioHistory.length - 1] || 0
    const returns = this.calculateReturns()

    this.riskMetrics.portfolioValue = currentValue
    this.riskMetrics.volatility = this.calculateVolatility(returns)
    this.riskMetrics.maxDrawdown = this.calculateMaxDrawdown()
    this.riskMetrics.currentDrawdown = this.calculateCurrentDrawdown()
    this.riskMetrics.var95 = this.calculateVaR(returns, this.config.varConfidence)
    this.riskMetrics.expectedShortfall = this.calculateExpectedShortfall(
      returns,
      this.config.varConfidence
    )
    this.riskMetrics.sharpeRatio = this.calculateSharpeRatio(returns)
    this.riskMetrics.sortinoRatio = this.calculateSortinoRatio(returns)
    this.riskMetrics.calmarRatio = this.calculateCalmarRatio(returns)
    this.riskMetrics.maxPositionSize = this.calculateMaxPositionSize()
    this.riskMetrics.riskAdjustedReturn = this.calculateRiskAdjustedReturn(returns)
  }

  /**
   * Calculates portfolio returns
   */
  private calculateReturns(): number[] {
    if (this.portfolioHistory.length < 2) return []

    const returns: number[] = []
    for (let i = 1; i < this.portfolioHistory.length; i++) {
      const prevValue = this.portfolioHistory[i - 1]
      const currValue = this.portfolioHistory[i]
      if (prevValue !== undefined && currValue !== undefined && prevValue !== 0) {
        const returnValue = (currValue - prevValue) / prevValue
        returns.push(returnValue)
      }
    }

    return returns
  }

  /**
   * Calculates portfolio volatility
   */
  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length

    return Math.sqrt(variance)
  }

  /**
   * Calculates maximum drawdown
   */
  private calculateMaxDrawdown(): number {
    if (this.portfolioHistory.length < 2) return 0

    let maxDrawdown = 0
    let peak = this.portfolioHistory[0] || 0

    for (let i = 1; i < this.portfolioHistory.length; i++) {
      const currentValue = this.portfolioHistory[i] || 0
      if (currentValue > peak) {
        peak = currentValue
      } else {
        const drawdown = (peak - currentValue) / peak
        maxDrawdown = Math.max(maxDrawdown, drawdown)
      }
    }

    return maxDrawdown
  }

  /**
   * Calculates current drawdown
   */
  private calculateCurrentDrawdown(): number {
    if (this.portfolioHistory.length < 2) return 0

    const currentValue = this.portfolioHistory[this.portfolioHistory.length - 1] || 0
    const recentValues = this.portfolioHistory.slice(-20).filter(v => v !== undefined) as number[]
    const recentPeak = recentValues.length > 0 ? Math.max(...recentValues) : currentValue

    return recentPeak > 0 ? (recentPeak - currentValue) / recentPeak : 0
  }

  /**
   * Calculates Value at Risk (VaR)
   */
  private calculateVaR(returns: number[], confidence: number): number {
    if (returns.length === 0) return 0

    const sortedReturns = [...returns].sort((a, b) => a - b)
    const index = Math.floor((1 - confidence) * sortedReturns.length)

    return sortedReturns[index] || 0
  }

  /**
   * Calculates Expected Shortfall (ES)
   */
  private calculateExpectedShortfall(returns: number[], confidence: number): number {
    const varValue = this.calculateVaR(returns, confidence)
    const tailReturns = returns.filter(ret => ret <= varValue)

    if (tailReturns.length === 0) return varValue

    return tailReturns.reduce((sum, ret) => sum + ret, 0) / tailReturns.length
  }

  /**
   * Calculates Sharpe ratio
   */
  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length === 0) return 0

    const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
    const volatility = this.calculateVolatility(returns)

    if (volatility === 0) return 0

    return (meanReturn - this.config.riskFreeRate) / volatility
  }

  /**
   * Calculates Sortino ratio
   */
  private calculateSortinoRatio(returns: number[]): number {
    if (returns.length === 0) return 0

    const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
    const negativeReturns = returns.filter(ret => ret < 0)

    if (negativeReturns.length === 0) return meanReturn > this.config.riskFreeRate ? Infinity : 0

    const downsideDeviation = Math.sqrt(
      negativeReturns.reduce((sum, ret) => sum + ret * ret, 0) / negativeReturns.length
    )

    if (downsideDeviation === 0) return meanReturn > this.config.riskFreeRate ? Infinity : 0

    return (meanReturn - this.config.riskFreeRate) / downsideDeviation
  }

  /**
   * Calculates Calmar ratio
   */
  private calculateCalmarRatio(returns: number[]): number {
    if (returns.length === 0) return 0

    const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
    const maxDrawdown = this.calculateMaxDrawdown()

    if (maxDrawdown === 0) return meanReturn > 0 ? Infinity : 0

    return meanReturn / maxDrawdown
  }

  /**
   * Calculates maximum allowed position size
   */
  private calculateMaxPositionSize(): number {
    const portfolioRisk = this.calculatePortfolioRisk()
    const baseMaxSize = this.config.maxRiskPerTrade * 5 // 5x base risk per trade

    return baseMaxSize * (1 - portfolioRisk)
  }

  /**
   * Calculates risk-adjusted return
   */
  private calculateRiskAdjustedReturn(returns: number[]): number {
    const sharpeRatio = this.calculateSharpeRatio(returns)
    const volatility = this.calculateVolatility(returns)

    return sharpeRatio * volatility
  }

  /**
   * Adds a new position to risk tracking
   */
  addPosition(
    id: string,
    size: number,
    entryPrice: number,
    stopLoss: number,
    takeProfit: number
  ): void {
    const position: PositionRisk = {
      size,
      entryPrice,
      currentPrice: entryPrice,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
      riskLevel: 'medium',
      stopLoss,
      takeProfit,
      duration: 0,
      riskPerTrade: (Math.abs(entryPrice - stopLoss) * size) / this.riskMetrics.portfolioValue,
    }

    this.positions.set(id, position)
  }

  /**
   * Updates position with current market data
   */
  updatePosition(id: string, currentPrice: number): void {
    const position = this.positions.get(id)
    if (!position) return

    position.currentPrice = currentPrice
    position.unrealizedPnl = (currentPrice - position.entryPrice) * position.size
    position.unrealizedPnlPercent = (currentPrice - position.entryPrice) / position.entryPrice
    position.duration++

    // Update risk level based on P&L
    if (position.unrealizedPnlPercent > 0.1) {
      position.riskLevel = 'low'
    } else if (position.unrealizedPnlPercent > 0.05) {
      position.riskLevel = 'medium'
    } else if (position.unrealizedPnlPercent > -0.05) {
      position.riskLevel = 'medium'
    } else if (position.unrealizedPnlPercent > -0.1) {
      position.riskLevel = 'high'
    } else {
      position.riskLevel = 'very_high'
    }
  }

  /**
   * Removes a position from tracking
   */
  removePosition(id: string): PositionRisk | undefined {
    const position = this.positions.get(id)
    this.positions.delete(id)
    return position
  }

  /**
   * Updates portfolio value
   */
  updatePortfolioValue(value: number): void {
    this.portfolioHistory.push(value)

    // Keep only recent history
    if (this.portfolioHistory.length > this.config.lookbackPeriod) {
      this.portfolioHistory.shift()
    }
  }

  /**
   * Checks if portfolio is within risk limits
   */
  isWithinRiskLimits(): boolean {
    this.updateRiskMetrics()

    return (
      this.riskMetrics.currentDrawdown <= this.config.maxDrawdown &&
      this.riskMetrics.volatility <= this.config.targetVolatility * 1.5 &&
      this.riskMetrics.var95 >= -this.riskMetrics.portfolioValue * 0.1 // VaR not worse than -10%
    )
  }

  /**
   * Gets risk alerts for current portfolio state
   */
  getRiskAlerts(): string[] {
    const alerts: string[] = []
    this.updateRiskMetrics()

    if (this.riskMetrics.currentDrawdown > this.config.maxDrawdown * 0.8) {
      alerts.push(`High drawdown: ${(this.riskMetrics.currentDrawdown * 100).toFixed(1)}%`)
    }

    if (this.riskMetrics.volatility > this.config.targetVolatility * 1.5) {
      alerts.push(`High volatility: ${(this.riskMetrics.volatility * 100).toFixed(1)}%`)
    }

    if (this.riskMetrics.var95 < -this.riskMetrics.portfolioValue * 0.05) {
      alerts.push(
        `High VaR: ${((this.riskMetrics.var95 / this.riskMetrics.portfolioValue) * 100).toFixed(1)}%`
      )
    }

    if (this.riskMetrics.sharpeRatio < 0.5) {
      alerts.push(`Low Sharpe ratio: ${this.riskMetrics.sharpeRatio.toFixed(2)}`)
    }

    return alerts
  }

  /**
   * Gets current risk metrics
   */
  getRiskMetrics(): RiskMetrics {
    this.updateRiskMetrics()
    return { ...this.riskMetrics }
  }

  /**
   * Gets all tracked positions
   */
  getPositions(): Map<string, PositionRisk> {
    return new Map(this.positions)
  }

  /**
   * Updates risk manager configuration
   */
  updateConfig(config: Partial<RiskManagerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Resets risk manager to initial state
   */
  reset(): void {
    this.portfolioHistory = []
    this.positions.clear()
    this.riskMetrics = this.initializeRiskMetrics()
  }

  /**
   * Initializes risk metrics with default values
   */
  private initializeRiskMetrics(): RiskMetrics {
    return {
      portfolioValue: 100000, // Default portfolio value
      maxDrawdown: 0,
      currentDrawdown: 0,
      var95: 0,
      expectedShortfall: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      volatility: 0,
      beta: 1,
      maxPositionSize: this.config.maxRiskPerTrade * 5,
      riskAdjustedReturn: 0,
    }
  }
}
