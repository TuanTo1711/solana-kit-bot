export interface PriceContext {
  /** Current iteration/cycle number */
  iteration: number
  /** Previous price used (if any) */
  previousPrice?: number
  /** Market data (if available) */
  marketData?: {
    currentPrice?: number
    volume24h?: number
    priceChange24h?: number
    high24h?: number
    low24h?: number
    marketCap?: number
  }
  /** Custom metadata */
  metadata?: Record<string, any>
  /** Timestamp of price calculation */
  timestamp: number
}

export interface PriceResult {
  /** Calculated price */
  price: number
  /** Confidence level (0-1) */
  confidence: number
  /** Reason for this price */
  reason: string
  /** Additional metadata */
  metadata?: Record<string, any>
  /** Timestamp when price was calculated */
  timestamp: number
}

export interface PriceStrategyConfig {
  /** Minimum allowed price */
  minPrice?: number
  /** Maximum allowed price */
  maxPrice?: number
  /** Price precision (decimal places) */
  precision?: number
  /** Custom configuration */
  [key: string]: any
}

/**
 * Base interface for all price strategies
 */
export interface PriceStrategy {
  /** Strategy name for identification */
  readonly name: string

  /** Strategy configuration */
  readonly config: PriceStrategyConfig

  /**
   * Calculate price based on context
   * @param context Current pricing context
   * @returns Price result
   */
  calculatePrice(context: PriceContext): Promise<PriceResult> | PriceResult

  /**
   * Validate if the calculated price is acceptable
   * @param price Calculated price
   * @param context Current context
   * @returns True if price is valid
   */
  validatePrice(price: number, context: PriceContext): boolean

  /**
   * Reset strategy state (if any)
   */
  reset(): void
}
