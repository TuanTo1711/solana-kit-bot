import type { ExecutionContext, TimingStrategy } from '~/types'

/**
 * A timing strategy that executes tasks at fixed intervals.
 *
 * This strategy maintains a constant delay between executions, regardless of
 * the actual execution time of the task. It tracks the last execution time
 * to ensure the interval is respected.
 *
 * @example
 * ```typescript
 * // Execute every 5 seconds
 * const timing = new FixedIntervalTiming(5000);
 * ```
 */
export class FixedIntervalTiming implements TimingStrategy {
  private interval: number
  private lastExecution = 0

  /**
   * Creates a new FixedIntervalTiming instance.
   *
   * @param interval - The fixed interval in milliseconds between executions
   */
  constructor(interval: number) {
    this.interval = interval
  }

  /**
   * Returns the fixed delay until the next execution.
   *
   * @param _ - The execution context (unused in this strategy)
   * @returns The fixed interval in milliseconds
   */
  getNextExecutionDelay(_: ExecutionContext): number {
    return this.interval
  }

  /**
   * Determines if a task should execute now based on the fixed interval.
   *
   * Checks if enough time has passed since the last execution. If so,
   * updates the last execution time and returns true.
   *
   * @param _ - The execution context (unused in this strategy)
   * @returns True if the task should execute now, false otherwise
   */
  shouldExecuteNow(_: ExecutionContext): boolean {
    const now = Date.now()
    if (now - this.lastExecution >= this.interval) {
      this.lastExecution = now
      return true
    }
    return false
  }
}
