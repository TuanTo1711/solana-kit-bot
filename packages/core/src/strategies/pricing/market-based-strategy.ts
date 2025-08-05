/**
 * @fileoverview Market-based strategy - Uses market data to determine prices
 */
import { AbstractPriceStrategy } from './price-strategy'
import type { PriceContext, PriceResult, PriceStrategyConfig } from '~/types'

export interface MarketBasedConfig extends PriceStrategyConfig {
  /** Pricing method based on market data */
  method: 'current' | 'average' | 'high' | 'low' | 'vwap' | 'trend'
  /** Adjustment factor (multiplier) */
  adjustmentFactor?: number
  /** Fallback price if no market data */
  fallbackPrice: number
  /** Use volume-weighted average price */
  useVWAP?: boolean
  /** Trend sensitivity (for trend method) */
  trendSensitivity?: number
}

/**
 * Market-Based Strategy
 * Uses real market data to determine pricing
 */
export class MarketBasedStrategy extends AbstractPriceStrategy {
  private method: 'current' | 'average' | 'high' | 'low' | 'vwap' | 'trend'
  private adjustmentFactor: number
  private fallbackPrice: number
  private trendSensitivity: number

  constructor(config: MarketBasedConfig) {
    super('MarketBased', config)
    this.method = config.method
    this.adjustmentFactor = config.adjustmentFactor || 1.0
    this.fallbackPrice = config.fallbackPrice
    this.trendSensitivity = config.trendSensitivity || 1.0
  }

  calculatePrice(context: PriceContext): PriceResult {
    const marketData = context.marketData

    // Check if market data is available
    if (!marketData) {
      return this.createResult(
        this.fallbackPrice,
        0.1, // Low confidence without market data
        'No market data available, using fallback price',
        {
          strategy: 'marketBased',
          method: this.method,
          usedFallback: true,
          iteration: context.iteration,
        }
      )
    }

    let basePrice: number
    let confidence: number
    let reason: string

    switch (this.method) {
      case 'current':
        basePrice = marketData.currentPrice || this.fallbackPrice
        confidence = marketData.currentPrice ? 0.9 : 0.1
        reason = marketData.currentPrice
          ? 'Current market price'
          : 'Fallback price (no current price)'
        break

      case 'high':
        basePrice = marketData.high24h || this.fallbackPrice
        confidence = marketData.high24h ? 0.7 : 0.1
        reason = marketData.high24h ? '24h high price' : 'Fallback price (no high price)'
        break

      case 'low':
        basePrice = marketData.low24h || this.fallbackPrice
        confidence = marketData.low24h ? 0.7 : 0.1
        reason = marketData.low24h ? '24h low price' : 'Fallback price (no low price)'
        break

      case 'average':
        if (marketData.high24h && marketData.low24h) {
          basePrice = (marketData.high24h + marketData.low24h) / 2
          confidence = 0.8
          reason = 'Average of 24h high and low'
        } else {
          basePrice = marketData.currentPrice || this.fallbackPrice
          confidence = marketData.currentPrice ? 0.6 : 0.1
          reason = marketData.currentPrice ? 'Current price (no high/low data)' : 'Fallback price'
        }
        break

      case 'vwap':
        basePrice = this.calculateVWAP(marketData)
        confidence = basePrice !== this.fallbackPrice ? 0.85 : 0.1
        reason =
          basePrice !== this.fallbackPrice
            ? 'Volume-weighted average price'
            : 'Fallback price (insufficient VWAP data)'
        break

      case 'trend':
        basePrice = this.calculateTrendPrice(marketData, context)
        confidence = basePrice !== this.fallbackPrice ? 0.75 : 0.1
        reason =
          basePrice !== this.fallbackPrice
            ? 'Trend-adjusted price'
            : 'Fallback price (no trend data)'
        break

      default:
        basePrice = this.fallbackPrice
        confidence = 0.1
        reason = 'Unknown method, using fallback price'
    }

    // Apply adjustment factor
    const adjustedPrice = basePrice * this.adjustmentFactor

    return this.createResult(
      adjustedPrice,
      confidence,
      `${reason} (adjusted by ${this.adjustmentFactor}x)`,
      {
        strategy: 'marketBased',
        method: this.method,
        basePrice,
        adjustmentFactor: this.adjustmentFactor,
        marketData: {
          currentPrice: marketData.currentPrice,
          high24h: marketData.high24h,
          low24h: marketData.low24h,
          volume24h: marketData.volume24h,
          priceChange24h: marketData.priceChange24h,
        },
        iteration: context.iteration,
      }
    )
  }

  private calculateVWAP(marketData: any): number {
    // Simplified VWAP calculation
    // In real implementation, you'd need historical price/volume data
    if (marketData.currentPrice && marketData.volume24h) {
      // Approximate VWAP using current price and volume
      return marketData.currentPrice
    }
    return this.fallbackPrice
  }

  private calculateTrendPrice(marketData: any, _: PriceContext): number {
    if (!marketData.priceChange24h || !marketData.currentPrice) {
      return this.fallbackPrice
    }

    // Apply trend sensitivity
    const trendAdjustment = (marketData.priceChange24h / 100) * this.trendSensitivity
    const trendPrice = marketData.currentPrice * (1 + trendAdjustment)

    return trendPrice
  }

  /**
   * Update pricing method
   */
  setMethod(method: 'current' | 'average' | 'high' | 'low' | 'vwap' | 'trend'): void {
    this.method = method
  }

  /**
   * Get current pricing method
   */
  getMethod(): string {
    return this.method
  }

  /**
   * Update adjustment factor
   */
  setAdjustmentFactor(factor: number): void {
    this.adjustmentFactor = factor
  }

  /**
   * Get current adjustment factor
   */
  getAdjustmentFactor(): number {
    return this.adjustmentFactor
  }

  /**
   * Update fallback price
   */
  setFallbackPrice(price: number): void {
    this.fallbackPrice = price
  }

  /**
   * Get fallback price
   */
  getFallbackPrice(): number {
    return this.fallbackPrice
  }

  /**
   * Set trend sensitivity
   */
  setTrendSensitivity(sensitivity: number): void {
    this.trendSensitivity = sensitivity
  }

  /**
   * Get trend sensitivity
   */
  getTrendSensitivity(): number {
    return this.trendSensitivity
  }
}
