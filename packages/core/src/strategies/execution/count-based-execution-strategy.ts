import type { ExecutionContext, ExecutionStrategy, ExecutorResult } from '~/types'

/**
 * Execution strategy that limits execution based on a maximum count of iterations.
 * This strategy controls execution flow by stopping after a specified number of executions.
 */
export class CountBasedExecutionStrategy implements ExecutionStrategy {
  private maxExecutions: number
  private stopOnError: boolean

  /**
   * Creates a new count-based execution strategy.
   *
   * @param maxExecutions - The maximum number of executions allowed
   * @param stopOnError - Whether to stop execution when an error occurs (default: true)
   */
  constructor(maxExecutions: number, stopOnError = true) {
    this.maxExecutions = maxExecutions
    this.stopOnError = stopOnError
  }

  /**
   * Determines whether execution should continue based on the current context.
   *
   * @param context - The current execution context
   * @returns true if execution should continue, false otherwise
   */
  shouldContinue(context: ExecutionContext): boolean {
    return context.totalExecutions < this.maxExecutions && context.isRunning
  }

  /**
   * Called after each iteration completes to handle the result.
   * Maintains a rolling buffer of the last 10 results for tracking purposes.
   *
   * @param context - The current execution context
   * @param result - The result from the completed iteration
   */
  onIterationComplete(context: ExecutionContext, result: ExecutorResult): void {
    context.recentResults.push(result)
    if (context.recentResults.length > 10) {
      context.recentResults.shift() // Keep only last 10 results
    }
  }

  /**
   * Called when an error occurs during execution.
   * Increments the failed execution counter and determines whether to continue.
   *
   * @param context - The current execution context
   * @param _ - The error that occurred (unused)
   * @returns true if execution should continue despite the error, false to stop
   */
  onError(context: ExecutionContext, _: Error): boolean {
    context.failedExecutions++
    return !this.stopOnError
  }

  /**
   * Calculates the current progress as a percentage.
   *
   * @param context - The current execution context
   * @returns Progress percentage (0-100)
   */
  getProgress(context: ExecutionContext): number {
    return Math.min((context.totalExecutions / this.maxExecutions) * 100, 100)
  }
}
