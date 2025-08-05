/**
 * @fileoverview Abstract iterative runner for repeated command execution
 */

import type {
  AsyncCommandRunner,
  RunnerResult,
  ExecutionContext,
  ExecutionStrategy,
  RunnerConfig,
  SolanaBotContext,
  TimingStrategy,
} from '~/types'
import { BaseRunner } from './base'

/**
 * Abstract base class for iterative command runners
 *
 * This class provides a framework for executing commands repeatedly using configurable
 * execution strategies and timing patterns. It implements the AsyncCommandRunner interface
 * and extends BaseRunner to provide common functionality for all iterative operations.
 *
 * Key features:
 * - Strategy-based execution control (when to continue, error handling)
 * - Configurable timing patterns (intervals, delays, scheduling)
 * - Execution context tracking (iterations, errors, progress)
 * - Graceful cancellation and cleanup
 * - Progress monitoring and reporting
 *
 * @abstract
 * @extends BaseRunner
 * @implements AsyncCommandRunner
 */
export abstract class IterableRunner extends BaseRunner implements AsyncCommandRunner {
  /** Flag indicating if the runner is currently executing */
  protected _isRunning = false

  /** Current execution context containing iteration state and metrics */
  protected executionContext: ExecutionContext

  /** Strategy for controlling execution flow and error handling */
  protected strategy: ExecutionStrategy

  /** Strategy for controlling execution timing and scheduling */
  protected timing: TimingStrategy

  /** Timer ID for scheduled executions, used for cancellation */
  protected intervalId?: NodeJS.Timeout | undefined

  /** Cleanup callbacks to run on cancellation */
  private readonly cleanupCallbacks: Array<() => void> = []

  /**
   * Creates a new AbstractIterativeRunner instance
   *
   * Initializes the runner with command configuration, execution strategy, and timing strategy.
   * The execution context is created with initial values for tracking iterations and state.
   *
   * @param config - Base runner configuration options
   * @param strategy - Execution strategy for controlling iteration flow
   * @param timing - Timing strategy for controlling execution scheduling
   */
  constructor(config: RunnerConfig, strategy: ExecutionStrategy, timing: TimingStrategy) {
    super(config)
    this.strategy = strategy
    this.timing = timing
    this.executionContext = this.createInitialContext()
  }

  /**
   * Executes a single iteration of the command
   *
   * This abstract method must be implemented by subclasses to define the specific
   * logic that should be executed in each iteration. The method receives the
   * command context and current iteration number for execution.
   *
   * @abstract
   * @param context - The command execution context
   * @param iteration - Current iteration number (1-based)
   * @returns Promise resolving to the command result
   */
  abstract executeIteration(context: SolanaBotContext, iteration: number): Promise<RunnerResult>

  /**
   * Executes the iterative command loop
   *
   * Starts the iterative execution process, managing the execution context and
   * coordinating between the execution strategy and timing strategy. The method
   * runs until the strategy determines execution should stop or an error occurs.
   *
   * @param context - The command execution context
   * @returns Promise resolving to the final command result
   */
  async execute(context: SolanaBotContext): Promise<RunnerResult> {
    this._isRunning = true
    this.executionContext = this.createInitialContext()

    try {
      await this.validate(context)
      await this.runIterativeLoop(context)
      return this.createSuccessResult(
        `${this.constructor.name} completed. Total executions: ${this.executionContext.totalExecutions}`
      )
    } catch (error) {
      return this.createErrorResult(error as Error)
    }
  }

  /**
   * Cancels the currently running command
   * @returns Promise that resolves when cancellation is complete
   */
  async cancel(): Promise<void> {
    this._isRunning = false
    this.executionContext.isRunning = false

    // Clear any pending timers
    if (this.intervalId) {
      clearTimeout(this.intervalId)
      this.intervalId = undefined
    }

    // Run all cleanup callbacks
    for (const callback of this.cleanupCallbacks) {
      try {
        callback()
      } catch (error) {
        console.warn('Cleanup callback failed:', error)
      }
    }

    // Clear cleanup callbacks
    this.cleanupCallbacks.length = 0

    // Force garbage collection hint for execution context
    this.resetExecutionContext()
  }

