/**
 * @fileoverview Abstract base runner providing common functionality for all command runners
 *
 * This module defines the BaseRunner class which serves as the foundation for all command
 * runners in the system. It provides essential functionality including configuration management,
 * logging, error handling, retry mechanisms, and timeout controls.
 */

import type { CommandRunner, RunnerConfig, RunnerResult, SolanaBotContext } from '~/types'

/**
 * Abstract base class for all command runners
 *
 * Provides common functionality and utilities that all command runners need,
 * including configuration management, logging, error handling, and execution utilities.
 * Subclasses must implement the execute method to define their specific behavior.
 *
 * @abstract
 * @implements CommandRunner
 */
export abstract class BaseRunner implements CommandRunner<SolanaBotContext> {
  protected config: RunnerConfig

  /**
   * Creates a new BaseRunner instance
   *
   * @param config - Runner configuration with optional overrides
   */
  constructor(config: RunnerConfig) {
    this.config = config
  }

  /**
   * Executes the command with the given context
   *
   * This abstract method must be implemented by all subclasses to define
   * their specific execution logic.
   *
   * @abstract
   * @param context - The command execution context
   * @returns Promise resolving to the command result
   */
  abstract execute(context: SolanaBotContext): Promise<RunnerResult>

  /**
   * Validates the command context before execution
   *
   * Override this method in subclasses to implement custom validation logic.
   * The default implementation performs basic context validation.
   *
   * @param context - The command execution context to validate
   * @returns Promise resolving to true if validation passes
   * @throws Error if validation fails
   */
  async validate(context: SolanaBotContext): Promise<boolean> {
    try {
      this.validateContext(context)
      return true
    } catch (error) {
      this.logError(
        context,
        `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      return false
    }
  }

  /**
   * Gets the configured timeout value
   *
   * @returns Timeout in milliseconds
   */
  protected getTimeout(): number {
    return this.config.timeout ?? 0
  }

  /**
   * Gets the configured number of retries
   *
   * @returns Number of retry attempts
   */
  protected getRetries(): number {
    return this.config.maxRetries ?? 0
  }

  /**
   * Logs an info message with cyan color
   */
  protected logInfo(context: SolanaBotContext, message: string, ...args: any[]): void {
    this.writeLog((context as any).stdout, 'INFO', 'ℹ️ ', '\x1b[36m', message, ...args)
  }

  /**
   * Logs a success message with green color
   */
  protected logSuccess(context: SolanaBotContext, message: string, ...args: any[]): void {
    this.writeLog((context as any).stdout, 'SUCCESS', '✅', '\x1b[32m', message, ...args)
  }

  /**
   * Logs a warning message with yellow color
   */
  protected logWarning(context: SolanaBotContext, message: string, ...args: any[]): void {
    this.writeLog((context as any).stdout, 'WARNING', '⚠️ ', '\x1b[33m', message, ...args)
  }

  /**
   * Logs an error message with red color
   */
  protected logError(context: SolanaBotContext, message: string, ...args: any[]): void {
    this.writeLog((context as any).stderr, 'ERROR', '❌', '\x1b[31m', message, ...args)
  }

  /**
   * Logs a debug message with gray color
   */
  protected logDebug(context: SolanaBotContext, message: string, ...args: any[]): void {
    this.writeLog((context as any).stdout, 'DEBUG', '🐛', '\x1b[90m', message, ...args)
  }

  /**
   * Writes a formatted log message to the specified stream
   */
  private writeLog(
    stream: NodeJS.WritableStream | undefined,
    level: string,
    emoji: string,
    colorCode: string,
    message: string,
    ...args: any[]
  ): void {
    const output = stream || process.stdout
    const timestamp = new Date().toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh',
    })

    const formattedMessage = args.length > 0 ? require('util').format(message, ...args) : message

    const logLine = `[${timestamp}] ${colorCode}[${level}] ${emoji} ${formattedMessage}\x1b[0m\n`
    output.write(logLine)
  }

  /**
   * Creates a successful command result
   *
   * @param message - Optional success message
   * @param data - Optional result data
   * @returns CommandResult indicating success
   */
  protected createSuccessResult(message?: string, data?: any): RunnerResult {
    return {
      success: true,
      message: message ?? '',
      data,
    }
  }

  /**
   * Creates an error command result
   *
   * @param error - The error that occurred
   * @returns CommandResult indicating failure
   */
  protected createErrorResult(error: Error): RunnerResult {
    return {
      success: false,
      message: error.message,
      error,
    }
  }

  /**
   * Executes an operation with automatic retry logic
   *
   * Implements exponential backoff between retry attempts with a maximum delay cap.
   * Logs retry attempts and failures for debugging purposes.
   *
   * @template T - The return type of the operation
   * @param context - The command execution context (for logging)
   * @param operation - The async operation to execute
   * @param retries - Number of retry attempts (defaults to configured value)
   * @returns Promise resolving to the operation result
   * @throws The last error if all retry attempts fail
   */
  protected async executeWithRetry<T>(
    context: SolanaBotContext,
    operation: () => Promise<T>,
    retries = this.getRetries()
  ): Promise<T> {
    let lastError: Error
    let delay = 1000 // Start with 1 second
    const maxDelay = 30000 // Max 30 seconds
    const backoffMultiplier = 1.5 // More gradual backoff

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          this.logInfo(context, `Retry attempt ${attempt}/${retries} (delay: ${delay}ms)`)
        }
        return await operation()
      } catch (error) {
        lastError = error as Error
        this.logWarning(context, `Attempt ${attempt + 1} failed: ${lastError.message}`)

        // Skip delay on last attempt
        if (attempt < retries) {
          await this.sleep(delay)
          // Exponential backoff with jitter to prevent thundering herd
          delay = Math.min(delay * backoffMultiplier + Math.random() * 1000, maxDelay)
        }
      }
    }

    throw lastError!
  }

  /**
   * Executes an operation with a timeout
   *
   * Races the operation against a timeout timer, rejecting with a timeout error
   * if the operation doesn't complete within the specified time.
   *
   * @template T - The return type of the operation
   * @param operation - The async operation to execute
   * @param timeout - Timeout in milliseconds (defaults to configured value)
   * @returns Promise resolving to the operation result
   * @throws Error if the operation times out
   */
  protected async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout = this.getTimeout()
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`))
      }, timeout)
    })

    try {
      const result = await Promise.race([operation(), timeoutPromise])
      clearTimeout(timeoutId!)
      return result
    } catch (error) {
      clearTimeout(timeoutId!)
      throw error
    }
  }

  /**
   * Sleeps for the specified duration
   *
   * @param ms - Duration to sleep in milliseconds
   * @returns Promise that resolves after the specified delay
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      const timeoutId = setTimeout(resolve, ms)
      // Add cleanup capability for early cancellation
      ;(resolve as any).cancel = () => clearTimeout(timeoutId)
    })
  }

  /**
   * Validates the basic structure of a command context
   *
   * Ensures the context and its required properties are present.
   *
   * @param context - The context to validate
   * @throws Error if validation fails
   */
  protected validateContext(context: SolanaBotContext): void {
    if (!context) {
      throw Error('Context is required')
    }
  }
}
