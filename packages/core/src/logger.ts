import chalk from 'chalk'
import { configure } from 'safe-stable-stringify'
import { createLogger as createWinstonLogger, format, transports, Logger as Winston } from 'winston'
import type { LogEntry, LoggerConfig, LogLevel } from '~/types'

/**
 * A comprehensive logging utility built on top of Winston with enhanced formatting.
 *
 * Provides advanced logging capabilities including configurable log levels,
 * color-coded output, module-specific prefixes, error handling with stack traces,
 * timing utilities for performance monitoring, and safe JSON serialization
 * with circular reference handling.
 *
 * @example
 * ```typescript
 * const logger = new Logger({ level: 'debug', enableColors: true, moduleName: 'MyModule' })
 * logger.info('Application started')
 * logger.error(new Error('Something went wrong'))
 *
 * const endTimer = logger.startTimer('operation')
 * // ... perform operation
 * endTimer() // Logs: "Timer [operation]: 150ms"
 * ```
 */
export class Logger {
  private readonly logger: Winston
  private readonly stringify: (value: any, replacer?: any, space?: any) => string
  private readonly config: Required<LoggerConfig>

  /**
   * Creates a new Logger instance with the specified configuration.
   *
   * @param {LoggerConfig} [userConfig] - Optional configuration object
   * @param {LogLevel} [userConfig.level='info'] - Log level threshold
   * @param {boolean} [userConfig.enableColors=true] - Whether to colorize output
   * @param {string} [userConfig.moduleName=''] - Module name prefix for log messages
   */
  constructor(userConfig: LoggerConfig = {}) {
    this.config = { level: 'info', enableColors: true, moduleName: '', ...userConfig }
    this.stringify = this.createStringifier()
    this.logger = this.createWinstonLogger()
  }

  /**
   * Creates a JSON stringifier with safe handling of circular references and BigInt values.
   *
   * @private
   * @returns {Function} Configured stringify function that safely handles circular refs and BigInt
   */
  private createStringifier() {
    return configure({
      bigint: true,
      circularValue: '[Circular]',
      deterministic: false,
    })
  }

  /**
   * Creates and configures the underlying Winston logger instance.
   *
   * @private
   * @returns {Winston} Configured Winston logger with appropriate transports and formatting
   */
  private createWinstonLogger(): Winston {
    return createWinstonLogger({
      level: this.config.level,
      format: format.combine(format.timestamp(), format.errors({ stack: true })),
      transports: this.createTransports(),
      exitOnError: false,
    })
  }

  /**
   * Creates the transport array for Winston logger.
   *
   * Currently only includes console transport with custom formatting.
   * Future versions may include file or remote transports.
   *
   * @private
   * @returns {any[]} Array of Winston transports
   */
  private createTransports(): any[] {
    const transports: any[] = []
    transports.push(this.createConsoleTransport())
    return transports
  }

  /**
   * Creates a console transport with custom formatting.
   *
   * @private
   * @returns {any} Configured console transport with timestamp and error formatting
   */
  private createConsoleTransport() {
    return new transports.Console({
      format: format.combine(
        format.timestamp({ format: 'DD/MM/YYYY HH:mm:ss' }),
        format.errors({ stack: true }),
        format.printf((info: any) => this.formatConsoleMessage(info))
      ),
    })
  }

  /**
   * Formats a log entry for console output with timestamp, module name, level, and metadata.
   *
   * @param info - Log entry information
   * @returns Formatted log message string
   */
  private formatConsoleMessage(info: LogEntry): string {
    const parts = [
      this.formatTimestamp(info.timestamp),
      this.formatModuleName(info.moduleName),
      this.formatLevel(info.level),
      info.message,
      this.formatErrorStack(info.stack),
      this.formatMetadata(info),
    ]

    return parts.filter(Boolean).join('')
  }

  /**
   * Formats the timestamp portion of the log message.
   *
   * @param timestamp - ISO timestamp string
   * @returns Formatted timestamp with gray color
   */
  private formatTimestamp(timestamp?: string): string {
    return timestamp ? `[${chalk.gray(timestamp)}] ` : ''
  }

  /**
   * Formats the module name portion of the log message.
   *
   * @param moduleName - Module name from log entry or config
   * @returns Formatted module name with green color
   */
  private formatModuleName(moduleName?: string): string {
    const name = moduleName || this.config.moduleName
    return name ? `[${chalk.green(name)}] ` : ''
  }

  /**
   * Formats the log level portion of the message.
   *
   * @param level - Log level string
   * @returns Formatted level with appropriate color if enabled
   */
  private formatLevel(level: string): string {
    return this.config.enableColors ? this.colorizeLevel(level) : `[${level.toUpperCase()}] `
  }

  /**
   * Formats error stack traces with red coloring.
   *
   * @param stack - Error stack trace string
   * @returns Formatted stack trace or empty string
   */
  private formatErrorStack(stack?: string): string {
    return stack ? `\n${chalk.red(stack)}` : ''
  }

  /**
   * Formats additional metadata as JSON, excluding standard log fields.
   *
   * @param info - Complete log entry
   * @returns Formatted metadata JSON or empty string
   */
  private formatMetadata(info: LogEntry): string {
    const { level, message, timestamp, moduleName, stack, ...meta } = info
    return Object.keys(meta).length > 0 ? `\n${this.stringify(meta, null, 2)}` : ''
  }

