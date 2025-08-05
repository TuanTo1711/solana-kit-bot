/**
 * @fileoverview Random percentage strategy - Adjusts price by random percentage from base price
 */

import { AbstractPriceStrategy } from './price-strategy'
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
 * Adjusts price by a random percentage from a base price
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

  calculatePrice(context: PriceContext): PriceResult {
    // Determine base price
    let currentBasePrice = this.basePrice

    if (this.usePreviousPrice && context.previousPrice !== undefined) {
      currentBasePrice = context.previousPrice
    } else if (this.usePreviousPrice && context.previousPrice === undefined) {
      currentBasePrice = this.fallbackBasePrice
    }

    // Generate random percentage
    const percentageRange = this.maxPercentage - this.minPercentage
    const randomPercentage = this.minPercentage + Math.random() * percentageRange

    // Calculate new price
    const priceChange = currentBasePrice * (randomPercentage / 100)
    const newPrice = currentBasePrice + priceChange

    // Calculate confidence based on how close to base price
    const changeRatio = Math.abs(priceChange) / currentBasePrice
    const confidence = Math.max(0.1, 1 - changeRatio) // Lower confidence for bigger changes

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
   * Update base price
   */
  setBasePrice(price: number): void {
    this.basePrice = price
  }

  /**
   * Get current base price
   */
  getBasePrice(): number {
    return this.basePrice
  }

  /**
   * Update percentage range
   */
  setPercentageRange(min: number, max: number): void {
    if (min > max) {
      throw new Error('Minimum percentage must be less than or equal to maximum percentage')
    }
    this.minPercentage = min
    this.maxPercentage = max
  }

  /**
   * Get current percentage range
   */
  getPercentageRange(): { min: number; max: number } {
    return {
      min: this.minPercentage,
      max: this.maxPercentage,
    }
  }

  /**
   * Enable/disable using previous price as base
   */
  setUsePreviousPrice(use: boolean): void {
    this.usePreviousPrice = use
  }

  /**
   * Check if using previous price as base
   */
  isUsingPreviousPrice(): boolean {
    return this.usePreviousPrice
  }

  /**
   * Set fallback base price
   */
  setFallbackBasePrice(price: number): void {
    this.fallbackBasePrice = price
  }

  /**
   * Get fallback base price
   */
  getFallbackBasePrice(): number {
    return this.fallbackBasePrice
  }
}
