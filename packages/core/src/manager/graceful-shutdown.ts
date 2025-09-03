import chalk from 'chalk'

/**
 * Configuration for graceful shutdown behavior
 */
export interface GracefulShutdownConfig {
  /** Process signals to listen for (default: ['SIGTERM', 'SIGINT']) */
  signals?: string[]
  /** Hotkeys to trigger shutdown (default: ['q', 'escape', 'ctrl+c']) */
  hotkeys?: string[]
  /** Maximum time to wait for graceful shutdown (default: 30000ms) */
  gracePeriod?: number
  /** Custom shutdown message */
  shutdownMessage?: string
  /** Whether to clear screen on shutdown (default: false) */
  clearScreen?: boolean
  /** Whether to exit process after cleanup (default: false) */
  exitProcess?: boolean
}

/**
 * Graceful shutdown manager for handling process termination signals and user input
 *
 * Designed for CLI applications and long-running processes that need clean termination.
 * Supports both process signals (SIGTERM, SIGINT) and keyboard shortcuts.
 *
 * @example
 * ```typescript
 * const shutdownManager = new GracefulShutdownManager({
 *   signals: ['SIGTERM', 'SIGINT'],
 *   hotkeys: ['q', 'escape'],
 *   gracePeriod: 10000
 * })
 *
 * shutdownManager.registerCallback(async () => {
 *   console.log('Cleaning up resources...')
 *   await cleanup()
 * })
 *
 * shutdownManager.enable()
 * ```
 */
export class GracefulShutdownManager {
  private shutdownCallbacks: Array<() => Promise<void>> = []
  private isShuttingDown = false
  private isEnabled = false
  private keyListener?: ((key: string) => void) | undefined
  private signalListeners = new Map<string, () => void>()

  constructor(private config: GracefulShutdownConfig = {}) {
    this.config = {
      signals: ['SIGTERM', 'SIGINT'],
      hotkeys: ['q', 'escape', 'ctrl+c'],
      gracePeriod: 30000,
      shutdownMessage: 'Shutdown initiated',
      clearScreen: false,
      exitProcess: false,
      ...config,
    }
  }

  /**
   * Enable graceful shutdown handling
   */
  enable(): void {
    if (this.isEnabled) return

    this.isEnabled = true
    this.setupSignalHandlers()
    this.setupKeyHandlers()
  }

  /**
   * Disable graceful shutdown handling and cleanup listeners
   */
  disable(): void {
    if (!this.isEnabled) return

    this.isEnabled = false
    this.cleanupListeners()
  }

  /**
   * Register a callback to be executed during shutdown
   */
  registerCallback(callback: () => Promise<void>): void {
    this.shutdownCallbacks.push(callback)
  }

  /**
   * Clear all registered callbacks
   */
  clearCallbacks(): void {
    this.shutdownCallbacks.length = 0
  }

  /**
   * Manually trigger graceful shutdown
   */
  async shutdown(reason = 'Manual shutdown'): Promise<void> {
    await this.initiateShutdown(reason)
  }

