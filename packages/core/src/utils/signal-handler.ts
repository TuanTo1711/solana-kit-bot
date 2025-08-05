/**
 * @fileoverview Signal handler utility for graceful shutdown
 *
 * Provides a reusable signal handler for intercepting system signals
 * (like SIGINT/Ctrl+C) and triggering graceful shutdown of runners
 * without affecting the main application.
 *
 * @author Yuuta - To Hoang Tuan
 * @version 1.0.0
 * @since 2024
 */

import type { ISignalHandler, SignalHandlerConfig, IRunnerController } from '../types/shutdown'

/**
 * Signal handler for graceful shutdown operations
 *
 * Intercepts system signals and provides graceful shutdown functionality
 * for runners. Supports custom signal handling and restoration of original
 * signal handlers.
 *
 * @example
 * ```typescript
 * const handler = new SignalHandler(runnerController)
 *
 * // Setup signal handling
 * handler.setupSignalHandlers()
 *
 * // When done, restore original handlers
 * handler.restoreSignalHandlers()
 * ```
 */
export class SignalHandler implements ISignalHandler {
  private originalHandlers: Map<NodeJS.Signals, NodeJS.SignalsListener> = new Map()
  private isHandlersActive = false
  private config: SignalHandlerConfig
  private runnerController: IRunnerController | undefined

  /**
   * Default signal handler configuration
   */
  private static readonly DEFAULT_CONFIG: SignalHandlerConfig = {
    signals: ['SIGINT', 'SIGTERM'],
    restoreOriginal: true,
  }

  /**
   * Creates a new SignalHandler instance
   *
   * @param runnerController - Optional runner controller to handle shutdown
   * @param config - Configuration for signal handling
   */
  constructor(runnerController?: IRunnerController, config?: Partial<SignalHandlerConfig>) {
    this.runnerController = runnerController
    this.config = {
      ...SignalHandler.DEFAULT_CONFIG,
      ...config,
    }
  }

  /**
   * Set the runner controller for handling shutdown
   *
   * @param controller - Runner controller instance
   */
  setRunnerController(controller: IRunnerController): void {
    this.runnerController = controller
  }

  /**
   * Setup signal handlers for graceful shutdown
   *
   * @param config - Optional configuration override
   */
  setupSignalHandlers(config?: Partial<SignalHandlerConfig>): void {
    if (this.isHandlersActive) {
      console.warn('⚠️  Signal handlers already active')
      return
    }

    const actualConfig = config ? { ...this.config, ...config } : this.config

    console.log('🔧 Setting up signal handlers...')

    for (const signal of actualConfig.signals) {
      // Store original handler
      const originalHandler = process.listeners(signal)[0] as NodeJS.SignalsListener
      if (originalHandler) {
        this.originalHandlers.set(signal, originalHandler)
      }

      // Remove all existing listeners first
      process.removeAllListeners(signal)

      // Setup custom handler
      const customHandler = actualConfig.customHandlers?.[signal]
      if (customHandler) {
        process.on(signal, customHandler)
      } else {
        process.on(signal, this.createDefaultHandler(signal))
      }
    }

    this.isHandlersActive = true
    console.log(`✅ Signal handlers setup for: ${actualConfig.signals.join(', ')}`)
  }

  /**
   * Restore original signal handlers
   */
  restoreSignalHandlers(): void {
    if (!this.isHandlersActive) {
      return
    }

    console.log('🔄 Restoring original signal handlers...')

    for (const signal of this.config.signals) {
      // Remove all current listeners for this signal
      process.removeAllListeners(signal)

      // Restore original handler if it existed
      const originalHandler = this.originalHandlers.get(signal)
      if (originalHandler) {
        process.on(signal, originalHandler)
      }
    }

    this.originalHandlers.clear()
    this.isHandlersActive = false
    console.log('✅ Original signal handlers restored')
  }

  /**
   * Check if signal handlers are currently active
   *
   * @returns True if handlers are active
   */
  isActive(): boolean {
    return this.isHandlersActive
  }

  /**
   * Create default signal handler for a given signal
   *
   * @private
   * @param signal - Signal to handle
   * @returns Signal handler function
   */
  private createDefaultHandler(signal: NodeJS.Signals): NodeJS.SignalsListener {
    return async () => {
      console.log(`\n🛑 Received ${signal} signal...`)
      console.log(`🔍 Signal handler active: ${this.isHandlersActive}`)
      console.log(`🔍 Runner controller exists: ${!!this.runnerController}`)

      if (this.runnerController) {
        console.log(`🔍 Runner controller active: ${this.runnerController.isActive()}`)
        if (this.runnerController.isActive()) {
          console.log('🔄 Stopping runner gracefully...')

          try {
            await this.runnerController.stop()
            console.log('✅ Runner stopped successfully!')
            console.log('🔙 Returning to main menu...\n')

            if (this.config.restoreOriginal) {
              this.restoreSignalHandlers()
            }
            return
          } catch (error) {
            console.error('❌ Error stopping runner:', error)
            console.log('🔄 Force stopping...')

            if (this.config.restoreOriginal) {
              this.restoreSignalHandlers()
            }
            return
          }
        }
      }

      // No active runner or no controller - just restore handlers and return to menu
      console.log('🔙 Returning to main menu...')

      if (this.config.restoreOriginal) {
        this.restoreSignalHandlers()
      }
    }
  }
}

/**
 * Factory function to create a signal handler with runner controller
 *
 * @param runnerController - Runner controller instance
 * @param config - Optional configuration
 * @returns New SignalHandler instance
 */
export function createSignalHandler(
  runnerController?: IRunnerController,
  config?: Partial<SignalHandlerConfig>
): SignalHandler {
  return new SignalHandler(runnerController, config)
}

/**
 * Global signal handler instance for convenience
 *
 * Can be used across the application for consistent signal handling.
 * Remember to call setRunnerController() before using.
 */
export const globalSignalHandler = new SignalHandler()
