import { AbstractPriceStrategy } from '~/abstract'
import type { PriceContext, PriceResult, PriceStrategyConfig } from '~/types'

/**
 * Configuration for Fixed Price Strategy
 */
export interface FixedPriceConfig extends PriceStrategyConfig {
  /** Fixed price to always return */
  fixedPrice: number
}

/**
 * Fixed Price Strategy
 *
 * A simple pricing strategy that always returns the same predetermined price
 * regardless of iteration count or context. This strategy provides maximum
 * predictability and consistency.
 *
 * @example
 * ```typescript
 * const fixedStrategy = new FixedPriceStrategy({
 *   fixedPrice: 0.05
 * })
 *
 * const result = fixedStrategy.calculatePrice({ iteration: 10 })
 * console.log(result.price) // Always 0.05
 * ```
 */
export class FixedPriceStrategy extends AbstractPriceStrategy {
  private fixedPrice: number

  /**
   * Creates a new Fixed Price Strategy instance
   *
   * @param config - Configuration object containing the fixed price
   */
  constructor(config: FixedPriceConfig) {
    super('FixedPrice', {
      maxPrice: config.fixedPrice,
      minPrice: config.fixedPrice,
      enableLogging: true,
    })
    this.fixedPrice = config.fixedPrice
  }

  /**
   * Calculates the price for the current iteration
   *
   * @param context - Current pricing context (ignored in fixed strategy)
   * @returns Price result with the fixed price and maximum confidence
   */
  calculatePrice(context: PriceContext): PriceResult {
    return this.createResult(this.fixedPrice, 1.0, `Fixed price: ${this.fixedPrice}`, {
      strategy: 'fixed',
      iteration: context.iteration,
    })
  }

  /**
   * Updates the fixed price value
   *
   * @param price - New fixed price to use
   */
  setFixedPrice(price: number): void {
    this.fixedPrice = price
  }

  /**
   * Retrieves the current fixed price
   *
   * @returns The current fixed price value
   */
  getFixedPrice(): number {
    return this.fixedPrice
  }
}
