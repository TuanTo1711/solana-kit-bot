/**
 * @fileoverview Abstract runner controller for graceful lifecycle management
 *
 * Provides a base implementation for controlling runner lifecycle including
 * start, stop, pause, resume operations with signal handling and graceful
 * shutdown capabilities.
 *
 * @author Yuuta - To Hoang Tuan
 * @version 1.0.0
 * @since 2024
 */

import {
  RunnerState,
  type IRunnerController,
  type RunnerMetrics,
  type RunnerStatus,
  type ShutdownConfig,
  type SolanaBotContext,
} from '~/types'
import type { BaseRunner } from './base'

/**
 * Abstract base class for runner controllers
 *
 * Provides common functionality for managing runner lifecycle including
 * graceful shutdown, state tracking, and error handling. Subclasses must
 * implement runner creation and specific lifecycle methods.
 *
 * @abstract
 * @template TRunner The type of runner being controlled
 */
export abstract class AbstractRunnerController<TRunner extends BaseRunner = BaseRunner>
  implements IRunnerController<TRunner>
{
  protected runner: TRunner | null = null
  protected state: RunnerState = RunnerState.IDLE
  protected startTime?: number | undefined
  protected stopTime?: number | undefined
  protected lastError?: string | undefined
  protected stopRequested = false
  protected shutdownConfig: ShutdownConfig

  /**
   * Default shutdown configuration
   */
  private static readonly DEFAULT_SHUTDOWN_CONFIG: ShutdownConfig = {
    gracefulTimeout: 15000,
    forceShutdown: true,
  }

  /**
   * Creates a new AbstractRunnerController instance
   *
   * @param shutdownConfig - Configuration for shutdown behavior
   */
  constructor(shutdownConfig?: Partial<ShutdownConfig>) {
    this.shutdownConfig = {
      ...AbstractRunnerController.DEFAULT_SHUTDOWN_CONFIG,
      ...shutdownConfig,
    }
  }

  /**
   * Create a new runner instance
   *
   * Subclasses must implement this method to create their specific runner type
   * with appropriate configuration and dependencies.
   *
   * @abstract
   * @param context - Execution context
   * @returns New runner instance
   */
  protected abstract createRunner(context: SolanaBotContext): Promise<TRunner>

  /**
   * Setup the runner before execution
   *
   * Override this method to perform runner-specific setup operations.
   * Default implementation calls runner.setup() if the method exists.
   *
   * @protected
   * @param runner - Runner instance to setup
   */
  protected async setupRunner(runner: TRunner): Promise<void> {
    if ('setup' in runner && typeof runner.setup === 'function') {
      await (runner.setup as () => Promise<void>)()
    }
  }

  /**
   * Get metrics from the runner
   *
   * Override this method to extract specific metrics from your runner type.
   * Default implementation returns undefined.
   *
   * @protected
   * @param runner - Runner instance
   * @returns Metrics object or undefined
   */
  protected getRunnerMetrics(_: TRunner): RunnerMetrics | undefined {
    return undefined
  }

  /**
   * Check if runner is currently running
   *
   * Override this method to provide runner-specific running state check.
   * Default implementation checks for 'isRunning' method.
   *
   * @protected
   * @param runner - Runner instance
   * @returns True if runner is running
   */
  protected isRunnerRunning(runner: TRunner): boolean {
    if ('isRunning' in runner && typeof runner.isRunning === 'function') {
      return (runner.isRunning as () => boolean)()
    }
    return false
  }

  /**
   * Stop the runner gracefully
   *
   * Override this method to provide runner-specific stop logic.
   * Default implementation calls runner.stop() if the method exists.
   *
   * @protected
   * @param runner - Runner instance
   */
  protected async stopRunner(runner: TRunner): Promise<void> {
    if ('cancel' in runner && typeof runner.cancel === 'function') {
      await (runner.cancel as () => Promise<void>)()
    }
  }

  /**
   * Cleanup runner resources
   *
   * Override this method to provide runner-specific cleanup logic.
   * Default implementation calls runner.cleanup() if the method exists.
   *
   * @protected
   * @param runner - Runner instance
   */
  protected async cleanupRunner(runner: TRunner): Promise<void> {
    if ('cleanup' in runner && typeof runner.cleanup === 'function') {
      await (runner.cleanup as () => Promise<void>)()
    }
  }

  /**
   * Start the runner with given configuration
   *
   * @param context - Execution context
   * @param blocking - Whether to block until completion (default: false)
   * @returns Promise that resolves when runner starts or completes
   */
  async start(context: SolanaBotContext, blocking: boolean = false): Promise<void> {
    if (
      this.runner &&
      this.state !== RunnerState.IDLE &&
      this.state !== RunnerState.STOPPED &&
      this.state !== RunnerState.ERROR
    ) {
      throw new Error(`Cannot start runner: currently ${this.state}`)
    }

    try {
      // Reset state for fresh start
      this.state = RunnerState.INITIALIZING
      this.startTime = Date.now()
      this.stopTime = undefined
      this.lastError = undefined
      this.stopRequested = false
      this.runner = null

      console.log('🎮 Starting runner...')

      // Create new runner instance
      this.runner = await this.createRunner(context)

      // Setup runner
      await this.setupRunner(this.runner)

      // Change state to running
      this.state = RunnerState.RUNNING

      console.log('✅ Runner started successfully')

      if (blocking) {
        // Blocking execution - wait for completion
        await this.executeRunner(context)
      } else {
        // Non-blocking execution - return immediately
        this.executeRunner(context).catch(error => {
          this.state = RunnerState.ERROR
          this.lastError = error.message
          console.error('❌ Runner execution failed:', error)
        })
      }
    } catch (error) {
      this.state = RunnerState.ERROR
      this.lastError = error instanceof Error ? error.message : 'Unknown error'
      throw error
    }
  }

  /**
   * Stop the runner gracefully
   *
   * @param timeout - Maximum time to wait for graceful shutdown
   * @returns Promise that resolves when runner is stopped
   */
  async stop(timeout?: number): Promise<void> {
    const actualTimeout = timeout ?? this.shutdownConfig.gracefulTimeout

    if (!this.runner || this.state === RunnerState.IDLE || this.state === RunnerState.STOPPED) {
      console.log('⚠️  No active runner to stop')
      return
    }

    try {
      this.state = RunnerState.STOPPING
      this.stopRequested = true

      console.log('🛑 Stopping runner...')

      // Request graceful stop
      await this.stopRunner(this.runner)

      // Wait for runner to stop gracefully with timeout
      const stopPromise = this.waitForStop()
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Stop timeout exceeded')), actualTimeout)
      })

      await Promise.race([stopPromise, timeoutPromise])

      // Cleanup
      await this.cleanupRunner(this.runner)

      // Run custom cleanup if provided
      if (this.shutdownConfig.cleanupCallback) {
        await this.shutdownConfig.cleanupCallback()
      }

      this.state = RunnerState.STOPPED
      this.stopTime = Date.now()

      console.log('✅ Runner stopped successfully')
    } catch (error) {
      this.state = RunnerState.ERROR
      this.lastError = error instanceof Error ? error.message : 'Stop failed'
      console.error('❌ Failed to stop runner gracefully:', error)

      // Force cleanup
      if (this.runner) {
        try {
          await this.cleanupRunner(this.runner)
        } catch (cleanupError) {
          console.error('❌ Cleanup failed:', cleanupError)
        }
      }

      if (this.shutdownConfig.forceShutdown) {
        this.state = RunnerState.STOPPED
        this.stopTime = Date.now()
        console.log('🔨 Force stopped runner')
      } else {
        throw error
      }
    }
  }

  /**
   * Get current runner status
   *
   * @returns Current status information
   */
  getStatus(): RunnerStatus {
    const status: RunnerStatus = {
      state: this.state,
      startTime: this.startTime,
      stopTime: this.stopTime,
      currentIteration: 0,
      lastError: this.lastError,
    }

    // Get metrics from runner if available
    if (this.runner && this.state === RunnerState.RUNNING) {
      try {
        const metrics = this.getRunnerMetrics(this.runner)
        if (metrics) {
          status.metrics = metrics
        }
      } catch {
        // Metrics not available
      }
    }

    return status
  }

  /**
   * Check if runner is currently active
   *
   * @returns True if runner is running
   */
  isActive(): boolean {
    return this.state === RunnerState.RUNNING
  }

  /**
   * Get the underlying runner instance
   *
   * @returns Runner instance or null if not initialized
   */
  getRunner(): TRunner | null {
    return this.runner
  }

  /**
   * Execute the runner and handle completion
   *
   * @private
   * @param context - Execution context
   */
  private async executeRunner(context: SolanaBotContext): Promise<void> {
    if (!this.runner) return

    try {
      await this.runner.execute(context)

      if (!this.stopRequested) {
        // Runner completed naturally
        this.state = RunnerState.STOPPED
        this.stopTime = Date.now()
        console.log('🏁 Runner completed successfully')
      }
    } catch (error) {
      if (!this.stopRequested) {
        this.state = RunnerState.ERROR
        this.lastError = error instanceof Error ? error.message : 'Execution failed'
      }
      throw error
    }
  }

  /**
   * Wait for runner to stop gracefully
   *
   * @private
   */
  private async waitForStop(): Promise<void> {
    if (!this.runner) return

    // Poll for runner state
    while (this.isRunnerRunning(this.runner)) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
}