  /**
   * Register a cleanup callback to run on cancellation
   * @param callback - Function to call during cleanup
   */
  protected addCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.push(callback)
  }

  /**
   * Reset execution context for memory cleanup
   * @private
   */
  private resetExecutionContext(): void {
    this.executionContext = {
      ...this.executionContext,
      currentIteration: 0,
      failedExecutions: 0,
      startTime: 0,
      lastExecutionTime: 0,
    }
  }

  /**
   * Gets the current progress of the operation
   * @returns Progress value (0-1) or -1 for indeterminate
   */
  getProgress(): number {
    return this.strategy.getProgress(this.executionContext)
  }

  /**
   * Checks if the runner is currently executing
   * @returns True if the runner is currently active
   */
  isRunning(): boolean {
    return this._isRunning
  }

  /**
   * Gets the current iteration number
   *
   * Returns the number of the current or last completed iteration.
   * Iteration numbers are 1-based and increment before each execution.
   *
   * @returns Current iteration number
   */
  getCurrentIteration(): number {
    return this.executionContext.currentIteration
  }

  /**
   * Gets the total number of completed executions
   *
   * Returns the count of iterations that have been successfully executed,
   * regardless of their success or failure status. This differs from the
   * iteration number as it only counts completed executions.
   *
   * @returns Total number of completed executions
   */
  getTotalExecutions(): number {
    return this.executionContext.totalExecutions
  }

  /**
   * Creates the initial execution context
   *
   * Initializes a new execution context with default values for tracking
   * iteration state, timing, errors, and execution metrics.
   *
   * @private
   * @returns New execution context with initial values
   */
  private createInitialContext(): ExecutionContext {
    return {
      currentIteration: 0,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      startTime: Date.now(),
      lastExecutionTime: Date.now(),
      totalExecutionTime: 0,
      recentResults: [],
      isRunning: true,
    }
  }

  /**
   * Runs the main iterative execution loop
   *
   * This is the core method that manages the iterative execution process.
   * It coordinates between the execution strategy, timing strategy, and
   * iteration execution, handling errors and scheduling appropriately.
   *
   * The loop continues until:
   * - The execution strategy determines it should stop
   * - An unrecoverable error occurs
   * - The runner is cancelled externally
   *
   * @private
   * @param context - The command execution context
   * @returns Promise that resolves when the loop completes
   */
  private async runIterativeLoop(context: SolanaBotContext): Promise<void> {
    return new Promise((resolve, reject) => {
      const executeNext = async () => {
        // Check if execution should continue (cancellation or external stop)
        if (!this._isRunning || !this.executionContext.isRunning) {
          resolve()
          return
        }

        // Check if strategy allows continuation (max iterations, conditions, etc.)
        if (!this.strategy.shouldContinue(this.executionContext)) {
          this._isRunning = false
          this.executionContext.isRunning = false
          resolve()
          return
        }

        // Check if timing strategy allows execution now
        if (!this.timing.shouldExecuteNow(this.executionContext)) {
          const delay = this.timing.getNextExecutionDelay(this.executionContext)
          this.intervalId = setTimeout(executeNext, delay)
          return
        }

        try {
          // Increment iteration counter and execute
          this.executionContext.currentIteration++

          const iterationStartTime = Date.now()
          const result = await this.executeIteration(
            context,
            this.executionContext.currentIteration
          )
          const iterationEndTime = Date.now()

          // Update execution context
          this.executionContext.recentResults.push(result)
          if (this.executionContext.recentResults.length > 10) {
            this.executionContext.recentResults.shift() // Keep only last 10 results
          }

          this.executionContext.totalExecutions++
          this.executionContext.lastExecutionTime = iterationEndTime
          this.executionContext.totalExecutionTime += iterationEndTime - iterationStartTime

          if (result.success) {
            this.executionContext.successfulExecutions++
          } else {
            this.executionContext.failedExecutions++
          }

          // Notify strategy of completion
          this.strategy.onIterationComplete(this.executionContext, result)

          // Handle execution result
          if (!result.success) {
            const error = result.error || new Error(result.message || 'Unknown error')
            const shouldContinue = this.strategy.onError(this.executionContext, error)
            if (!shouldContinue) {
              this._isRunning = false
              this.executionContext.isRunning = false
              reject(error)
              return
            }
          }

          // Schedule next execution if still running
          if (this._isRunning && this.executionContext.isRunning) {
            const delay = this.timing.getNextExecutionDelay(this.executionContext)
            this.intervalId = setTimeout(executeNext, delay)
          } else {
            resolve()
          }
        } catch (error) {
          // Handle unexpected errors during execution
          const err = error as Error
          this.executionContext.failedExecutions++

          const shouldContinue = this.strategy.onError(this.executionContext, err)
          if (!shouldContinue) {
            this._isRunning = false
            this.executionContext.isRunning = false
            reject(err)
          } else {
            // Continue with next execution after error
            if (this._isRunning && this.executionContext.isRunning) {
              const delay = this.timing.getNextExecutionDelay(this.executionContext)
              this.intervalId = setTimeout(executeNext, delay)
            } else {
              resolve()
            }
          }
        }
      }

      // Start the first execution
      executeNext()
    })
  }
}
