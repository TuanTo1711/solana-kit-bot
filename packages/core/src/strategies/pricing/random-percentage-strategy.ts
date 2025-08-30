import { AbstractPriceStrategy } from '~/abstract'
import type { PriceContext, PriceResult, PriceStrategyConfig } from '~/types'

export interface RandomPercentageConfig extends PriceStrategyConfig {
  /** Base price to apply percentage to */
  basePrice: number
  /** Minimum percentage change (can be negative) */
  minPercentage: number
  /** Maximum percentage change */
  maxPercentage: number
  /** Use previous price as base (overrides basePrice) */
  usePreviousPrice?: boolean
  /** Fallback base price if no previous price available */
  fallbackBasePrice?: number
}

/**
 * Random Percentage Strategy
 *
 * Adjusts price by a random percentage from a base price. The strategy generates
 * a random percentage between the configured min and max values and applies it
 * to either a fixed base price or the previous price from context.
 *
 * @example
 * ```typescript
 * const strategy = new RandomPercentageStrategy({
 *   basePrice: 100,
 *   minPercentage: -10,
 *   maxPercentage: 15,
 *   usePreviousPrice: true,
 *   fallbackBasePrice: 100
 * })
 *
 * const result = strategy.calculatePrice(context)
 * // Returns price with random adjustment between -10% and +15%
 * ```
 */
export class RandomPercentageStrategy extends AbstractPriceStrategy {
  private basePrice: number
  private minPercentage: number
  private maxPercentage: number
  private usePreviousPrice: boolean
  private fallbackBasePrice: number

  constructor(config: RandomPercentageConfig) {
    super('RandomPercentage', config)
    this.basePrice = config.basePrice
    this.minPercentage = config.minPercentage
    this.maxPercentage = config.maxPercentage
    this.usePreviousPrice = config.usePreviousPrice || false
    this.fallbackBasePrice = config.fallbackBasePrice || config.basePrice
  }

  /**
   * Calculate new price with random percentage adjustment
   *
   * @param context - Price calculation context containing previous price and iteration info
   * @returns Price result with calculated price, confidence, and metadata
   */
  calculatePrice(context: PriceContext): PriceResult {
    let currentBasePrice = this.basePrice

    if (this.usePreviousPrice && context.previousPrice !== undefined) {
      currentBasePrice = context.previousPrice
    } else if (this.usePreviousPrice && context.previousPrice === undefined) {
      currentBasePrice = this.fallbackBasePrice
    }

    const percentageRange = this.maxPercentage - this.minPercentage
    const randomPercentage = this.minPercentage + Math.random() * percentageRange

    const priceChange = currentBasePrice * (randomPercentage / 100)
    const newPrice = currentBasePrice + priceChange

    const changeRatio = Math.abs(priceChange) / currentBasePrice
    const confidence = Math.max(0.1, 1 - changeRatio)

    return this.createResult(
      newPrice,
      confidence,
      `${randomPercentage >= 0 ? '+' : ''}${randomPercentage.toFixed(2)}% from base ${currentBasePrice}`,
      {
        strategy: 'randomPercentage',
        basePrice: currentBasePrice,
        percentage: randomPercentage,
        priceChange,
        usedPreviousPrice: this.usePreviousPrice && context.previousPrice !== undefined,
        iteration: context.iteration,
      }
    )
  }

  /**
   * Update the base price used for percentage calculations
   *
   * @param price - New base price
   */
  setBasePrice(price: number): void {
    this.basePrice = price
  }

  /**
   * Get the current base price
   *
   * @returns Current base price
   */
  getBasePrice(): number {
    return this.basePrice
  }

  /**
   * Update the percentage range for random adjustments
   *
   * @param min - Minimum percentage (can be negative)
   * @param max - Maximum percentage
   * @throws Error if min > max
   */
  setPercentageRange(min: number, max: number): void {
    if (min > max) {
      throw new Error('Minimum percentage must be less than or equal to maximum percentage')
    }
    this.minPercentage = min
    this.maxPercentage = max
  }

  /**
   * Get the current percentage range
   *
   * @returns Object containing min and max percentage values
   */
  getPercentageRange(): { min: number; max: number } {
    return {
      min: this.minPercentage,
      max: this.maxPercentage,
    }
  }

  /**
   * Enable or disable using previous price as base
   *
   * @param use - Whether to use previous price from context
   */
  setUsePreviousPrice(use: boolean): void {
    this.usePreviousPrice = use
  }

  /**
   * Check if strategy is configured to use previous price as base
   *
   * @returns True if using previous price, false otherwise
   */
  isUsingPreviousPrice(): boolean {
    return this.usePreviousPrice
  }

  /**
   * Set the fallback base price used when previous price is unavailable
   *
   * @param price - Fallback base price
   */
  setFallbackBasePrice(price: number): void {
    this.fallbackBasePrice = price
  }

  /**
   * Get the current fallback base price
   *
   * @returns Current fallback base price
   */
  getFallbackBasePrice(): number {
    return this.fallbackBasePrice
  }
}
