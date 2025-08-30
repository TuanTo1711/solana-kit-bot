import type { ExecutorResult, ExecutionContext, ExecutionStrategy } from '~/types'
import { CountBasedExecutionStrategy } from './count-based-execution-strategy'
import { TimeBasedExecutionStrategy } from './time-based-execution-strategy'

/**
 * Hybrid execution strategy that combines both time-based and count-based execution limits.
 * This strategy allows for flexible control over execution flow by combining the constraints
 * of both time duration and maximum execution count.
 *
 * @example
 * ```typescript
 * // Stop when either 5 minutes OR 100 executions is reached
 * const strategy = new HybridExecutionStrategy(300000, 100, 'or')
 *
 * // Stop only when BOTH 5 minutes AND 100 executions are reached
 * const strategy = new HybridExecutionStrategy(300000, 100, 'and')
 * ```
 */
export class HybridExecutionStrategy implements ExecutionStrategy {
  private timeStrategy: TimeBasedExecutionStrategy
  private countStrategy: CountBasedExecutionStrategy
  private mode: 'and' | 'or'

  /**
   * Creates a new hybrid execution strategy.
   *
   * @param duration - Maximum execution duration in milliseconds
   * @param maxExecutions - Maximum number of executions allowed
   * @param mode - Combination mode: 'or' stops when either condition is met, 'and' stops when both are met (default: 'or')
   * @param stopOnError - Whether to stop execution when an error occurs (default: true)
   */
  constructor(
    duration: number,
    maxExecutions: number,
    mode: 'and' | 'or' = 'or',
    stopOnError = true
  ) {
    this.timeStrategy = new TimeBasedExecutionStrategy(duration, stopOnError)
    this.countStrategy = new CountBasedExecutionStrategy(maxExecutions, stopOnError)
    this.mode = mode
  }

  /**
   * Determines whether execution should continue based on both time and count constraints.
   *
   * In 'or' mode: continues until either time limit OR execution count is reached
   * In 'and' mode: continues until both time limit AND execution count are reached
   *
   * @param context - The current execution context
   * @returns true if execution should continue, false otherwise
   */
  shouldContinue(context: ExecutionContext): boolean {
    const timeContinue = this.timeStrategy.shouldContinue(context)
    const countContinue = this.countStrategy.shouldContinue(context)

    return this.mode === 'and' ? timeContinue && countContinue : timeContinue || countContinue
  }

  /**
   * Called after each iteration completes to handle the result.
   * Delegates to both underlying strategies to maintain their state.
   *
   * @param context - The current execution context
   * @param result - The result from the completed iteration
   */
  onIterationComplete(context: ExecutionContext, result: ExecutorResult): void {
    this.timeStrategy.onIterationComplete(context, result)
    this.countStrategy.onIterationComplete(context, result)
  }

  /**
   * Called when an error occurs during execution.
   * Both strategies must agree to continue for execution to proceed.
   *
   * @param context - The current execution context
   * @param error - The error that occurred
   * @returns true if execution should continue despite the error, false to stop
   */
  onError(context: ExecutionContext, error: Error): boolean {
    return this.timeStrategy.onError(context, error) && this.countStrategy.onError(context, error)
  }

  /**
   * Calculates the current progress as a percentage based on the combination mode.
   *
   * In 'and' mode: returns the minimum progress (slowest constraint)
   * In 'or' mode: returns the maximum progress (fastest constraint)
   *
   * @param context - The current execution context
   * @returns Progress percentage (0-100)
   */
  getProgress(context: ExecutionContext): number {
    const timeProgress = this.timeStrategy.getProgress(context)
    const countProgress = this.countStrategy.getProgress(context)

    return this.mode === 'and'
      ? Math.min(timeProgress, countProgress)
      : Math.max(timeProgress, countProgress)
  }
}
