import { AbstractPriceStrategy } from '~/abstract'
import type { PriceContext, PriceResult, PriceStrategyConfig } from '~/types'

/**
 * Configuration for Dynamic Price Strategy
 */
export interface DynamicPriceConfig extends PriceStrategyConfig {
  /** Starting price for the strategy */
  startPrice: number
  /** Price adjustment amount per iteration */
  priceStep?: number
  /** Maximum price change per iteration as a percentage (0-100) */
  maxChangePerIteration?: number
  /** Algorithm used for price adaptation */
  adaptationMode: 'linear' | 'exponential' | 'logarithmic' | 'performance'
  /** Success rate threshold for performance-based adaptation (0-1) */
  performanceThreshold?: number
  /** Optional price boundaries to constrain the price range */
  bounds?: {
    min: number
    max: number
  }
}

/**
 * Performance tracking metrics for the strategy
 */
interface PerformanceMetrics {
  /** Current success rate (0-1) */
  successRate: number
  /** Average execution time in milliseconds */
  averageExecutionTime: number
  /** Total number of iterations executed */
  totalIterations: number
  /** History of recent success/failure results */
  recentSuccesses: boolean[]
}

/**
 * Dynamic Price Strategy
 *
 * A sophisticated pricing strategy that adjusts prices dynamically based on iteration count,
 * performance metrics, and configurable adaptation algorithms. Supports multiple adaptation
 * modes including linear, exponential, logarithmic, and performance-based pricing.
 *
 * @example
 * ```typescript
 * // Linear price increase
 * const linearStrategy = new DynamicPriceStrategy({
 *   startPrice: 0.01,
 *   priceStep: 0.001,
 *   adaptationMode: 'linear'
 * })
 *
 * // Performance-based adaptation with bounds
 * const performanceStrategy = new DynamicPriceStrategy({
 *   startPrice: 0.02,
 *   adaptationMode: 'performance',
 *   performanceThreshold: 0.8,
 *   bounds: { min: 0.01, max: 0.1 }
 * })
 * ```
 */
export class DynamicPriceStrategy extends AbstractPriceStrategy {
  private startPrice: number
  private priceStep: number
  private maxChangePerIteration: number
  private adaptationMode: 'linear' | 'exponential' | 'logarithmic' | 'performance'
  private performanceThreshold: number
  private bounds?: DynamicPriceConfig['bounds']
  private performanceHistory: PerformanceMetrics

  /**
   * Creates a new Dynamic Price Strategy
   *
   * @param config - Configuration options for the strategy
   */
  constructor(config: DynamicPriceConfig) {
    super('DynamicPrice', config)
    this.startPrice = config.startPrice
    this.priceStep = config.priceStep || 0.001
    this.maxChangePerIteration = config.maxChangePerIteration || 5
    this.adaptationMode = config.adaptationMode
    this.performanceThreshold = config.performanceThreshold || 0.8
    this.bounds = config.bounds

    this.performanceHistory = {
      successRate: 1.0,
      averageExecutionTime: 0,
      totalIterations: 0,
      recentSuccesses: [],
    }
  }

  /**
   * Calculates the price for the current iteration based on the selected adaptation mode
   *
   * @param context - Current pricing context including iteration and metadata
   * @returns Price result with calculated price, confidence, and reasoning
   */
  calculatePrice(context: PriceContext): PriceResult {
    let newPrice: number
    let confidence: number
    let reason: string

    this.updatePerformanceMetrics(context)

    switch (this.adaptationMode) {
      case 'linear':
        newPrice = this.calculateLinearPrice(context)
        confidence = 0.7
        reason = `Linear progression: ${this.priceStep} per iteration`
        break

      case 'exponential':
        newPrice = this.calculateExponentialPrice(context)
        confidence = 0.6
        reason = 'Exponential growth based on iteration'
        break

      case 'logarithmic':
        newPrice = this.calculateLogarithmicPrice(context)
        confidence = 0.8
        reason = 'Logarithmic adjustment (diminishing returns)'
        break

      case 'performance':
        newPrice = this.calculatePerformanceBasedPrice(context)
        confidence = this.performanceHistory.successRate
        reason = `Performance-based: ${(this.performanceHistory.successRate * 100).toFixed(1)}% success rate`
        break

      default:
        newPrice = this.startPrice
        confidence = 0.5
        reason = 'Default start price'
    }

    if (this.bounds) {
      newPrice = Math.max(this.bounds.min, Math.min(this.bounds.max, newPrice))
    }

    return this.createResult(newPrice, confidence, reason, {
      strategy: 'dynamic',
      adaptationMode: this.adaptationMode,
      startPrice: this.startPrice,
      priceStep: this.priceStep,
      performance: { ...this.performanceHistory },
      bounds: this.bounds,
      iteration: context.iteration,
    })
  }

