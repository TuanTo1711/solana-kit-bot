import type { SolanaBotContext } from './context'

/**
 * Represents the result of a command execution
 */
export interface ExecutorResult<T = string> {
  /** Whether the command executed successfully */
  success: boolean

  /** Human-readable message describing the result */
  message: string

  /** Optional error object if execution failed */
  error?: Error

  /** Optional data payload from the execution */
  data?: T
}

/**
 * Base configuration for all command runners
 */
export interface CommandExecutorConfig {
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
 * @template TContext - The context type for execution (extends SolanaBotContext)
 */
export interface CommandExecutor<TContext extends SolanaBotContext = SolanaBotContext> {
  /**
   * Executes the command with the given context
   *
   * @param context - The command execution context containing parameters and state
   * @returns Promise resolving to the command execution result
   */
  execute(context: TContext): Promise<ExecutorResult>

  /**
   * Validates the command context before execution
   *
   * @param context - The command execution context to validate
   * @returns Promise resolving to true if validation passes, false otherwise
   */
  validate?(context: TContext): Promise<boolean>

  /**
   * Performs setup operations before command execution
   *
   * @returns Promise that resolves when setup is complete
   */
  setup?(): Promise<void>

  /**
   * Performs cleanup operations after command execution
   *
   * @returns Promise that resolves when cleanup is complete
   */
  cleanup?(): Promise<void>
}

/**
 * Extended interface for asynchronous command runners
 *
 * @template TContext - The context type for execution (extends SolanaBotContext)
 */
export interface AsyncCommandExecutor<TContext extends SolanaBotContext = SolanaBotContext>
  extends CommandExecutor<TContext> {
  /**
   * Cancels the currently running command
   *
   * @returns Promise that resolves when cancellation is complete
   */
  cancel(): Promise<void>

  /**
   * Gets the current progress of the operation
   *
   * @returns Progress value (0-1) or -1 for indeterminate
   */
  getProgress(): number

  /**
   * Checks if the runner is currently executing
   *
   * @returns True if the runner is currently active
   */
  isRunning(): boolean
}
