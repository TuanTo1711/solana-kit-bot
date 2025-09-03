import { GracefulShutdownManager, type GracefulShutdownConfig } from '~/manager'
import type { CommandExecutor, ExecutorConfig, ExecutorResult, SolanaBotContext } from '~/types'

/**
 * Abstract base class for all command executors in the Solana Kit Bot system.
 *
 * Provides a foundation with common functionality including configuration management,
 * error handling, retry logic with exponential backoff, timeout handling, and validation utilities.
 * All concrete executor implementations should extend this class.
 *
 * @abstract
 * @implements {CommandExecutor<SolanaBotContext>}
 *
 * @example
 * ```typescript
 * class MyExecutor extends BaseExecutor {
 *   async execute(context: SolanaBotContext): Promise<ExecutorResult> {
 *     // Custom implementation
 *     return this.createSuccessResult('Task completed')
 *   }
 * }
 *
 * const executor = new MyExecutor({ timeout: 30000, maxRetries: 3 })
 * const result = await executor.execute(context)
 * ```
 */
export abstract class BaseExecutor implements CommandExecutor<SolanaBotContext> {
  protected config: ExecutorConfig
  protected shutdownManager?: GracefulShutdownManager | undefined

  /**
   * Creates a new BaseExecutor instance with the specified configuration.
   *
   * @param config - Configuration object with optional timeout, retry, and delay settings
   */
  constructor(config: ExecutorConfig) {
    this.config = config
    this.setupGracefulShutdown()
  }

  /**
   * Executes the command with the given context.
   *
   * This abstract method must be implemented by all subclasses to define
   * their specific execution logic. The method should handle all business logic
   * and return a structured result indicating success or failure.
   *
   * @abstract
   * @param context - The command execution context containing logger, configuration, and state
   * @returns Promise resolving to the command execution result
   */
  abstract execute(context: SolanaBotContext): Promise<ExecutorResult>

  /**
   * Validates the command context before execution.
   *
   * Override this method in subclasses to implement custom validation logic.
   * The default implementation performs basic context validation including
   * null checks and required property verification.
   *
   * @param context - The command execution context to validate
   * @returns Promise resolving to true if validation passes, false otherwise
   * @throws When validation encounters critical errors
   */
  async validate(context: SolanaBotContext): Promise<boolean> {
    try {
      this.validateContext(context)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Gets the configured timeout value.
   *
   * @returns Timeout duration in milliseconds, or 0 if no timeout is set
   */
  protected getTimeout(): number {
    return this.config.timeout ?? 0
  }

  /**
   * Gets the configured number of retry attempts.
   *
   * @returns Maximum number of retry attempts, or 0 if no retries are configured
   */
  protected getRetries(): number {
    return this.config.maxRetries ?? 0
  }

  /**
   * Creates a successful command result with optional message and data.
   *
   * @param message - Optional success message describing the operation outcome
   * @param data - Optional result data to include in the response
   * @returns ExecutorResult object indicating successful execution
   */
  protected createSuccessResult(message?: string, data?: any): ExecutorResult {
    return {
      success: true,
      message: message ?? 'Run successfully',
      data,
    }
  }

  /**
   * Creates an error command result from an exception.
   *
   * @param error - The error that occurred during execution
   * @returns ExecutorResult object indicating failed execution with error details
   */
  protected createErrorResult(error: Error): ExecutorResult {
    return {
      success: false,
      message: error.message ?? 'Unknown error',
      error,
    }
  }

  /**
   * Executes an operation with automatic retry logic and exponential backoff.
   *
   * Implements exponential backoff with jitter between retry attempts to prevent
   * thundering herd problems. Logs retry attempts and failures for debugging.
   * The delay increases by 1.5x each attempt with random jitter, capped at 30 seconds.
   *
   * @template T - The return type of the operation
   * @param context - The command execution context for logging purposes
   * @param operation - The async operation to execute with retries
   * @param retries - Number of retry attempts (defaults to configured maxRetries)
   * @returns Promise resolving to the operation result
   * @throws The last error encountered if all retry attempts fail
   *
   * @example
   * ```typescript
   * const result = await this.executeWithRetry(
   *   context,
   *   async () => await someApiCall(),
   *   3
   * )
   * ```
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    retries = this.getRetries()
  ): Promise<T> {
    let lastError: Error = new Error('Unknown error')
    let delay = 1000
    const maxDelay = 30000
    const backoffMultiplier = 1.5

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : lastError

        if (attempt < retries) {
          await this.sleep(delay)
          delay = Math.min(delay * backoffMultiplier + Math.random() * 1000, maxDelay)
        }
      }
    }

    throw lastError
  }

  /**
   * Executes an operation with a timeout using Promise.race.
   *
   * Races the operation against a timeout timer, rejecting with a timeout error
   * if the operation doesn't complete within the specified time. Properly cleans up
   * the timeout to prevent memory leaks.
   *
   * @template T - The return type of the operation
   * @param operation - The async operation to execute
   * @param timeout - Timeout in milliseconds (defaults to configured timeout value)
   * @returns Promise resolving to the operation result
   * @throws Timeout error if operation doesn't complete in time
   *
   * @example
   * ```typescript
   * const result = await this.executeWithTimeout(
   *   async () => await longRunningOperation(),
   *   10000 // 10 second timeout
   * )
   * ```
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
   * Sleeps for the specified duration using setTimeout.
   *
   * @param ms - Duration to sleep in milliseconds
   * @returns Promise that resolves after the specified delay
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Validates the basic structure of a command context.
   *
   * Ensures the context object and its required properties are present.
   * Override this method in subclasses for more specific validation requirements.
   *
   * @param context - The context object to validate
   * @throws Validation error if context is invalid or missing required properties
   */
  protected validateContext(context: SolanaBotContext): void {
    if (!context) {
      throw Error('Context is required')
    }
  }

  /**
   * Setup graceful shutdown handling based on configuration
   */
  private setupGracefulShutdown(): void {
    if (!this.config.gracefulShutdown) return

    const shutdownConfig: GracefulShutdownConfig =
      typeof this.config.gracefulShutdown === 'boolean' ? {} : this.config.gracefulShutdown

    this.shutdownManager = new GracefulShutdownManager({
      signals: ['SIGTERM', 'SIGINT'],
      hotkeys: ['q', 'escape'],
      gracePeriod: 15000,
      exitProcess: false, // Only cleanup command, don't exit app
      shutdownMessage: `${this.constructor.name} cleanup`,
      ...shutdownConfig,
    })

    this.shutdownManager.registerCallback(this.onShutdown.bind(this))
    this.shutdownManager.enable()
  }

  /**
   * Called when graceful shutdown is initiated.
   * Override this method to implement custom cleanup logic.
   */
  protected abstract onShutdown(): Promise<void>

  /**
   * Add a callback to be executed during shutdown
   */
  protected addShutdownCallback(callback: () => Promise<void>): void {
    this.shutdownManager?.registerCallback(callback)
  }

  /**
   * Manually trigger graceful shutdown
   */
  protected async triggerShutdown(reason = 'Manual shutdown'): Promise<void> {
    await this.shutdownManager?.shutdown(reason)
  }

  /**
   * Check if shutdown is in progress
   */
  protected isShuttingDown(): boolean {
    return this.shutdownManager?.isShutdownInProgress() ?? false
  }

  /**
   * Cleanup method called when the executor is being destroyed
   */
  public async cleanup(): Promise<void> {
    this.shutdownManager?.disable()
    this.shutdownManager = undefined
  }
}
