/**
 * @fileoverview Fixed price strategy - Always returns the same price
 */

import { AbstractPriceStrategy } from './price-strategy'
import type { PriceContext, PriceResult, PriceStrategyConfig } from '~/types'

export interface FixedPriceConfig extends PriceStrategyConfig {
  /** Fixed price to always return */
  fixedPrice: number
}

/**
 * Fixed Price Strategy
 * Always returns the same predetermined price
 */
export class FixedPriceStrategy extends AbstractPriceStrategy {
  private fixedPrice: number

  constructor(config: FixedPriceConfig) {
    super('FixedPrice', {
      maxPrice: config.fixedPrice,
      minPrice: config.fixedPrice,
      enableLogging: true,
    })
    this.fixedPrice = config.fixedPrice
  }

  calculatePrice(context: PriceContext): PriceResult {
    return this.createResult(
      this.fixedPrice,
      1.0, // Maximum confidence since it's fixed
      `Fixed price: ${this.fixedPrice}`,
      {
        strategy: 'fixed',
        iteration: context.iteration,
      }
    )
  }

  /**
   * Update the fixed price
   */
  setFixedPrice(price: number): void {
    this.fixedPrice = price
  }

  /**
   * Get current fixed price
   */
  getFixedPrice(): number {
    return this.fixedPrice
  }
}
