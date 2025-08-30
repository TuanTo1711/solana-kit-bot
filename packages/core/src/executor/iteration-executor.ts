import type { Key } from 'readline'

import { IterableExecutor } from '~/abstract'
import { FixedIntervalTiming, IterationExecutionStrategy } from '~/strategies'
import type { CommandExecutorConfig, ExecutorResult, SolanaBotContext } from '~/types'

/**
 * Configuration interface for IterationExecutor.
 *
 * @interface IterationExecutorConfig
 * @extends {CommandExecutorConfig}
 */
export type IterationExecutorConfig = CommandExecutorConfig & {
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
 * Abstract base class for iteration-based command executors.
 *
 * Provides a high-level framework for executing commands repeatedly with configurable
 * timing intervals and iteration limits. Uses the strategy pattern internally
 * with IterationExecutionStrategy and FixedIntervalTiming. Supports graceful
 * shutdown handling for production deployments.
 *
 * @abstract
 * @extends {IterableExecutor}
 *
 * @example
 * ```typescript
 * class MyTradingExecutor extends IterationExecutor {
 *   constructor() {
 *     super({ interval: 5000, maxIterations: 100, stopOnError: false })
 *   }
 *
 *   async executeIteration(context: SolanaBotContext, iteration: number): Promise<ExecutorResult> {
 *     // Trading logic here
 *     return this.createSuccessResult(`Iteration ${iteration} completed`)
 *   }
 * }
 * ```
 */
export abstract class IterationExecutor extends IterableExecutor {
  protected iterationConfig: IterationExecutorConfig

  constructor(config: IterationExecutorConfig) {
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
   */
  abstract override executeIteration(
    context: SolanaBotContext,
    iteration: number
  ): Promise<ExecutorResult>

  /**
   * Gets the maximum number of iterations configured
   */
  getMaxIterations(): number {
    return this.iterationConfig.maxIterations || 0
  }

  /**
   * Gets the configured interval between iterations
   */
  getInterval(): number {
    return this.iterationConfig.interval || 5000
  }

  /**
   * Checks if the runner is configured for infinite execution
   */
  isInfinite(): boolean {
    return this.iterationConfig.maxIterations === 0
  }

  /**
   * Sets up graceful shutdown handlers for SIGINT and SIGTERM signals
   */
  protected setupGracefulShutdown(): void {
    const escListener = (_: string, key: Key) => {
      if (key.name === 'escape' || key.name === 'SIGINT') {
        this.cancel()
        cleanup()
      }
    }

    const cleanup = () => {
      process.stdin.removeListener('keypress', escListener)
    }

    process.stdin.on('keypress', escListener)
  }

  /**
   * Factory method to create an IterationExecutor from a simple function
   *
   * @example
   * ```typescript
   * const runner = IterationExecutor.fromFunction(
   *   async (context, iteration) => {
   *     console.log(`Iteration ${iteration}`);
   *     return { success: true };
   *   },
   *   { interval: 1000, maxIterations: 10 }
   * );
   * ```
   */
  static fromFunction(
    iterationFn: (context: SolanaBotContext, iteration: number) => Promise<ExecutorResult>,
    config: IterationExecutorConfig
  ): IterationExecutor {
    return new (class extends IterationExecutor {
      constructor(config: IterationExecutorConfig) {
        super(config)
      }

      async executeIteration(
        context: SolanaBotContext,
        iteration: number
      ): Promise<ExecutorResult> {
        return iterationFn(context, iteration)
      }
    })(config)
  }
}
