/**
 * @fileoverview Runner interfaces and types for command execution
 *
 * This module defines the core interfaces and types for the runner system,
 * which provides a framework for executing commands with various strategies,
 * timing controls, and execution patterns.
 */

import type { SolanaBotContext } from './context'

/**
 * Represents the result of a command execution
 *
 * Contains the outcome of a runner execution including success/failure status,
 * messages, timing information, and optional data payload.
 */
export interface RunnerResult {
  /** Whether the command executed successfully */
  success: boolean

  /** Human-readable message describing the result */
  message: string

  /** Optional error object if execution failed */
  error?: Error

  /** Optional data payload from the execution */
  data?: any
}

/**
 * Base configuration for all command runners
 *
 * Provides common configuration options that all runners can use,
 * including timeouts, retry policies, and operational settings.
 */
export interface RunnerConfig {
  /** Maximum execution time in milliseconds before timeout */
  timeout?: number

  /** Maximum number of retry attempts on failure */
  maxRetries?: number

  /** Delay between retry attempts in milliseconds */
  retryDelay?: number
}

/**
 * Base interface for all command runners
 *
 * Defines the core contract that all command runners must implement,
 * including required execution method and optional lifecycle hooks
 * for setup, validation, and cleanup operations.
 *
 * @template TContext - The context type for execution (extends SolanaBotContext)
 */
export interface CommandRunner<TContext extends SolanaBotContext = SolanaBotContext> {
  /**
   * Executes the command with the given context
   *
   * This is the main execution method that all runners must implement.
   * It should handle the command execution logic and return appropriate results.
   *
   * @param context - The command execution context containing parameters and state
   * @returns Promise resolving to the command execution result
   *
   * @example
   * ```typescript
   * async execute(context: SolanaBotContext): Promise<RunnerResult> {
   *   try {
   *     // Perform command logic here
   *     const result = await this.performOperation(context)
   *
   *     return {
   *       success: true,
   *       message: 'Operation completed successfully',
   *       startTime: Date.now(),
   *       endTime: Date.now(),
   *       duration: 100,
   *       data: result
   *     }
   *   } catch (error) {
   *     return {
   *       success: false,
   *       message: 'Operation failed',
   *       error: error as Error,
   *       startTime: Date.now(),
   *       endTime: Date.now(),
   *       duration: 50
   *     }
   *   }
   * }
   * ```
   */
  execute(context: TContext): Promise<RunnerResult>

  /**
   * Validates the command context before execution
   *
   * Optional method to perform validation checks on the execution context
   * before running the command. Should throw or return false if validation fails.
   *
   * @param context - The command execution context to validate
   * @returns Promise resolving to true if validation passes, false otherwise
   *
   * @example
   * ```typescript
   * async validate(context: SolanaBotContext): Promise<boolean> {
   *   if (!context.payer) {
   *     throw new Error('Payer wallet is required')
   *   }
   *
   *   if (!context.provider) {
   *     return false
   *   }
   *
   *   return true
   * }
   * ```
   */
  validate?(context: TContext): Promise<boolean>

  /**
   * Performs setup operations before command execution
   *
   * Optional method to initialize resources, connections, or state
   * required for command execution. Called before execute().
   *
   * @returns Promise that resolves when setup is complete
   *
   * @example
   * ```typescript
   * async setup(): Promise<void> {
   *   // Initialize connections
   *   await this.connectToDatabase()
   *
   *   // Prepare resources
   *   this.initializeCache()
   *
   *   // Validate environment
   *   await this.checkEnvironment()
   * }
   * ```
   */
  setup?(): Promise<void>

  /**
   * Performs cleanup operations after command execution
   *
   * Optional method to clean up resources, close connections, or
   * finalize state after command execution. Called after execute().
   *
   * @returns Promise that resolves when cleanup is complete
   *
   * @example
   * ```typescript
   * async cleanup(): Promise<void> {
   *   // Close connections
   *   await this.disconnectFromDatabase()
   *
   *   // Clear caches
   *   this.clearCache()
   *
   *   // Release resources
   *   this.releaseResources()
   * }
   * ```
   */
  cleanup?(): Promise<void>
}

/**
 * Extended interface for asynchronous command runners
 *
 * Adds support for cancellation and progress monitoring to the base CommandRunner.
 * Useful for long-running operations that need to be controlled or monitored.
 *
 * @template TContext - The context type for execution (extends SolanaBotContext)
 */
export interface AsyncCommandRunner<TContext extends SolanaBotContext = SolanaBotContext>
  extends CommandRunner<TContext> {
  /**
   * Cancels the currently running command
   *
   * Requests graceful cancellation of the current operation. The runner
   * should stop processing and perform necessary cleanup.
   *
   * @returns Promise that resolves when cancellation is complete
   *
   * @example
   * ```typescript
   * async cancel(): Promise<void> {
   *   this.isCancelled = true
   *
   *   // Cancel ongoing operations
   *   this.abortController.abort()
   *
   *   // Cleanup resources
   *   await this.cleanup()
   * }
   * ```
   */
  cancel(): Promise<void>

  /**
   * Gets the current progress of the operation
   *
   * Returns a value between 0 and 1 indicating completion percentage,
   * or -1 if progress cannot be determined.
   *
   * @returns Progress value (0-1) or -1 for indeterminate
   *
   * @example
   * ```typescript
   * getProgress(): number {
   *   if (this.totalSteps === 0) return -1
   *   return this.completedSteps / this.totalSteps
   * }
   * ```
   */
  getProgress(): number

  /**
   * Checks if the runner is currently executing
   *
   * @returns True if the runner is currently active
   */
  isRunning(): boolean
}

/**
 * Execution context for iterative runners
 *
 * Tracks state and metrics across multiple iterations of execution,
 * providing insights into performance and progress.
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
  recentResults: RunnerResult[]

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