  /**
   * Calculates price using linear progression
   * Formula: startPrice + (priceStep * iteration)
   */
  private calculateLinearPrice(context: PriceContext): number {
    return this.startPrice + this.priceStep * context.iteration
  }

  /**
   * Calculates price using exponential growth
   * Formula: startPrice * (1 + growthRate)^iteration
   */
  private calculateExponentialPrice(context: PriceContext): number {
    const growthRate = this.priceStep / this.startPrice
    return this.startPrice * Math.pow(1 + growthRate, context.iteration)
  }

  /**
   * Calculates price using logarithmic growth for diminishing returns
   * Formula: startPrice + (priceStep * log(iteration + 1))
   */
  private calculateLogarithmicPrice(context: PriceContext): number {
    if (context.iteration === 0) return this.startPrice

    const logFactor = Math.log(context.iteration + 1)
    return this.startPrice + this.priceStep * logFactor
  }

  /**
   * Calculates price based on performance metrics and success rate
   * Increases price when performance is above threshold, decreases when below
   */
  private calculatePerformanceBasedPrice(context: PriceContext): number {
    const basePrice = context.previousPrice || this.startPrice

    let adjustment = 0

    if (this.performanceHistory.successRate > this.performanceThreshold) {
      adjustment =
        this.priceStep * (this.performanceHistory.successRate - this.performanceThreshold)
    } else {
      adjustment =
        -this.priceStep * (this.performanceThreshold - this.performanceHistory.successRate)
    }

    const maxChange = basePrice * (this.maxChangePerIteration / 100)
    adjustment = Math.max(-maxChange, Math.min(maxChange, adjustment))

    return basePrice + adjustment
  }

  /**
   * Updates internal performance metrics based on context metadata
   */
  private updatePerformanceMetrics(context: PriceContext): void {
    this.performanceHistory.totalIterations = context.iteration

    if (context.metadata?.['lastOperationSuccess'] !== undefined) {
      const success = context.metadata['lastOperationSuccess']
      this.performanceHistory.recentSuccesses.push(success)

      if (this.performanceHistory.recentSuccesses.length > 10) {
        this.performanceHistory.recentSuccesses.shift()
      }

      const successes = this.performanceHistory.recentSuccesses.filter(s => s).length
      this.performanceHistory.successRate =
        successes / this.performanceHistory.recentSuccesses.length
    }
  }

  /**
   * Updates performance metrics with external data
   *
   * @param metrics - Partial performance metrics to update
   */
  updatePerformance(metrics: Partial<PerformanceMetrics>): void {
    this.performanceHistory = { ...this.performanceHistory, ...metrics }
  }

  /**
   * Retrieves current performance metrics
   *
   * @returns Copy of current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceHistory }
  }

  /**
   * Resets performance history to initial state
   */
  override reset(): void {
    this.performanceHistory = {
      successRate: 1.0,
      averageExecutionTime: 0,
      totalIterations: 0,
      recentSuccesses: [],
    }
  }

  /**
   * Updates the adaptation mode for price calculation
   *
   * @param mode - New adaptation mode to use
   */
  setAdaptationMode(mode: 'linear' | 'exponential' | 'logarithmic' | 'performance'): void {
    this.adaptationMode = mode
  }

  /**
   * Gets the current adaptation mode
   *
   * @returns Current adaptation mode
   */
  getAdaptationMode(): string {
    return this.adaptationMode
  }

  /**
   * Updates the price step amount
   *
   * @param step - New price step value
   */
  setPriceStep(step: number): void {
    this.priceStep = step
  }

  /**
   * Gets the current price step
   *
   * @returns Current price step value
   */
  getPriceStep(): number {
    return this.priceStep
  }

  /**
   * Updates the price boundaries
   *
   * @param bounds - New minimum and maximum price bounds
   */
  setBounds(bounds: { min: number; max: number }): void {
    this.bounds = bounds
  }

  /**
   * Gets the current price boundaries
   *
   * @returns Current price bounds or undefined if not set
   */
  getBounds(): { min: number; max: number } | undefined {
    return this.bounds
  }

  /**
   * Updates the performance threshold for performance-based adaptation
   *
   * @param threshold - New threshold value (automatically clamped between 0 and 1)
   */
  setPerformanceThreshold(threshold: number): void {
    this.performanceThreshold = Math.max(0, Math.min(1, threshold))
  }

  /**
   * Gets the current performance threshold
   *
   * @returns Current performance threshold value
   */
  getPerformanceThreshold(): number {
    return this.performanceThreshold
  }
}
