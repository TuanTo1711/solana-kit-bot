/**
 * @fileoverview Random price strategy - Generates random prices within a range using different distributions.
 */

import { AbstractPriceStrategy } from './price-strategy'
import type { PriceContext, PriceResult, PriceStrategyConfig } from '~/types'

/**
 * Configuration interface for RandomPriceStrategy
 * @interface RandomPriceConfig
 * @extends PriceStrategyConfig
 */
export interface RandomPriceConfig extends PriceStrategyConfig {
  /** Distribution type for random price generation */
  distribution?: 'uniform' | 'normal' | 'exponential' | 'beta' | 'lognormal' | 'cauchy'
  /** Seed for deterministic random number generation */
  seed?: number
  /** Lambda parameter for exponential distribution (controls decay rate) */
  lambda?: number // only for exponential distribution
  /** Alpha parameter for beta distribution (shape parameter) */
  alpha?: number // only for beta distribution
  /** Beta parameter for beta distribution (shape parameter) */
  beta?: number // only for beta distribution
  /** Mu parameter for log-normal distribution (mean of underlying normal) */
  mu?: number // only for log-normal distribution
  /** Sigma parameter for log-normal distribution (std dev of underlying normal) */
  sigma?: number // only for log-normal distribution
  /** Location parameter for Cauchy distribution (median) */
  location?: number // only for Cauchy distribution
  /** Scale parameter for Cauchy distribution (half-width at half-maximum) */
  scale?: number // only for Cauchy distribution
}

/**
 * Random Price Strategy
 *
 * Generates random prices within a specified range using different probability distributions.
 * Supports uniform, normal (Gaussian), exponential, beta, log-normal, and Cauchy distributions for varied price patterns.
 *
 * @example
 * ```typescript
 * // Uniform distribution (default)
 * const uniformStrategy = new RandomPriceStrategy({
 *   minPrice: 1.0,
 *   maxPrice: 5.0,
 *   precision: 9
 * });
 *
 * // Normal distribution with custom seed
 * const normalStrategy = new RandomPriceStrategy({
 *   minPrice: 1.0,
 *   maxPrice: 5.0,
 *   distribution: 'normal',
 *   seed: 12345,
 *   precision: 9
 * });
 *
 * // Exponential distribution with custom lambda
 * const expStrategy = new RandomPriceStrategy({
 *   minPrice: 0.1,
 *   maxPrice: 2.0,
 *   distribution: 'exponential',
 *   lambda: 0.5,
 *   precision: 9
 * });
 *
 * // Beta distribution with shape parameters
 * const betaStrategy = new RandomPriceStrategy({
 *   minPrice: 1.0,
 *   maxPrice: 10.0,
 *   distribution: 'beta',
 *   alpha: 2,
 *   beta: 5,
 *   precision: 9
 * });
 *
 * // Log-normal distribution
 * const lognormalStrategy = new RandomPriceStrategy({
 *   minPrice: 0.5,
 *   maxPrice: 20.0,
 *   distribution: 'lognormal',
 *   mu: 0,
 *   sigma: 1,
 *   precision: 9
 * });
 *
 * // Cauchy distribution with location and scale
 * const cauchyStrategy = new RandomPriceStrategy({
 *   minPrice: 0.1,
 *   maxPrice: 5.0,
 *   distribution: 'cauchy',
 *   location: 0,
 *   scale: 1,
 *   precision: 9
 * });
 * ```
 *
 * @class RandomPriceStrategy
 * @extends AbstractPriceStrategy
 */
export class RandomPriceStrategy extends AbstractPriceStrategy {
  /** The probability distribution type used for price generation */
  private readonly distribution:
    | 'uniform'
    | 'normal'
    | 'exponential'
    | 'beta'
    | 'lognormal'
    | 'cauchy'
  /** Random number generator function (seeded or Math.random) */
  private readonly rng: () => number
  /** Lambda parameter for exponential distribution */
  private readonly lambda: number
  /** Alpha parameter for beta distribution */
  private readonly alpha: number
  /** Beta parameter for beta distribution */
  private readonly betaParam: number
  /** Mu parameter for log-normal distribution */
  private readonly mu: number
  /** Sigma parameter for log-normal distribution */
  private readonly sigma: number
  /** Location parameter for Cauchy distribution */
  private readonly location: number
  /** Scale parameter for Cauchy distribution */
  private readonly scale: number

