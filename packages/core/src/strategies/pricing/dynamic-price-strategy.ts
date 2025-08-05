/**
 * @fileoverview Dynamic price strategy - Adjusts based on iteration and performance
 */

import { AbstractPriceStrategy } from './price-strategy'
import type { PriceContext, PriceResult, PriceStrategyConfig } from '~/types'

export interface DynamicPriceConfig extends PriceStrategyConfig {
  /** Starting price */
  startPrice: number
  /** Price adjustment per iteration */
  priceStep?: number
  /** Maximum price change per iteration (percentage) */
  maxChangePerIteration?: number
  /** Adaptation mode */
  adaptationMode: 'linear' | 'exponential' | 'logarithmic' | 'performance'
  /** Performance threshold for adaptation */
  performanceThreshold?: number
  /** Price bounds */
  bounds?: {
    min: number
    max: number
  }
}

interface PerformanceMetrics {
  successRate: number
  averageExecutionTime: number
  totalIterations: number
  recentSuccesses: boolean[]
}

/**
 * Dynamic Price Strategy
 * Adjusts price dynamically based on iteration count and performance metrics
 */
export class DynamicPriceStrategy extends AbstractPriceStrategy {
  private startPrice: number
  private priceStep: number
  private maxChangePerIteration: number
  private adaptationMode: 'linear' | 'exponential' | 'logarithmic' | 'performance'
  private performanceThreshold: number
  private bounds?: DynamicPriceConfig['bounds']
  private performanceHistory: PerformanceMetrics

  constructor(config: DynamicPriceConfig) {
    super('DynamicPrice', config)
    this.startPrice = config.startPrice
    this.priceStep = config.priceStep || 0.001
    this.maxChangePerIteration = config.maxChangePerIteration || 5 // 5%
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

  calculatePrice(context: PriceContext): PriceResult {
    let newPrice: number
    let confidence: number
    let reason: string

    // Update performance metrics
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

    // Apply bounds if configured
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

  private calculateLinearPrice(context: PriceContext): number {
    return this.startPrice + this.priceStep * context.iteration
  }

  private calculateExponentialPrice(context: PriceContext): number {
    const growthRate = this.priceStep / this.startPrice // Convert to percentage
    return this.startPrice * Math.pow(1 + growthRate, context.iteration)
  }

  private calculateLogarithmicPrice(context: PriceContext): number {
    if (context.iteration === 0) return this.startPrice

    const logFactor = Math.log(context.iteration + 1)
    return this.startPrice + this.priceStep * logFactor
  }

  private calculatePerformanceBasedPrice(context: PriceContext): number {
    const basePrice = context.previousPrice || this.startPrice

    // Adjust based on success rate
    let adjustment = 0

    if (this.performanceHistory.successRate > this.performanceThreshold) {
      // High success rate - increase price
      adjustment =
        this.priceStep * (this.performanceHistory.successRate - this.performanceThreshold)
    } else {
      // Low success rate - decrease price
      adjustment =
        -this.priceStep * (this.performanceThreshold - this.performanceHistory.successRate)
    }

    // Apply max change limit
    const maxChange = basePrice * (this.maxChangePerIteration / 100)
    adjustment = Math.max(-maxChange, Math.min(maxChange, adjustment))

    return basePrice + adjustment
  }

  private updatePerformanceMetrics(context: PriceContext): void {
    // This would be updated by the runner with actual performance data
    // For now, we'll simulate some metrics based on context

    this.performanceHistory.totalIterations = context.iteration

    // Simulate success based on metadata (if available)
    if (context.metadata?.['lastOperationSuccess'] !== undefined) {
      const success = context.metadata['lastOperationSuccess']
      this.performanceHistory.recentSuccesses.push(success)

      // Keep only last 10 results
      if (this.performanceHistory.recentSuccesses.length > 10) {
        this.performanceHistory.recentSuccesses.shift()
      }

      // Calculate success rate
      const successes = this.performanceHistory.recentSuccesses.filter(s => s).length
      this.performanceHistory.successRate =
        successes / this.performanceHistory.recentSuccesses.length
    }
  }

  /**
   * Update performance metrics externally
   */
  updatePerformance(metrics: Partial<PerformanceMetrics>): void {
    this.performanceHistory = { ...this.performanceHistory, ...metrics }
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceHistory }
  }

  /**
   * Reset performance history
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
   * Update adaptation mode
   */
  setAdaptationMode(mode: 'linear' | 'exponential' | 'logarithmic' | 'performance'): void {
    this.adaptationMode = mode
  }

  /**
   * Get current adaptation mode
   */
  getAdaptationMode(): string {
    return this.adaptationMode
  }

  /**
   * Update price step
   */
  setPriceStep(step: number): void {
    this.priceStep = step
  }

  /**
   * Get current price step
   */
  getPriceStep(): number {
    return this.priceStep
  }

  /**
   * Update bounds
   */
  setBounds(bounds: { min: number; max: number }): void {
    this.bounds = bounds
  }

  /**
   * Get current bounds
   */
  getBounds(): { min: number; max: number } | undefined {
    return this.bounds
  }

  /**
   * Update performance threshold
   */
  setPerformanceThreshold(threshold: number): void {
    this.performanceThreshold = Math.max(0, Math.min(1, threshold))
  }

  /**
   * Get performance threshold
   */
  getPerformanceThreshold(): number {
    return this.performanceThreshold
  }
}
