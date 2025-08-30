import type { ExecutorResult, ExecutionContext, ExecutionStrategy } from '~/types'

/**
 * Execution strategy that controls iterations based on a maximum count and error handling behavior.
 *
 * @example
 * ```typescript
 * // Run indefinitely
 * const strategy = new IterationExecutionStrategy()
 *
 * // Run for a maximum of 100 iterations
 * const strategy = new IterationExecutionStrategy(100)
 *
 * // Stop execution when an error occurs
 * const strategy = new IterationExecutionStrategy(0, false)
 * ```
 */
export class IterationExecutionStrategy implements ExecutionStrategy {
  private maxIterations: number
  private stopOnError: boolean

  /**
   * Creates a new IterationExecutionStrategy.
   *
   * @param maxIterations - Maximum number of iterations to run. Use 0 for infinite iterations.
   * @param stopOnError - Whether to stop execution when an error occurs.
   */
  constructor(maxIterations = 0, stopOnError = true) {
    this.maxIterations = maxIterations
    this.stopOnError = stopOnError
  }

  /**
   * Determines whether execution should continue based on iteration count and running state.
   *
   * @param context - The current execution context
   * @returns true if execution should continue, false otherwise
   */
  shouldContinue(context: ExecutionContext): boolean {
    if (this.maxIterations > 0 && context.currentIteration >= this.maxIterations) {
      return false
    }
    return context.isRunning
  }

  /**
   * Called when an iteration completes successfully.
   * Maintains a rolling history of the last 10 execution results.
   *
   * @param context - The current execution context
   * @param result - The result from the completed iteration
   */
  onIterationComplete(context: ExecutionContext, result: ExecutorResult): void {
    context.recentResults.push(result)
    if (context.recentResults.length > 10) {
      context.recentResults.shift()
    }
  }

  /**
   * Called when an error occurs during execution.
   * Increments the failed execution counter and determines if execution should continue.
   *
   * @param context - The current execution context
   * @param _ - The error that occurred (unused in this implementation)
   * @returns true if execution should continue despite the error, false to stop
   */
  onError(context: ExecutionContext, _: Error): boolean {
    context.failedExecutions++
    return !this.stopOnError
  }

  /**
   * Calculates the progress percentage of execution.
   *
   * @param context - The current execution context
   * @returns Progress as a percentage (0-100), or -1 if maxIterations is 0 (infinite)
   */
  getProgress(context: ExecutionContext): number {
    if (this.maxIterations === 0) {
      return -1
    }
    return Math.min((context.currentIteration / this.maxIterations) * 100, 100)
  }
}
