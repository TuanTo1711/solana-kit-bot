import type { ExecutionContext, TimingStrategy } from '~/types'

/**
 * Configuration options for adaptive timing strategy
 */
export interface AdaptiveTimingConfig {
  /** Base interval in milliseconds */
  baseInterval: number
  /** Multiplier applied after successful operations (default: 0.9) */
  successMultiplier?: number
  /** Multiplier applied after failed operations (default: 1.5) */
  errorMultiplier?: number
  /** Minimum allowed interval in milliseconds (default: 100) */
  minInterval?: number
  /** Maximum allowed interval in milliseconds (default: 30000) */
  maxInterval?: number
  /** Enable learning from execution performance (default: true) */
  enableLearning?: boolean
  /** Window size for performance tracking (default: 10) */
  performanceWindow?: number
}

/**
 * Adaptive timing strategy that adjusts intervals based on execution results and performance.
 *
 * This strategy automatically tunes execution intervals by:
 * - Decreasing interval after successful operations
 * - Increasing interval after failed operations
 * - Learning from execution performance to optimize timing
 * - Maintaining intervals within configured bounds
 *
 * @example
 * ```typescript
 * const adaptiveTiming = new AdaptiveTiming({
 *   baseInterval: 1000,
 *   successMultiplier: 0.9,
 *   errorMultiplier: 1.5,
 *   minInterval: 100,
 *   maxInterval: 30000,
 *   enableLearning: true,
 *   performanceWindow: 10
 * });
 * ```
 */
export class AdaptiveTiming implements TimingStrategy {
  private readonly successMultiplier: number
  private readonly errorMultiplier: number
  private readonly minInterval: number
  private readonly maxInterval: number
  private readonly enableLearning: boolean
  private readonly performanceWindow: number

  private currentInterval: number
  private readonly executionTimes: number[] = []
  private avgExecutionTime = 0

  /**
   * Creates a new AdaptiveTiming instance
   *
   * @param config - Configuration options for the adaptive timing strategy
   */
  constructor(config: AdaptiveTimingConfig) {
    this.successMultiplier = config.successMultiplier ?? 0.9
    this.errorMultiplier = config.errorMultiplier ?? 1.5
    this.minInterval = config.minInterval ?? 100
    this.maxInterval = config.maxInterval ?? 30000
    this.enableLearning = config.enableLearning ?? true
    this.performanceWindow = config.performanceWindow ?? 10
    this.currentInterval = config.baseInterval
  }

  /**
   * Calculates the next execution delay based on execution context and performance history.
   *
   * The delay is determined by:
   * 1. Tracking execution performance for learning
   * 2. Adjusting interval based on last execution result (success/failure)
   * 3. Applying performance-based adjustments if learning is enabled
   * 4. Clamping the result within configured bounds
   *
   * @param context - The current execution context containing recent results and performance data
   * @returns The delay in milliseconds before the next execution
   */
  getNextExecutionDelay(context: ExecutionContext): number {
    if (this.enableLearning && context.lastExecutionTime > 0) {
      this.updateExecutionStats(context.lastExecutionTime)
    }

    const lastResult = context.recentResults[context.recentResults.length - 1]
    if (lastResult) {
      if (lastResult.success) {
        this.currentInterval *= this.successMultiplier
      } else {
        this.currentInterval *= this.errorMultiplier
      }
    }

    if (this.enableLearning && this.avgExecutionTime > 0) {
      const performanceMultiplier = Math.min(
        2.0,
        Math.max(0.5, this.avgExecutionTime / this.currentInterval)
      )
      this.currentInterval *= performanceMultiplier
    }

    this.currentInterval = Math.max(
      this.minInterval,
      Math.min(this.maxInterval, this.currentInterval)
    )

    return Math.round(this.currentInterval)
  }

  /**
   * Updates execution time statistics for performance learning.
   * Maintains a rolling window of recent execution times and calculates the average.
   *
   * @param executionTime - The execution time in milliseconds to add to the statistics
   */
  private updateExecutionStats(executionTime: number): void {
    this.executionTimes.push(executionTime)

    if (this.executionTimes.length > this.performanceWindow) {
      this.executionTimes.shift()
    }

    this.avgExecutionTime =
      this.executionTimes.reduce((sum, time) => sum + time, 0) / this.executionTimes.length
  }

  /**
   * Determines whether execution should proceed immediately.
   * For adaptive timing, execution is always allowed as timing is controlled by delays.
   *
   * @param _ - The execution context (unused in this implementation)
   * @returns Always returns true
   */
  shouldExecuteNow(_: ExecutionContext): boolean {
    return true
  }
}
