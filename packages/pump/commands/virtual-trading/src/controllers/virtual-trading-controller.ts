/**
 * @fileoverview Virtual trading runner controller
 *
 * Concrete implementation of AbstractRunnerController for managing
 * virtual trading operations with Raydium CPMM pools.
 *
 * @author Yuuta - To Hoang Tuan
 * @version 1.0.0
 * @since 2024
 */

import type { SolanaBotContext, PriceStrategy, RunnerMetrics } from '@solana-kit-bot/core'
import { AbstractRunnerController } from '@solana-kit-bot/core'
import type { PumpswapClient } from '@solana-kit-bot/pumpswap'

import { VirtualWalletTradingRunner } from '../runner'
import type { VirtualTradingOptions } from '../validation'

/**
 * Controller for managing virtual trading runner lifecycle
 *
 * Extends AbstractRunnerController to provide specific functionality
 * for virtual trading operations including metrics extraction and
 * runner-specific setup/cleanup.
 */
export class VirtualTradingController extends AbstractRunnerController<VirtualWalletTradingRunner> {
  private options!: VirtualTradingOptions
  private priceStrategy!: PriceStrategy
  private pumpswapClient!: PumpswapClient

  /**
   * Initialize the controller with trading dependencies
   *
   * @param options - Trading configuration options
   * @param priceStrategy - Price calculation strategy
   * @param raydiumClient - Raydium CPMM client
   */
  async initialize(
    options: VirtualTradingOptions,
    priceStrategy: PriceStrategy,
    pumpswapClient: PumpswapClient
  ): Promise<void> {
    this.options = options
    this.priceStrategy = priceStrategy
    this.pumpswapClient = pumpswapClient
  }

  /**
   * Create a new virtual trading runner instance
   *
   * @protected
   * @param context - Execution context
   * @returns New VirtualWalletTradingRunner instance
   */
  protected async createRunner(context: SolanaBotContext): Promise<VirtualWalletTradingRunner> {
    if (!this.options || !this.priceStrategy || !this.pumpswapClient) {
      throw new Error('Controller not initialized. Call initialize() first.')
    }

    return new VirtualWalletTradingRunner(
      context,
      this.options,
      this.priceStrategy,
      this.pumpswapClient
    )
  }

  /**
   * Extract metrics from virtual trading runner
   *
   * @protected
   * @param runner - Virtual trading runner instance
   * @returns Performance metrics or undefined
   */
  protected override getRunnerMetrics(
    runner: VirtualWalletTradingRunner
  ): RunnerMetrics | undefined {
    try {
      const performanceMonitor = (runner as any).performanceMonitor
      if (!performanceMonitor) return undefined

      const metrics = performanceMonitor.getMetrics()
      if (!metrics) return undefined

      return {
        successRate:
          metrics.totalIterations > 0
            ? (metrics.successfulIterations / metrics.totalIterations) * 100
            : 0,
        averageIterationTime: metrics.averageIterationTime,
        totalOperations: metrics.totalTradesExecuted,
        memoryUsage: metrics.memoryUsage,
        uptime: metrics.uptime,
      }
    } catch {
      return undefined
    }
  }

  /**
   * Check if virtual trading runner is running
   *
   * @protected
   * @param runner - Virtual trading runner instance
   * @returns True if runner is active
   */
  protected override isRunnerRunning(runner: VirtualWalletTradingRunner): boolean {
    return runner.isRunning()
  }

  /**
   * Stop the virtual trading runner
   *
   * @protected
   * @param runner - Virtual trading runner instance
   */
  protected override async stopRunner(runner: VirtualWalletTradingRunner): Promise<void> {
    runner.cancel()
  }

  /**
   * Cleanup virtual trading runner resources
   *
   * @protected
   * @param runner - Virtual trading runner instance
   */
  protected override async cleanupRunner(runner: VirtualWalletTradingRunner): Promise<void> {
    await runner.cleanup()
  }
}

/**
 * Global virtual trading controller instance
 *
 * Provides a singleton controller for managing virtual trading operations
 * across the application.
 */
export const globalVirtualTradingController = new VirtualTradingController()