  /**
   * Creates a new RandomPriceStrategy instance
   *
   * @param {RandomPriceConfig} config - Configuration object
   * @throws {Error} When minPrice >= maxPrice or invalid price range
   *
   * @example
   * ```typescript
   * const strategy = new RandomPriceStrategy({
   *   minPrice: 1.0,
   *   maxPrice: 5.0,
   *   distribution: 'normal',
   *   precision: 9,
   *   enableLogging: true
   * });
   * ```
   */
  constructor(config: RandomPriceConfig) {
    super('RandomPrice', config)

    if (
      typeof config.minPrice !== 'number' ||
      typeof config.maxPrice !== 'number' ||
      config.minPrice >= config.maxPrice
    ) {
      throw new Error('Invalid price range: minPrice must be less than maxPrice')
    }

    this.config.minPrice = config.minPrice
    this.config.maxPrice = config.maxPrice
    this.config.precision = config.precision || 0
    this.distribution = config.distribution || 'uniform'
    this.lambda = config.lambda || 2
    this.alpha = config.alpha || 1
    this.betaParam = config.beta || 1
    this.mu = config.mu || 0
    this.sigma = config.sigma || 1
    this.location = config.location || 0
    this.scale = config.scale || 1

    this.rng = config.seed !== undefined ? this.createSeededRNG(config.seed) : Math.random
  }

  /**
   * Calculates a random price based on the configured distribution
   *
   * @param {PriceContext} context - Context containing iteration and timestamp information
   * @returns {PriceResult} Result containing the generated price and metadata
   *
   * @example
   * ```typescript
   * const context = { iteration: 1, timestamp: Date.now() };
   * const result = strategy.calculatePrice(context);
   * console.log(`Generated price: ${result.price}`);
   * ```
   */
  calculatePrice(context: PriceContext): PriceResult {
    const price = this.generatePrice().toFixed(this.config.precision)
    const confidence = this.getConfidence()

    return this.createResult(
      Number(price),
      confidence,
      `Random ${this.distribution} price between ${this.min} and ${this.max}`,
      {
        strategy: 'random',
        distribution: this.distribution,
        range: [this.min, this.max],
        iteration: context.iteration,
      }
    )
  }

  /**
   * Validates if a price falls within the configured range
   *
   * @param {number} price - Price to validate
   * @returns {boolean} True if price is within [minPrice, maxPrice] range
   *
   * @example
   * ```typescript
   * const isValid = strategy.validatePrice(2.5); // true if 2.5 is within range
   * ```
   */
  override validatePrice(price: number): boolean {
    return price >= this.min && price <= this.max
  }

  /**
   * Generates a random price using the configured distribution
   *
   * @private
   * @returns {number} Generated price within the specified range
   */
  private generatePrice(): number {
    switch (this.distribution) {
      case 'normal':
        return this.generateNormalDistribution()
      case 'exponential':
        return this.generateExponentialDistribution()
      case 'beta':
        return this.generateBetaDistribution()
      case 'lognormal':
        return this.generateLogNormalDistribution()
      case 'cauchy':
        return this.generateCauchyDistribution()
      case 'uniform':
      default:
        return this.generateUniformDistribution()
    }
  }

  /**
   * Generates a uniformly distributed random price
   *
   * All values within the range have equal probability of being selected.
   *
   * @private
   * @returns {number} Uniformly distributed price
   */
  private generateUniformDistribution(): number {
    return this.min + this.rng() * (this.max - this.min)
  }

  /**
   * Generates a normally distributed random price using Box-Muller transform
   *
   * Prices cluster around the midpoint with decreasing probability toward extremes.
   * Uses 3-sigma rule (99.7% of values within range).
   *
   * @private
   * @returns {number} Normally distributed price, clamped to range
   */
  private generateNormalDistribution(): number {
    const u1 = this.rng()
    const u2 = this.rng()
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)

    const mean = (this.min + this.max) / 2
    const std = (this.max - this.min) / 6 // 99.7% within range