  /**
   * Applies color coding to log levels based on severity.
   *
   * @param level - Log level string
   * @returns Colorized level string
   */
  private colorizeLevel(level: string): string {
    const colorMap: Record<string, any> = {
      error: chalk.red,
      warn: chalk.yellow,
      info: chalk.blue,
      verbose: chalk.cyan,
      debug: chalk.magenta,
      silly: chalk.gray,
    }

    const colorFn = colorMap[level] || chalk.white
    return colorFn(`[${level.toUpperCase()}] `)
  }

  /**
   * Sets the minimum log level threshold.
   *
   * @param {LogLevel} level - New log level threshold (error, warn, info, verbose, debug, silly)
   */
  public setLevel(level: LogLevel): void {
    this.logger.level = level
  }

  /**
   * Gets the current log level threshold.
   *
   * @returns {string} Current log level setting
   */
  public getLevel(): string {
    return this.logger.level
  }

  /**
   * Checks if a specific log level is enabled based on current threshold.
   *
   * @param {LogLevel} level - Log level to check against current threshold
   * @returns {boolean} True if the level is enabled and will be logged
   */
  public isLevelEnabled(level: LogLevel): boolean {
    return this.logger.isLevelEnabled(level)
  }

  /**
   * Logs an error message or Error object.
   *
   * @param message - Error message string
   * @param meta - Additional metadata
   */
  public error(message: string, meta?: object): void
  /**
   * Logs an Error object with stack trace.
   *
   * @param error - Error object
   * @param meta - Additional metadata
   */
  public error(error: Error, meta?: object): void
  public error(messageOrError: string | Error, meta?: object): void {
    if (messageOrError instanceof Error) {
      this.logError(messageOrError, meta)
    } else {
      this.logger.error(messageOrError, meta)
    }
  }

  /**
   * Logs a warning message.
   *
   * @param message - Warning message
   * @param meta - Additional metadata
   */
  public warn(message: string, meta?: object): void {
    this.logger.warn(message, meta)
  }

  /**
   * Logs an informational message.
   *
   * @param message - Info message
   * @param meta - Additional metadata
   */
  public info(message: string, meta?: object): void {
    this.logger.info(message, meta)
  }

  /**
   * Logs a verbose message.
   *
   * @param message - Verbose message
   * @param meta - Additional metadata
   */
  public verbose(message: string, meta?: object): void {
    this.logger.verbose(message, meta)
  }

  /**
   * Logs a debug message.
   *
   * @param message - Debug message
   * @param meta - Additional metadata
   */
  public debug(message: string, meta?: object): void {
    this.logger.debug(message, meta)
  }

  /**
   * Logs a silly-level message (lowest priority).
   *
   * @param message - Silly message
   * @param meta - Additional metadata
   */
  public silly(message: string, meta?: object): void {
    this.logger.silly(message, meta)
  }

  /**
   * Logs a message at the specified level.
   *
   * @param level - Log level
   * @param message - Log message
   * @param meta - Additional metadata
   */
  public log(level: LogLevel, message: string, meta?: object): void {
    this.logger.log(level, message, meta)
  }

  /**
   * Starts a timer and returns a function to end it and log the duration.
   *
   * Useful for measuring operation performance. The returned function logs
   * the elapsed time at info level when called.
   *
   * @param {string} label - Timer label for identification in logs
   * @returns {() => void} Function to call when operation completes
   *
   * @example
   * ```typescript
   * const endTimer = logger.startTimer('database-query')
   * // ... perform operation
   * endTimer() // Logs: "Timer [database-query]: 150ms"
   * ```
   */
  public startTimer(label: string): () => void {
    const startTime = Date.now()

    return () => {
      const duration = Date.now() - startTime
      this.info(`Timer [${label}]: ${duration}ms`)
    }
  }

  /**
   * Times an async operation and logs the duration.
   *
   * Automatically handles both success and error cases, ensuring the timer
   * is always logged regardless of whether the operation succeeds or fails.
   *
   * @template T - The return type of the async function
   * @param {string} label - Timer label for identification in logs
   * @param {() => Promise<T>} fn - Async function to time and execute
   * @returns {Promise<T>} Promise resolving to the function's result
   *
   * @example
   * ```typescript
   * const result = await logger.timeAsync('api-call', async () => {
   *   return await fetch('/api/data')
   * })
   * ```
   */
  public async timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const endTimer = this.startTimer(label)

    try {
      const result = await fn()
      endTimer()
      return result
    } catch (error) {
      endTimer()
      throw error
    }
  }

  /**
   * Internal method to log Error objects with proper stack trace handling.
   *
   * @param error - Error object to log
   * @param meta - Additional metadata
   */
  private logError(error: Error, meta?: object): void {
    this.logger.error(error.message, {
      stack: error.stack,
      ...meta,
    })
  }
}

/**
 * Factory function to create a Logger instance with a specific module name.
 *
 * Convenience function for creating loggers with module-specific prefixes.
 * The module name will appear in all log messages from this logger instance.
 *
 * @param {string} moduleName - Name of the module for log prefixing
 * @param {LoggerConfig} [config] - Optional additional configuration to merge
 * @returns {Logger} Configured Logger instance with module name prefix
 *
 * @example
 * ```typescript
 * const logger = createLogger('UserService', { level: 'debug' })
 * logger.info('User created successfully')
 * // Output: [25/12/2024 14:30:45] [UserService] [INFO] User created successfully
 * ```
 */
export const createLogger = (moduleName: string, config?: LoggerConfig) =>
  new Logger({ ...config, moduleName })