  /**
   * Check if shutdown is currently in progress
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown
  }

  private setupSignalHandlers(): void {
    this.config.signals?.forEach(signal => {
      const handler = () => this.initiateShutdown(`Signal: ${signal}`)
      this.signalListeners.set(signal, handler)
      process.on(signal as NodeJS.Signals, handler)
    })
  }

  private setupKeyHandlers(): void {
    if (!process.stdin.isTTY) return

    // Only setup if we haven't already
    if (this.keyListener) return

    this.keyListener = (key: string) => {
      if (this.isShutdownKey(key)) {
        this.initiateShutdown(`Hotkey: ${this.getKeyName(key)}`)
      }
    }

    // Setup raw mode for key detection
    try {
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true)
      }
      process.stdin.resume()
      process.stdin.setEncoding('utf8')
      process.stdin.on('data', this.keyListener)
    } catch (error) {
      console.warn('Failed to setup key handlers:', error)
    }
  }

  private cleanupListeners(): void {
    // Remove signal listeners
    this.signalListeners.forEach((handler, signal) => {
      process.removeListener(signal as NodeJS.Signals, handler)
    })
    this.signalListeners.clear()

    // Remove key listener
    if (this.keyListener) {
      process.stdin.removeListener('data', this.keyListener)
      this.keyListener = undefined

      try {
        if (process.stdin.setRawMode) {
          process.stdin.setRawMode(false)
        }
      } catch (error) {
        // Ignore errors when cleaning up
      }
    }
  }

  private isShutdownKey(key: string): boolean {
    if (!this.config.hotkeys) return false

    const keyCode = key.charCodeAt(0)

    // Ctrl+C
    if (keyCode === 3) return this.config.hotkeys.includes('ctrl+c')

    // ESC
    if (keyCode === 27) return this.config.hotkeys.includes('escape')

    // 'q' or 'Q'
    if (key.toLowerCase() === 'q') return this.config.hotkeys.includes('q')

    return false
  }

  private getKeyName(key: string): string {
    const keyCode = key.charCodeAt(0)
    if (keyCode === 3) return 'Ctrl+C'
    if (keyCode === 27) return 'ESC'
    if (key.toLowerCase() === 'q') return 'Q'
    return key
  }

  private async initiateShutdown(reason: string): Promise<void> {
    if (this.isShuttingDown) {
      console.log(chalk.yellow('\nForce exit...'))
      process.exit(1)
    }

    this.isShuttingDown = true

    if (this.config.clearScreen) {
      console.clear()
    }

    console.log(
      '\n' +
        chalk.yellow('🛑 ') +
        chalk.white.bold(this.config.shutdownMessage) +
        chalk.gray(': ') +
        chalk.cyan(reason)
    )

    await this.performShutdown()
  }

  private async performShutdown(): Promise<void> {
    const shutdownTimer = setTimeout(() => {
      console.log(chalk.red('❌ Graceful shutdown timeout'))
      if (this.config.exitProcess) {
        console.log(chalk.red('Forcing exit...'))
        process.exit(1)
      } else {
        console.log(chalk.yellow('Continuing with cleanup...'))
      }
    }, this.config.gracePeriod)

    try {
      if (this.shutdownCallbacks.length > 0) {
        console.log(chalk.blue('🔄 Running shutdown procedures...'))
        console.log(chalk.gray(`   ↳ Executing ${this.shutdownCallbacks.length} cleanup task(s)`))

        // Execute all shutdown callbacks with individual timeouts
        const results = await Promise.allSettled(
          this.shutdownCallbacks.map(callback =>
            this.withTimeout(Promise.resolve(callback()), 5000)
          )
        )

        // Log results
        const successful = results.filter(r => r.status === 'fulfilled').length
        const failed = results.filter(r => r.status === 'rejected').length

        if (successful > 0) {
          console.log(chalk.green(`   ✓ ${successful} task(s) completed successfully`))
        }

        if (failed > 0) {
          console.log(chalk.yellow(`   ⚠️  ${failed} task(s) failed`))
          results.forEach((result, index) => {
            if (result.status === 'rejected') {
              console.warn(`Shutdown callback ${index + 1} failed:`, result.reason)
            }
          })
        }
      }

      clearTimeout(shutdownTimer)
      this.cleanupListeners()

      if (this.config.exitProcess) {
        console.log(
          chalk.green('\n✅ ') +
            chalk.white.bold('Graceful shutdown completed') +
            chalk.gray(' - Goodbye! 👋')
        )
        // Small delay to ensure logs are flushed
        setTimeout(() => process.exit(0), 100)
      } else {
        console.log(
          chalk.green('\n✅ ') +
            chalk.white.bold('Command cleanup completed') +
            chalk.gray(' - Ready for next command')
        )
      }
    } catch (error) {
      clearTimeout(shutdownTimer)
      console.error(chalk.red('❌ Error during shutdown:'), error)
      if (this.config.exitProcess) {
        process.exit(1)
      }
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs)),
    ])
  }
}

/**
 * Create a simple graceful shutdown manager with default settings
 *
 * @param callbacks - Shutdown callbacks to register
 * @param config - Optional configuration overrides
 * @returns Configured and enabled GracefulShutdownManager
 *
 * @example
 * ```typescript
 * // For full app shutdown
 * const shutdown = createGracefulShutdown([
 *   async () => { await cleanup() }
 * ])
 *
 * // For command-only cleanup (don't exit app)
 * const commandShutdown = createGracefulShutdown([
 *   async () => { await cleanup() }
 * ], { exitProcess: false })
 * ```
 */
export function createGracefulShutdown(
  callbacks: Array<() => Promise<void>> = [],
  config: GracefulShutdownConfig = {}
): GracefulShutdownManager {
  const manager = new GracefulShutdownManager(config)

  callbacks.forEach(callback => manager.registerCallback(callback))
  manager.enable()

  return manager
}
