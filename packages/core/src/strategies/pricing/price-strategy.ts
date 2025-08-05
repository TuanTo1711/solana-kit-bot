/**
 * @fileoverview Base price strategy interface and types
 */

import type { PriceContext, PriceResult, PriceStrategy, PriceStrategyConfig } from '~/types'

/**
 * Abstract base class for price strategies
 */
export abstract class AbstractPriceStrategy implements PriceStrategy {
  public readonly name: string
  public config: PriceStrategyConfig

  constructor(name: string, config: PriceStrategyConfig = {}) {
    this.name = name
    this.config = {
      minPrice: 0,
      maxPrice: Number.MAX_SAFE_INTEGER,
      precision: 6,
      enableLogging: false,
      ...config,
    }
  }

  abstract calculatePrice(context: PriceContext): Promise<PriceResult> | PriceResult

  validatePrice(price: number, _: PriceContext): boolean {
    if (isNaN(price) || !isFinite(price)) {
      return false
    }

    if (this.config.minPrice !== undefined && price < this.config.minPrice) {
      return false
    }

    if (this.config.maxPrice !== undefined && price > this.config.maxPrice) {
      return false
    }

    return true
  }

  reset(): void {
    // Default implementation - override if needed
  }

  /**
   * Helper method to format price with precision
   */
  protected formatPrice(price: number): number {
    const precision = this.config.precision || 6
    return Number(price.toFixed(precision))
  }

  /**
   * Helper method to clamp price within bounds
   */
  protected clampPrice(price: number): number {
    let clampedPrice = price

    if (this.config.minPrice !== undefined) {
      clampedPrice = Math.max(clampedPrice, this.config.minPrice)
    }

    if (this.config.maxPrice !== undefined) {
      clampedPrice = Math.min(clampedPrice, this.config.maxPrice)
    }

    return this.formatPrice(clampedPrice)
  }

  /**
   * Helper method to create price result
   */
  protected createResult(
    price: number,
    confidence: number,
    reason: string,
    metadata?: Record<string, any>
  ): PriceResult {
    return {
      price: this.clampPrice(price),
      confidence: Math.max(0, Math.min(1, confidence)),
      reason,
      ...(metadata && { metadata }),
      timestamp: Date.now(),
    }
  }
}
