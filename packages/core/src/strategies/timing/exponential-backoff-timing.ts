import type { ExecutionContext, TimingStrategy } from '~/types'

/**
 * Exponential backoff timing strategy that increases delay between retries exponentially.
 *
 * This strategy calculates delays using the formula:
 * delay = min(baseInterval * multiplier^failedExecutions, maxInterval)
 *
 * @example
 * ```typescript
 * const timing = new ExponentialBackoffTiming(1000, 30000, 2)
 * // First retry: 1000ms
 * // Second retry: 2000ms
 * // Third retry: 4000ms
 * // Fourth retry: 8000ms
 * // etc., capped at 30000ms
 * ```
 */
export class ExponentialBackoffTiming implements TimingStrategy {
  private baseInterval: number
  private maxInterval: number
  private multiplier: number

  /**
   * Creates a new exponential backoff timing strategy.
   *
   * @param baseInterval - Initial delay in milliseconds for the first retry
   * @param maxInterval - Maximum delay cap in milliseconds (default: 60000ms)
   * @param multiplier - Factor by which delay increases each retry (default: 2)
   */
  constructor(baseInterval: number, maxInterval = 60000, multiplier = 2) {
    this.baseInterval = baseInterval
    this.maxInterval = maxInterval
    this.multiplier = multiplier
  }

  /**
   * Calculates the next execution delay based on the number of failed executions.
   *
   * @param context - Execution context containing failure count
   * @returns Delay in milliseconds before next execution attempt
   */
  getNextExecutionDelay(context: ExecutionContext): number {
    let delay = this.baseInterval * Math.pow(this.multiplier, context.failedExecutions)
    delay = Math.min(delay, this.maxInterval)

    return delay
  }

  /**
   * Determines if execution should happen immediately.
   *
   * @returns Always returns true, allowing immediate execution when called
   */
  shouldExecuteNow(): boolean {
    return true
  }
}
