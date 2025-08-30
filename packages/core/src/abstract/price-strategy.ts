import type { PriceContext, PriceResult, PriceStrategy, PriceStrategyConfig } from '~/types'

/**
 * Abstract base class for implementing price calculation strategies.
 *
 * Provides a foundation for all price calculation strategies with common functionality
 * including price validation, formatting, result creation, and bound clamping.
 * All concrete price strategy implementations should extend this class to ensure
 * consistent behavior and type safety.
 *
 * @abstract
 * @implements {PriceStrategy}
 *
 * @example
 * ```typescript
 * class MyPriceStrategy extends AbstractPriceStrategy {
 *   constructor() {
 *     super('my-strategy', { minPrice: 10, maxPrice: 1000 })
 *   }
 *
 *   calculatePrice(context: PriceContext): PriceResult {
 *     const price = context.basePrice * 1.1
 *     return this.createResult(price, 0.8, 'Applied 10% markup')
 *   }
 * }
 * ```
 */
export abstract class AbstractPriceStrategy implements PriceStrategy {
  /** The unique name identifier for this strategy */
  public readonly name: string

  /** Configuration options for the strategy */
  public config: PriceStrategyConfig

  /**
   * Creates a new price strategy instance.
   *
   * @param {string} name - Unique identifier for the strategy
   * @param {PriceStrategyConfig} [config] - Optional configuration overrides
   */
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

  /**
   * Calculates the price based on the given context.
   *
   * Must be implemented by concrete strategy classes to define their specific
   * price calculation logic. The method can be synchronous or asynchronous.
   *
   * @abstract
   * @param {PriceContext} context - The pricing context containing input data
   * @returns {Promise<PriceResult> | PriceResult} The calculated price result
   */
  abstract calculatePrice(context: PriceContext): Promise<PriceResult> | PriceResult

  /**
   * Validates if a calculated price is within acceptable bounds.
   *
   * Checks if the price is a valid number and falls within the configured
   * minimum and maximum price boundaries.
   *
   * @param {number} price - The price to validate
   * @param {PriceContext} _ - The price context (unused in base implementation)
   * @returns {boolean} True if the price is valid, false otherwise
   */
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

  /**
   * Resets the strategy to its initial state.
   *
   * Override this method if your strategy maintains internal state that needs
   * to be cleared or reset between calculation sessions.
   */
  reset(): void {
    // Default implementation - override if needed
  }

  /**
   * Formats a price value according to the configured precision.
   *
   * @param price - The raw price value
   * @returns The formatted price with proper decimal precision
   */
  protected formatPrice(price: number): number {
    const precision = this.config.precision || 6
    return Number(price.toFixed(precision))
  }

  /**
   * Clamps a price value within the configured minimum and maximum bounds.
   *
   * @param price - The price to clamp
   * @returns The clamped and formatted price
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
   * Creates a standardized price result object.
   *
   * Constructs a complete price result with automatic price clamping,
   * confidence normalization, and timestamp assignment.
   *
   * @protected
   * @param {number} price - The calculated price before clamping
   * @param {number} confidence - Confidence level (0-1) in the price calculation
   * @param {string} reason - Human-readable explanation for the price
   * @param {Record<string, any>} [metadata] - Optional additional data about the calculation
   * @returns {PriceResult} A complete PriceResult object with clamped price and normalized confidence
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
