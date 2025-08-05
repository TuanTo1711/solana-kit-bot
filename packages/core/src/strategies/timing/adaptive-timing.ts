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
 * Adaptive timing strategy that adjusts intervals based on execution results and performance
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

  constructor(config: AdaptiveTimingConfig) {
    this.successMultiplier = config.successMultiplier ?? 0.9
    this.errorMultiplier = config.errorMultiplier ?? 1.5
    this.minInterval = config.minInterval ?? 100
    this.maxInterval = config.maxInterval ?? 30000
    this.enableLearning = config.enableLearning ?? true
    this.performanceWindow = config.performanceWindow ?? 10
    this.currentInterval = config.baseInterval
  }

  getNextExecutionDelay(context: ExecutionContext): number {
    // Track execution performance if learning is enabled
    if (this.enableLearning && context.lastExecutionTime > 0) {
      this.updateExecutionStats(context.lastExecutionTime)
    }

    // Adjust interval based on last result
    const lastResult = context.recentResults[context.recentResults.length - 1]
    if (lastResult) {
      if (lastResult.success) {
        this.currentInterval *= this.successMultiplier
      } else {
        this.currentInterval *= this.errorMultiplier
      }
    }

    // Apply performance-based adjustment
    if (this.enableLearning && this.avgExecutionTime > 0) {
      // If execution takes longer than current interval, increase it
      const performanceMultiplier = Math.min(
        2.0,
        Math.max(0.5, this.avgExecutionTime / this.currentInterval)
      )
      this.currentInterval *= performanceMultiplier
    }

    // Clamp to bounds
    this.currentInterval = Math.max(
      this.minInterval,
      Math.min(this.maxInterval, this.currentInterval)
    )

    return Math.round(this.currentInterval)
  }

  /**
   * Update execution time statistics
   * @private
   */
  private updateExecutionStats(executionTime: number): void {
    this.executionTimes.push(executionTime)
    
    // Keep only recent executions
    if (this.executionTimes.length > this.performanceWindow) {
      this.executionTimes.shift()
    }

    // Calculate rolling average
    this.avgExecutionTime = this.executionTimes.reduce((sum, time) => sum + time, 0) / this.executionTimes.length
  }

  shouldExecuteNow(_: ExecutionContext): boolean {
    return true
  }
}
