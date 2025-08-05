/**
 * @fileoverview Shutdown and lifecycle management types
 *
 * Defines types and interfaces for managing runner lifecycle, including
 * graceful shutdown, signal handling, and state management.
 *
 * @author Yuuta - To Hoang Tuan
 * @version 1.0.0
 * @since 2024
 */

import type { BaseRunner } from '../runner'
import type { SolanaBotContext } from './context'

/**
 * Runner states for tracking lifecycle
 *
 * @enum {string}
 */
export enum RunnerState {
  /** Initial state, runner not started */
  IDLE = 'idle',
  /** Runner is initializing */
  INITIALIZING = 'initializing',
  /** Runner is actively running */
  RUNNING = 'running',
  /** Runner is in the process of stopping */
  STOPPING = 'stopping',
  /** Runner has stopped completely */
  STOPPED = 'stopped',
  /** Runner encountered an error */
  ERROR = 'error',
}

/**
 * Performance metrics for runner monitoring
 *
 * @interface
 */
export interface RunnerMetrics {
  /** Success rate as percentage */
  successRate: number
  /** Average time per iteration in milliseconds */
  averageIterationTime: number
  /** Total number of operations/trades executed */
  totalOperations: number
  /** Memory usage in MB (optional) */
  memoryUsage?: number
  /** Uptime in milliseconds */
  uptime?: number
}

/**
 * Runner status information
 *
 * @interface
 */
export interface RunnerStatus {
  /** Current state of the runner */
  state: RunnerState
  /** Start timestamp */
  startTime?: number | undefined
  /** Stop timestamp */
  stopTime?: number | undefined
  /** Current iteration count */
  currentIteration: number
  /** Last error message if any */
  lastError?: string | undefined
  /** Performance metrics snapshot */
  metrics?: RunnerMetrics | undefined
}

/**
 * Configuration for shutdown behavior
 *
 * @interface
 */
export interface ShutdownConfig {
  /** Maximum time to wait for graceful shutdown (ms) */
  gracefulTimeout: number
  /** Whether to force shutdown after timeout */
  forceShutdown: boolean
  /** Cleanup callback to run before shutdown */
  cleanupCallback?: () => Promise<void>
}

/**
 * Signal handler configuration
 *
 * @interface
 */
export interface SignalHandlerConfig {
  /** Signals to intercept (default: ['SIGINT', 'SIGTERM']) */
  signals: NodeJS.Signals[]
  /** Whether to restore original handlers after handling */
  restoreOriginal: boolean
  /** Custom handler for specific signals */
  customHandlers?: Record<string, () => Promise<void>>
}

/**
 * Abstract interface for controllable runners
 *
 * Defines the contract for runners that support lifecycle management,
 * graceful shutdown, and status monitoring.
 *
 * @interface
 * @template TRunner The type of runner being controlled
 */
export interface IRunnerController<TRunner extends BaseRunner = BaseRunner> {
  /**
   * Start the runner with given configuration
   *
   * @param context - Execution context
   * @param blocking - Whether to block until completion
   * @returns Promise that resolves when runner starts or completes
   */
  start(context: SolanaBotContext, blocking?: boolean): Promise<void>

  /**
   * Stop the runner gracefully
   *
   * @param timeout - Maximum time to wait for graceful shutdown
   * @returns Promise that resolves when runner is stopped
   */
  stop(timeout?: number): Promise<void>

  /**
   * Get current runner status
   *
   * @returns Current status information
   */
  getStatus(): RunnerStatus

  /**
   * Check if runner is currently active
   *
   * @returns True if runner is running
   */
  isActive(): boolean

  /**
   * Get the underlying runner instance
   *
   * @returns Runner instance or null if not initialized
   */
  getRunner(): TRunner | null
}

/**
 * Interface for signal handlers
 *
 * @interface
 */
export interface ISignalHandler {
  /**
   * Setup signal handlers for graceful shutdown
   *
   * @param config - Configuration for signal handling
   */
  setupSignalHandlers(config?: Partial<SignalHandlerConfig>): void

  /**
   * Restore original signal handlers
   */
  restoreSignalHandlers(): void

  /**
   * Check if signal handlers are currently active
   *
   * @returns True if handlers are active
   */
  isActive(): boolean
}
