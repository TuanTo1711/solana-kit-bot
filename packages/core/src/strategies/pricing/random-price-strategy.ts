import { AbstractPriceStrategy } from '~/abstract'
import type { PriceContext, PriceResult, PriceStrategyConfig } from '~/types'

/**
 * Configuration interface for RandomPriceStrategy
 */
export interface RandomPriceConfig extends PriceStrategyConfig {
  /** Distribution type for random price generation */
  distribution?: 'uniform' | 'normal' | 'exponential' | 'beta' | 'lognormal' | 'cauchy'
  /** Seed for deterministic random number generation */
  seed?: number
  /** Lambda parameter for exponential distribution (controls decay rate) */
  lambda?: number
  /** Alpha parameter for beta distribution (shape parameter) */
  alpha?: number
  /** Beta parameter for beta distribution (shape parameter) */
  beta?: number
  /** Mu parameter for log-normal distribution (mean of underlying normal) */
  mu?: number
  /** Sigma parameter for log-normal distribution (std dev of underlying normal) */
  sigma?: number
  /** Location parameter for Cauchy distribution (median) */
  location?: number
  /** Scale parameter for Cauchy distribution (half-width at half-maximum) */
  scale?: number
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
 * ```
 */
export class RandomPriceStrategy extends AbstractPriceStrategy {
  private readonly distribution:
    | 'uniform'
    | 'normal'
    | 'exponential'
    | 'beta'
    | 'lognormal'
    | 'cauchy'
  private readonly rng: () => number
  private readonly lambda: number
  private readonly alpha: number
  private readonly betaParam: number
  private readonly mu: number
  private readonly sigma: number
  private readonly location: number
  private readonly scale: number

  /**
   * Creates a new RandomPriceStrategy instance
   *
   * @param config - Configuration object
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
   * @param context - Context containing iteration and timestamp information
   * @returns Result containing the generated price and metadata
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
   * @param price - Price to validate
   * @returns True if price is within [minPrice, maxPrice] range
   */
  override validatePrice(price: number): boolean {
    return price >= this.min && price <= this.max
  }

  /**
   * Generates a random price using the configured distribution
   *
   * @returns Generated price within the specified range
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
   * All values within the range have equal probability of being selected
   *
   * @returns Uniformly distributed price
   */
  private generateUniformDistribution(): number {
    return this.min + this.rng() * (this.max - this.min)
  }

  /**
   * Generates a normally distributed random price using Box-Muller transform
   * Prices cluster around the midpoint with decreasing probability toward extremes
   *
   * @returns Normally distributed price, clamped to range
   */
  private generateNormalDistribution(): number {
    const u1 = this.rng()
    const u2 = this.rng()
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)

    const mean = (this.min + this.max) / 2
    const std = (this.max - this.min) / 6

    const raw = mean + z0 * std
    return Math.min(this.max, Math.max(this.min, raw))
  }

  /**
   * Generates an exponentially distributed random price
   * Higher probability for lower values, with exponential decay toward maximum
   *
   * @returns Exponentially distributed price
   */
  private generateExponentialDistribution(): number {
    const u = 1 - this.rng()
    const exp = -Math.log(u) / this.lambda
    const normalized = Math.min(1, exp / 3)
    return this.min + normalized * (this.max - this.min)
  }

  /**
   * Generates a beta distributed random price
   * Flexible distribution bounded between 0 and 1, then scaled to price range
   *
   * @returns Beta distributed price
   */
  private generateBetaDistribution(): number {
    const x = this.generateGamma(this.alpha, 1)
    const y = this.generateGamma(this.betaParam, 1)
    const beta = x / (x + y)

    return this.min + beta * (this.max - this.min)
  }

  /**
   * Generates a log-normal distributed random price
   * Prices follow a log-normal distribution where the logarithm is normally distributed
   *
   * @returns Log-normal distributed price, clamped to range
   */
  private generateLogNormalDistribution(): number {
    const u1 = this.rng()
    const u2 = this.rng()
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)

    const lognormal = Math.exp(this.mu + this.sigma * z0)
    const normalized = lognormal / (1 + lognormal)

    return this.min + normalized * (this.max - this.min)
  }

  /**
   * Generates a Cauchy distributed random price
   * Heavy-tailed distribution with undefined mean and variance
   *
   * @returns Cauchy distributed price, clamped to range
   */
  private generateCauchyDistribution(): number {
    const u = this.rng()
    const cauchy = this.location + this.scale * Math.tan(Math.PI * (u - 0.5))

    const normalized = Math.atan((cauchy - this.location) / this.scale) / Math.PI + 0.5
    const clamped = Math.min(1, Math.max(0, normalized))

    return this.min + clamped * (this.max - this.min)
  }

  /**
   * Generates a gamma distributed random variable using Marsaglia and Tsang's method
   *
   * @param shape - Shape parameter (alpha)
   * @param scale - Scale parameter
   * @returns Gamma distributed random variable
   */
  private generateGamma(shape: number, scale: number): number {
    if (shape < 1) {
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
   * Uses a linear congruential generator (LCG) algorithm for reproducible sequences
   *
   * @param seed - Seed value for deterministic generation
   * @returns Seeded random number generator function
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
   * Different distributions have varying levels of predictability
   *
   * @returns Confidence level between 0 and 1
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
   */
  private get min(): number {
    return this.config.minPrice!
  }

  /**
   * Gets the maximum price from configuration
   */
  private get max(): number {
    return this.config.maxPrice!
  }
}
