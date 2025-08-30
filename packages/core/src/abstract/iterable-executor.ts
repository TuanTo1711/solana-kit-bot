import type {
  AsyncCommandExecutor,
  CommandExecutorConfig,
  ExecutionContext,
  ExecutionStrategy,
  ExecutorResult,
  SolanaBotContext,
  TimingStrategy,
} from '~/types'
import { BaseExecutor } from './base-executor'

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
 * @extends BaseExecutor
 * @implements AsyncCommandExecutor
 */
export abstract class IterableExecutor extends BaseExecutor implements AsyncCommandExecutor {
  protected _isRunning = false
  protected executionContext: ExecutionContext
  protected strategy: ExecutionStrategy
  protected timing: TimingStrategy
  protected intervalId?: NodeJS.Timeout | undefined
  private readonly cleanupCallbacks: Array<() => void> = []

  /**
   * Creates a new IterableExecutor instance
   *
   * Initializes the runner with command configuration, execution strategy, and timing strategy.
   * The execution context is created with initial values for tracking iterations and state.
   *
   * @param config - Base runner configuration options
   * @param strategy - Execution strategy for controlling iteration flow
   * @param timing - Timing strategy for controlling execution scheduling
   */
  constructor(config: CommandExecutorConfig, strategy: ExecutionStrategy, timing: TimingStrategy) {
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
  abstract executeIteration(context: SolanaBotContext, iteration: number): Promise<ExecutorResult>

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
  async execute(context: SolanaBotContext): Promise<ExecutorResult> {
    this._isRunning = true
    this.executionContext = this.createInitialContext()

    try {
      await this.validate(context)
      await this.runIterativeLoop(context)

      const totalTime = Date.now() - this.executionContext.startTime
      const successMessage = [
        `${this.constructor.name} completed successfully.`,
        `Total executions: ${this.executionContext.totalExecutions}`,
        '',
        `Successful: ${this.executionContext.successfulExecutions}`,
        `Failed: ${this.executionContext.failedExecutions}`,
        `Total time: ${totalTime}ms`,
      ].join('\n')

      context.logger.info(successMessage)
      return this.createSuccessResult(successMessage)
    } catch (error) {
      const errorMessage = `${this.constructor.name} failed after ${this.executionContext.totalExecutions} executions: ${(error as Error).message}`
      context.logger.error(errorMessage, {
        totalExecutions: this.executionContext.totalExecutions,
        successfulExecutions: this.executionContext.successfulExecutions,
        failedExecutions: this.executionContext.failedExecutions,
        currentIteration: this.executionContext.currentIteration,
        error: (error as Error).stack,
      })
      return this.createErrorResult(error as Error)
    }
  }

  /**
   * Cancels the currently running command
   *
   * Performs cleanup operations including clearing timers, running cleanup callbacks,
   * and resetting execution context for memory management.
   *
   * @returns Promise that resolves when cancellation is complete
   */
  async cancel(): Promise<void> {
    console.info(
      `${this.constructor.name}: Cancelling execution (iteration: ${this.executionContext.currentIteration})`
    )

    this._isRunning = false
    this.executionContext.isRunning = false

    if (this.intervalId) {
      clearTimeout(this.intervalId)
      this.intervalId = undefined
      console.debug(`${this.constructor.name}: Cleared pending timeout`)
    }

    console.debug(
      `${this.constructor.name}: Running ${this.cleanupCallbacks.length} cleanup callbacks`
    )
    for (const callback of this.cleanupCallbacks) {
      try {
        callback()
      } catch (error) {
        console.warn(`${this.constructor.name}: Cleanup callback failed:`, error)
      }
    }

    this.cleanupCallbacks.length = 0
    this.resetExecutionContext()
    console.info(`${this.constructor.name}: Cancellation completed`)
  }

  /**
   * Register a cleanup callback to run on cancellation
   *
   * @param callback - Function to call during cleanup
   */
  protected addCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.push(callback)
  }

  /**
   * Reset execution context for memory cleanup
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
   *
   * @returns Progress value (0-1) or -1 for indeterminate
   */
  getProgress(): number {
    return this.strategy.getProgress(this.executionContext)
  }

