/**
 * Configuration for executor control behavior
 */
export interface ExecutorControlConfig {
  /** Hotkeys to trigger stop action (default: ['q', 'escape']) */
  hotkeys?: string[]
  /** Maximum time to wait for executor stop (default: 10000ms) */
  stopTimeout?: number
  /** Timeout for each individual callback (default: 5000ms) */
  callbackTimeout?: number
  /** Whether to clear screen on stop (default: false) */
  clearScreen?: boolean
  /** Debounce time for repeated hotkeys in ms (default: 500ms) */
  debounceTime?: number
}

/**
 * Executor controller for handling runtime control of executors via keyboard hotkeys
 *
 * Designed for controlling executor lifecycle without shutting down the entire application.
 * Supports stop operation through keyboard shortcuts only (q, esc).
 *
 * @example
 * ```typescript
 * const controller = new ExecutorController({
 *   hotkeys: ['q', 'escape'],
 *   stopTimeout: 5000
 * })
 *
 * controller.onStop(async () => {
 *   console.log('Stopping executor...')
 *   await executor.stop()
 * })
 *
 * controller.enable()
 * ```
 */
export class ExecutorController {
  private stopCallbacks: Array<() => Promise<void>> = []
  private isStopping = false
  private isEnabled = false
  private keyListener?: ((key: string) => void) | undefined
  private abortController: AbortController
  private lastActionTime = 0

  constructor(private config: ExecutorControlConfig = {}) {
    this.config = {
      hotkeys: ['q', 'escape'],
      stopTimeout: 10000,
      callbackTimeout: 5000,
      clearScreen: false,
      debounceTime: 500,
      ...config,
    }
    this.abortController = new AbortController()
  }

  /**
   * Enable executor control handling
   */
  enable(): void {
    if (this.isEnabled) return

    this.isEnabled = true
    this.setupKeyHandlers()
  }

  /**
   * Reset controller state and create fresh AbortController
   */
  reset(): void {
    this.isStopping = false
    this.abortController = new AbortController()
    this.lastActionTime = 0
  }

  /**
   * Disable executor control handling and cleanup listeners
   */
  disable(): void {
    if (!this.isEnabled) return

    this.isEnabled = false
    this.cleanupListeners()
  }

  /**
   * Register a callback to be executed when stop is requested
   */
  onStop(callback: () => Promise<void>): void {
    this.stopCallbacks.push(callback)
  }

  /**
   * Clear all registered callbacks
   */
  clearCallbacks(): void {
    this.stopCallbacks.length = 0
  }

  /**
   * Manually trigger executor stop
   */
  async stop(): Promise<void> {
    await this.executeStop()
  }

  /**
   * Get the AbortSignal for the executor to monitor
   */
  get signal(): AbortSignal {
    return this.abortController.signal
  }

  /**
   * Check if stop is currently in progress
   */
  isStopInProgress(): boolean {
    return this.isStopping
  }

  private setupKeyHandlers(): void {
    if (!process.stdin.isTTY) {
      console.warn(
        '⚠️  ExecutorController: Running in non-TTY environment. Keyboard controls will not be available.'
      )
      return
    }

    if (this.keyListener) return

    this.keyListener = (key: string) => {
      const now = Date.now()

      if (now - this.lastActionTime < (this.config.debounceTime || 500)) {
        console.log('Pressing key too fast')
        return
      }

      if (this.isStopKey(key)) {
        this.lastActionTime = now
        this.executeStop()
      }
    }

    try {
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true)
      }
      process.stdin.resume()
      process.stdin.setEncoding('utf8')
      process.stdin.on('data', this.keyListener)
    } catch (error) {
      console.warn('Could not setup keyboard handlers:', error)
    }
  }

  private cleanupListeners(): void {
    if (this.keyListener) {
      process.stdin.removeListener('data', this.keyListener)
      this.keyListener = undefined

      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(false)
      }
    }
  }

  private isStopKey(key: string): boolean {
    if (!this.config.hotkeys) return false

    const keyCode = key.charCodeAt(0)

    if (keyCode === 27) return this.config.hotkeys.includes('escape')

    if (key.toLowerCase() === 'q') return this.config.hotkeys.includes('q')

    return false
  }

  private async executeStop(): Promise<void> {
    if (this.isStopping) {
      console.log('Stopping executor already in progress')
      return
    }

    this.isStopping = true

    if (this.config.clearScreen) {
      console.clear()
    }

    this.abortController.abort()

    await this.performStop()
  }

  private async performStop(): Promise<void> {
    try {
      if (this.stopCallbacks.length > 0) {
        const results = await Promise.allSettled(
          this.stopCallbacks.map(callback =>
            this.withTimeout(Promise.resolve(callback()), this.config.callbackTimeout || 5000)
          )
        )

        const successful = results.filter(r => r.status === 'fulfilled').length
        const failed = results.filter(r => r.status === 'rejected').length

        if (successful > 0) {
          console.log(`   ✓ ${successful} task(s) completed successfully`)
        }

        if (failed > 0) {
          results.forEach((result, index) => {
            if (result.status === 'rejected') {
              console.warn(`Stop callback ${index + 1} failed:`, result.reason)
            }
          })
        }
      }

      this.cleanupListeners()

      console.log('\n✅ Executor stopped - Ready for next command')
    } catch (error) {
      console.error('❌ Error during executor stop:', error)
    } finally {
      this.isStopping = false
      this.reset()
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
 * Create a simple executor controller with default settings
 *
 * @param callbacks - Stop callbacks to register
 * @param config - Optional configuration overrides
 * @returns Configured and enabled ExecutorController
 *
 * @example
 * ```typescript
 * // Simple executor control
 * const controller = createExecutorController([
 *   async () => { await executor.stop() }
 * ])
 *
 * // Custom hotkeys and timeout
 * const customController = createExecutorController([
 *   async () => { await executor.stop() }
 * ], {
 *   hotkeys: ['q', 'escape'],
 *   stopTimeout: 5000,
 * })
 * ```
 */
export function createExecutorController(
  callbacks: Array<() => Promise<void>> = [],
  config: ExecutorControlConfig = {}
): ExecutorController {
  const controller = new ExecutorController(config)

  callbacks.forEach(callback => controller.onStop(callback))
  controller.enable()

  return controller
}
