import type { ExecutorResult } from './executor'

/**
 * Execution context for iterative runners
 */
export interface ExecutionContext {
  /** Current iteration number (1-based) */
  currentIteration: number

  /** Total number of iterations executed */
  totalExecutions: number

  /** Number of successful executions */
  successfulExecutions: number

  /** Number of failed executions */
  failedExecutions: number

  /** Execution start timestamp */
  startTime: number

  /** Last execution timestamp */
  lastExecutionTime: number

  /** Total execution time across all iterations */
  totalExecutionTime: number

  /** Array of recent execution results */
  recentResults: ExecutorResult[]

  /** Flag indicating if execution should continue */
  isRunning: boolean

  /** Optional custom context data */
  customData?: Record<string, any>

  /** Performance metrics */
  metrics?: {
    /** Average execution time per iteration */
    averageExecutionTime: number
    /** Success rate (0-1) */
    successRate: number
    /** Executions per second */
    executionsPerSecond: number
    /** Peak memory usage */
    peakMemoryUsage?: number
  }
}

/**
 * Defines the strategy for controlling execution flow and handling results.
 * Implementations determine when to continue execution, how to handle errors,
 * and how to track progress throughout the execution lifecycle.
 */
export interface ExecutionStrategy {
  /**
   * Determines whether execution should continue based on the current context.
   * @param context - The current execution context
   * @returns true if execution should continue, false to stop
   */
  shouldContinue(context: ExecutionContext): boolean | Promise<boolean>

  /**
   * Called after each iteration completes successfully.
   * @param context - The current execution context
   * @param result - The result from the completed iteration
   */
  onIterationComplete(context: ExecutionContext, result: ExecutorResult): void | Promise<void>

  /**
   * Called when an error occurs during execution.
   * @param context - The current execution context
   * @param error - The error that occurred
   * @returns true to continue execution despite the error, false to stop
   */
  onError(context: ExecutionContext, error: Error): boolean

  /**
   * Gets the current progress of execution as a percentage.
   * @param context - The current execution context
   * @returns Progress value between 0 and 1 (0% to 100%)
   */
  getProgress(context: ExecutionContext): number
}