    const raw = mean + z0 * std
    return Math.min(this.max, Math.max(this.min, raw)) // clamp
  }

  /**
   * Generates an exponentially distributed random price
   *
   * Higher probability for lower values, with exponential decay toward maximum.
   * Useful for simulating natural price distributions where lower prices are more common.
   *
   * @private
   * @returns {number} Exponentially distributed price
   */
  private generateExponentialDistribution(): number {
    const u = 1 - this.rng() // avoid log(0)
    const exp = -Math.log(u) / this.lambda
    const normalized = Math.min(1, exp / 3) // cap tail
    return this.min + normalized * (this.max - this.min)
  }

  /**
   * Generates a beta distributed random price
   *
   * Flexible distribution bounded between 0 and 1, then scaled to price range.
   * Shape controlled by alpha and beta parameters.
   * Useful for modeling bounded price movements with various skewness patterns.
   *
   * @private
   * @returns {number} Beta distributed price
   */
  private generateBetaDistribution(): number {
    // Generate beta distribution using gamma distributions
    const x = this.generateGamma(this.alpha, 1)
    const y = this.generateGamma(this.betaParam, 1)
    const beta = x / (x + y)

    return this.min + beta * (this.max - this.min)
  }

  /**
   * Generates a log-normal distributed random price
   *
   * Prices follow a log-normal distribution where the logarithm is normally distributed.
   * Useful for modeling multiplicative processes and asset prices.
   *
   * @private
   * @returns {number} Log-normal distributed price, clamped to range
   */
  private generateLogNormalDistribution(): number {
    // Generate normal random variable
    const u1 = this.rng()
    const u2 = this.rng()
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)

    // Transform to log-normal
    const lognormal = Math.exp(this.mu + this.sigma * z0)

    // Normalize to [0,1] range using sigmoid-like transformation
    const normalized = lognormal / (1 + lognormal)

    return this.min + normalized * (this.max - this.min)
  }

  /**
   * Generates a Cauchy distributed random price
   *
   * Heavy-tailed distribution with undefined mean and variance.
   * Useful for modeling extreme price movements and market volatility.
   *
   * @private
   * @returns {number} Cauchy distributed price, clamped to range
   */
  private generateCauchyDistribution(): number {
    const u = this.rng()
    const cauchy = this.location + this.scale * Math.tan(Math.PI * (u - 0.5))

    // Normalize using arctangent to map to [0,1]
    const normalized = Math.atan((cauchy - this.location) / this.scale) / Math.PI + 0.5
    const clamped = Math.min(1, Math.max(0, normalized))

    return this.min + clamped * (this.max - this.min)
  }

  /**
   * Generates a gamma distributed random variable using Marsaglia and Tsang's method
   *
   * @private
   * @param {number} shape - Shape parameter (alpha)
   * @param {number} scale - Scale parameter
   * @returns {number} Gamma distributed random variable
   */
  private generateGamma(shape: number, scale: number): number {
    if (shape < 1) {
      // Use Ahrens-Dieter acceptance-rejection method for shape < 1
      const d = ((1 - shape) * Math.pow(shape, shape / (1 - shape))) / (1 - shape)

      while (true) {
        const u = this.rng()
        const v = this.rng()
        const w = u * d
        const eta = v * Math.pow(w, shape - 1)
        const zeta = Math.pow(w, shape) - eta

        if (zeta + (eta * Math.E) / shape >= 1) {
          continue
        }

        if (zeta >= Math.log(eta)) {
          continue
        }

        return w * scale
      }
    } else {
      // Use Marsaglia and Tsang's method for shape >= 1
      const d = shape - 1 / 3
      const c = 1 / Math.sqrt(9 * d)

      while (true) {
        let x: number
        let v: number

        do {
          const u1 = this.rng()
          const u2 = this.rng()
          x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
          v = 1 + c * x
        } while (v <= 0)

        v = v * v * v
        const u = this.rng()

        if (u < 1 - 0.0331 * x * x * x * x) {
          return d * v * scale
        }

        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
          return d * v * scale
        }
      }
    }
  }

  /**
   * Creates a seeded random number generator for deterministic results
   *
   * Uses a linear congruential generator (LCG) algorithm for reproducible sequences.
   *
   * @private
   * @param {number} seed - Seed value for deterministic generation
   * @returns {() => number} Seeded random number generator function
   */
  private createSeededRNG(seed: number): () => number {
    let s = seed
    return () => {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }
  }

  /**
   * Returns confidence level based on distribution type
   *
   * Different distributions have varying levels of predictability:
   * - Uniform: 0.5 (moderate confidence)
   * - Normal: 0.7 (high confidence due to clustering)
   * - Exponential: 0.3 (lower confidence due to skew)
   * - Beta: 0.6 (good confidence, bounded distribution)
   * - Log-normal: 0.4 (moderate-low confidence due to right skew)
   * - Cauchy: 0.2 (low confidence due to heavy tails and undefined moments)
   *
   * @private
   * @returns {number} Confidence level between 0 and 1
   */
  private getConfidence(): number {
    switch (this.distribution) {
      case 'uniform':
        return 0.5
      case 'normal':
        return 0.7
      case 'exponential':
        return 0.3
      case 'beta':
        return 0.6
      case 'lognormal':
        return 0.4
      case 'cauchy':
        return 0.2
      default:
        return 0.5
    }
  }

  /**
   * Gets the minimum price from configuration
   *
   * @private
   * @returns {number} Minimum price value
   */
  private get min(): number {
    return this.config.minPrice!
  }

  /**
   * Gets the maximum price from configuration
   *
   * @private
   * @returns {number} Maximum price value
   */
  private get max(): number {
    return this.config.maxPrice!
  }
}
