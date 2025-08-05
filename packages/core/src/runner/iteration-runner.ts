/**
 * @fileoverview Iteration runner for continuous command execution using strategy pattern
 *
 * This module provides an abstract iteration runner that executes commands repeatedly
 * with configurable intervals, maximum iterations, and error handling strategies.
 * It supports both finite and infinite execution modes with graceful shutdown capabilities.
 */

import type { RunnerConfig, RunnerResult, SolanaBotContext } from '~/types'

import { FixedIntervalTiming, IterationExecutionStrategy } from '~/strategies'
import { IterableRunner } from './abstract'

/**
 * Configuration interface for IterationRunner
 *
 * Extends the base RunnerConfig with iteration-specific options for controlling
 * execution behavior, timing, and error handling.
 */
export type IterationRunnerConfig = RunnerConfig & {
  /** Time interval between iterations in milliseconds (default: 5000) */
  interval?: number
  /** Maximum number of iterations to execute (0 = infinite, default: 0) */
  maxIterations?: number
  /** Whether to stop execution on first error (default: false) */
  stopOnError?: boolean
  /** Whether to enable graceful shutdown on SIGINT/SIGTERM (default: true) */
  gracefulShutdown?: boolean
}

/**
 * Abstract base class for iteration-based command runners
 *
 * This class provides a framework for executing commands repeatedly with configurable
 * timing and iteration limits. It uses the strategy pattern for execution control
 * and timing management, allowing for flexible execution behaviors.
 *
 * Key features:
 * - Configurable execution intervals
 * - Support for both finite and infinite iterations
 * - Graceful shutdown handling
 * - Error handling strategies
 * - Progress tracking for finite iterations
 *
 * @abstract
 * @extends AbstractIterativeRunner
 */
export abstract class IterationRunner extends IterableRunner {
  /** Combined configuration with iteration-specific settings */
  protected iterationConfig: IterationRunnerConfig

  /**
   * Creates a new IterationRunner instance
   *
   * Initializes the runner with command configuration and iteration settings.
   * Sets up execution strategy, timing, and optional graceful shutdown handling.
   *
   * @param config - Iteration-specific configuration options
   */
  constructor(config: IterationRunnerConfig) {
    const iterationConfig = {
      interval: config.interval ?? 5000,
      maxIterations: config.maxIterations ?? 0,
      stopOnError: config.stopOnError ?? false,
      gracefulShutdown: config.gracefulShutdown ?? true,
    }

    const strategy = new IterationExecutionStrategy(
      iterationConfig.maxIterations,
      iterationConfig.stopOnError
    )
    const timing = new FixedIntervalTiming(iterationConfig.interval)
    super(config, strategy, timing)
    this.iterationConfig = iterationConfig

    if (this.iterationConfig.gracefulShutdown) {
      this.setupGracefulShutdown()
    }
  }

  /**
   * Executes a single iteration of the command
   *
   * This abstract method must be implemented by subclasses to define the specific
   * logic that should be executed in each iteration. The method receives the
   * command context and current iteration number.
   *
   * @abstract
   * @param context - The command execution context
   * @param iteration - Current iteration number (0-based)
   * @returns Promise resolving to the command result
   */
  abstract override executeIteration(
    context: SolanaBotContext,
    iteration: number
  ): Promise<RunnerResult>

  /**
   * Gets the maximum number of iterations configured
   *
   * @returns Maximum iterations (0 indicates infinite execution)
   */
  getMaxIterations(): number {
    return this.iterationConfig.maxIterations || 0
  }

  /**
   * Gets the configured interval between iterations
   *
   * @returns Interval in milliseconds
   */
  getInterval(): number {
    return this.iterationConfig.interval || 5000
  }

  /**
   * Checks if the runner is configured for infinite execution
   *
   * @returns True if maxIterations is 0 (infinite), false otherwise
   */
  isInfinite(): boolean {
    return this.iterationConfig.maxIterations === 0
  }

  /**
   * Sets up graceful shutdown handlers for SIGINT and SIGTERM signals
   *
   * When enabled, this allows the runner to cleanly cancel execution and
   * exit the process when receiving termination signals. This is particularly
   * useful for long-running or infinite iterations.
   *
   * @protected
   */
  protected setupGracefulShutdown(): void {
    process.on('SIGINT', () => this.cancel?.())
    process.on('SIGTERM', () => this.cancel?.())
  }

  /**
   * Factory method to create an IterationRunner from a simple function
   *
   * This convenience method allows creating an IterationRunner without defining
   * a new class. The provided function will be called for each iteration.
   *
   * @static
   * @param iterationFn - Function to execute for each iteration
   * @param config - Optional iteration configuration
   * @returns New IterationRunner instance
   *
   * @example
   * ```typescript
   * const runner = IterationRunner.fromFunction(
   *   async (context, iteration) => {
   *     console.log(`Iteration ${iteration}`);
   *     return { success: true };
   *   },
   *   { interval: 1000, maxIterations: 10 }
   * );
   * ```
   */
  static fromFunction(
    iterationFn: (context: SolanaBotContext, iteration: number) => Promise<RunnerResult>,
    config: IterationRunnerConfig = {}
  ): IterationRunner {
    return new (class extends IterationRunner {
      constructor(config: IterationRunnerConfig) {
        super(config)
      }

      async executeIteration(context: SolanaBotContext, iteration: number): Promise<RunnerResult> {
        return iterationFn(context, iteration)
      }
    })(config)
  }
}

/**
 * Concrete implementation of IterationRunner for simple use cases
 *
 * This class provides a ready-to-use implementation that accepts a task function
 * in its constructor, eliminating the need to create a custom subclass for
 * simple iteration scenarios.
 *
 * @extends IterationRunner
 */
export class SimpleInfinityRunner extends IterationRunner {
  /** The task function to execute for each iteration */
  private task: (context: SolanaBotContext, iteration: number) => Promise<RunnerResult>

  /**
   * Creates a new SimpleInfinityRunner instance
   *
   * @param task - Function to execute for each iteration
   * @param config - Optional iteration configuration
   */
  constructor(
    task: (context: SolanaBotContext, iteration: number) => Promise<RunnerResult>,
    config: IterationRunnerConfig = {}
  ) {
    super(config)
    this.task = task
  }

  /**
   * Executes the configured task function for a single iteration
   *
   * @param context - The command execution context
   * @param iteration - Current iteration number
   * @returns Promise resolving to the task result
   */
  async executeIteration(context: SolanaBotContext, iteration: number): Promise<RunnerResult> {
    return this.task(context, iteration)
  }
}