  /**
   * Checks if the runner is currently executing
   *
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
   * @param context - The command execution context
   * @returns Promise that resolves when the loop completes
   */
  private async runIterativeLoop(context: SolanaBotContext): Promise<void> {
    context.logger.info(`${this.constructor.name}: Starting iterative loop`)

    return new Promise((resolve, reject) => {
      const executeNext = async () => {
        if (!this._isRunning || !this.executionContext.isRunning) {
          context.logger.info(`${this.constructor.name}: Loop stopped - execution not active`)
          resolve()
          return
        }

        if (!this.strategy.shouldContinue(this.executionContext)) {
          this._isRunning = false
          this.executionContext.isRunning = false
          context.logger.info(
            `${this.constructor.name}: Loop completed - strategy determined to stop`
          )
          resolve()
          return
        }

        if (!this.timing.shouldExecuteNow(this.executionContext)) {
          const delay = this.timing.getNextExecutionDelay(this.executionContext)
          this.intervalId = setTimeout(executeNext, delay)
          return
        }

        try {
          this.executionContext.currentIteration++
          context.logger.debug(
            `${this.constructor.name}: Starting iteration ${this.executionContext.currentIteration}`
          )

          const iterationStartTime = Date.now()
          const result = await this.executeIteration(
            context,
            this.executionContext.currentIteration
          )
          const iterationEndTime = Date.now()

          this.handleIterationSuccess(context, result, iterationStartTime, iterationEndTime)

          if (!result.success) {
            const error = result.error || new Error(result.message || 'Unknown error')
            const shouldContinue = this.handleIterationError(context, error, false)
            if (!shouldContinue) {
              reject(error)
              return
            }
          }

          this.scheduleNext(context, executeNext, resolve)
        } catch (error) {
          const err = error as Error
          context.logger.error(
            `${this.constructor.name}: Iteration ${this.executionContext.currentIteration} threw exception: ${err.message}`
          )

          const shouldContinue = this.handleIterationError(context, err, true)
          if (!shouldContinue) {
            reject(err)
          } else {
            this.scheduleNext(context, executeNext, resolve)
          }
        }
      }

      executeNext()
    })
  }

  /**
   * Handles successful iteration completion
   *
   * Updates execution context with iteration results and metrics,
   * and notifies the strategy of completion.
   *
   * @param context - The command execution context
   * @param result - The result of the iteration
   * @param startTime - When the iteration started
   * @param endTime - When the iteration ended
   */
  private handleIterationSuccess(
    context: SolanaBotContext,
    result: ExecutorResult,
    startTime: number,
    endTime: number
  ): void {
    this.executionContext.recentResults.push(result)
    if (this.executionContext.recentResults.length > 10) {
      this.executionContext.recentResults.shift()
    }

    this.executionContext.totalExecutions++
    this.executionContext.lastExecutionTime = endTime
    this.executionContext.totalExecutionTime += endTime - startTime

    if (result.success) {
      this.executionContext.successfulExecutions++
      context.logger.debug(
        `${this.constructor.name}: Iteration ${this.executionContext.currentIteration} succeeded (${endTime - startTime}ms)`
      )
    } else {
      this.executionContext.failedExecutions++
      context.logger.warn(
        `${this.constructor.name}: Iteration ${this.executionContext.currentIteration} failed: ${result.message}`
      )
    }

    this.strategy.onIterationComplete(this.executionContext, result)
  }

  /**
   * Handles iteration errors
   *
   * Updates failure counters, logs the error, and consults the strategy
   * to determine if execution should continue.
   *
   * @param context - The command execution context
   * @param error - The error that occurred
   * @param wasException - Whether this was an uncaught exception
   * @returns True if execution should continue, false otherwise
   */
  private handleIterationError(
    context: SolanaBotContext,
    error: Error,
    wasException: boolean
  ): boolean {
    if (wasException) {
      this.executionContext.failedExecutions++
    }

    context.logger.error(
      `${this.constructor.name}: ${wasException ? 'Exception' : 'Error'} in iteration ${this.executionContext.currentIteration}: ${error.message}`,
      {
        error: error.stack,
        iteration: this.executionContext.currentIteration,
        totalExecutions: this.executionContext.totalExecutions,
        failedExecutions: this.executionContext.failedExecutions,
      }
    )

    const shouldContinue = this.strategy.onError(this.executionContext, error)

    if (!shouldContinue) {
      this._isRunning = false
      this.executionContext.isRunning = false
      context.logger.error(`${this.constructor.name}: Strategy determined to stop after error`)
    } else {
      context.logger.info(`${this.constructor.name}: Strategy determined to continue after error`)
    }

    return shouldContinue
  }

  /**
   * Schedules the next iteration or resolves the loop
   *
   * Determines whether to schedule another iteration based on runner state,
   * and either schedules the next execution or resolves the loop.
   *
   * @param context - The command execution context
   * @param executeNext - Function to execute the next iteration
   * @param resolve - Promise resolve function to complete the loop
   */
  private scheduleNext(
    context: SolanaBotContext,
    executeNext: () => Promise<void>,
    resolve: () => void
  ): void {
    if (this._isRunning && this.executionContext.isRunning) {
      const delay = this.timing.getNextExecutionDelay(this.executionContext)
      context.logger.debug(`${this.constructor.name}: Scheduling next iteration in ${delay}ms`)
      this.intervalId = setTimeout(executeNext, delay)
    } else {
      context.logger.info(`${this.constructor.name}: Loop completed - no more iterations scheduled`)
      resolve()
    }
  }
}
