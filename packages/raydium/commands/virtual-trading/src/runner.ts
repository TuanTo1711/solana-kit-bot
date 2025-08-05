/**
 * @fileoverview Virtual wallet trading runner for Raydium CPMM pools
 */

import {
  IterationRunner,
  type PriceStrategy,
  type RunnerResult,
  type SolanaBotContext,
} from '@solana-kit-bot/core'
import type { PoolKeys, RaydiumCpmmClient } from '@solana-kit-bot/raydium-cpmm'

import { PerformanceMonitor } from './performance-monitor'
import { PoolMonitor } from './pool-monitor'
import { TradingOperations } from './trading-operations'
import type { ActiveTrade } from './types'
import type { VirtualTradingOptions } from './validation'

/**
 * Virtual wallet trading runner for executing buy-then-sell trading strategies
 *
 * This runner creates multiple virtual wallets, funds them, executes buy transactions,
 * and then automatically executes sell transactions after a specified timeout.
 * It supports per-signer pricing strategies for randomized trading patterns.
 */
export class VirtualWalletTradingRunner extends IterationRunner {
  private poolKeys: PoolKeys | null = null
  private readonly poolMonitor = new PoolMonitor()
  private readonly tradingOps: TradingOperations
  private readonly activeTrades = new Map<string, ActiveTrade>()
  private readonly performanceMonitor = new PerformanceMonitor()

  constructor(
    private readonly context: SolanaBotContext,
    private readonly options: VirtualTradingOptions,
    private readonly priceStrategy: PriceStrategy,
    private readonly raydiumClient: RaydiumCpmmClient
  ) {
    super({
      gracefulShutdown: false,
      interval: options.interval,
      maxIterations: options.loops,
      stopOnError: false,
    })

    this.tradingOps = new TradingOperations(raydiumClient, this.poolMonitor)
  }

  /**
   * Initialize the runner by fetching pool keys and setting up monitoring
   */
  async setup(): Promise<void> {
    try {
      console.log('🚀 Initializing virtual trading runner...')

      this.poolKeys = await this.raydiumClient.fetchPoolKeys(this.options.pool)
      await this.poolMonitor.subscribeToPoolUpdates(this.context, this.poolKeys)

      // Start performance monitoring
      this.performanceMonitor.startLogging()

      console.log('✅ Runner initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize runner:', error)
      throw error
    }
  }

  /**
   * Override execute để thêm custom completion messaging
   */
  override async execute(context: SolanaBotContext): Promise<RunnerResult> {
    try {
      const result = await super.execute(context)
      return result
    } catch (error) {
      return this.createErrorResult(error as Error)
    }
  }

  /**
   * Execute a single trading iteration (buy + scheduled sell)
   */
  override async executeIteration(
    context: SolanaBotContext,
    iteration: number
  ): Promise<RunnerResult> {
    const startTime = Date.now()

    // Validate pool keys are available
    if (!this.poolKeys) {
      const error = new Error('Pool keys not initialized')
      this.performanceMonitor.recordIteration(Date.now() - startTime, false)
      return this.createErrorResult(error)
    }

    const { timeout, wallets, tip } = this.options

    try {
      // Execute buy phase
      const buyResult = await this.tradingOps.executeBuyPhase(
        context,
        iteration,
        wallets,
        this.priceStrategy,
        this.poolKeys,
        tip
      )

      // Record bundle sent
      this.performanceMonitor.recordBundleSent()

      // Check again before scheduling sell phase
      if (!this.isRunning()) {
        this.performanceMonitor.recordIteration(Date.now() - startTime, false)
        return this.createSuccessResult('Sell phase skipped - shutdown in progress')
      }

      // Schedule sell phase
      this.scheduleSellPhase(context, buyResult, timeout)

      // Record successful iteration
      const duration = Date.now() - startTime
      this.performanceMonitor.recordIteration(duration, true, wallets)

      return this.createSuccessResult('Buy phase completed, sell scheduled')
    } catch (error) {
      // Record failed iteration
      this.performanceMonitor.recordIteration(Date.now() - startTime, false)

      // Don't throw error if we're shutting down
      if (!this.isRunning()) {
        return this.createSuccessResult('Iteration failed but shutdown in progress')
      }

      throw error
    }
  }

  /**
   * Schedule a sell phase to execute after the specified timeout
   */
  private scheduleSellPhase(
    context: SolanaBotContext,
    buyResult: { tradeId: string; signerTrades: Map<string, any>; fundingBundle: any },
    timeout: number
  ): void {
    const { tradeId, signerTrades, fundingBundle } = buyResult
    const { tip } = this.options

    const sellTimeoutId = setTimeout(async () => {
      // Check if runner has been stopped before executing sell
      if (!this.isRunning()) {
        this.activeTrades.delete(tradeId)
        return
      }

      // Validate pool keys are still available
      if (!this.poolKeys) {
        this.activeTrades.delete(tradeId)
        return
      }

      try {
        await this.tradingOps.executeSellPhase(
          context,
          tradeId,
          signerTrades,
          fundingBundle,
          this.poolKeys,
          tip
        )

        // Record bundle sent for sell phase
        this.performanceMonitor.recordBundleSent()
      } catch (error) {
        console.error('Sell phase failed:', error)
      } finally {
        this.activeTrades.delete(tradeId)
      }
    }, timeout)

    // Store the active trade
    this.activeTrades.set(tradeId, {
      signerTrades,
      sellTimeoutId,
      fundingBundle,
    })
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up virtual trading runner...')

    this._isRunning = false
    // Stop performance monitoring and show final metrics
    this.performanceMonitor.stopLogging()
    const finalMetrics = this.performanceMonitor.getFullMetrics(this.poolMonitor.getMetrics())

    console.log('\n📈 Final Performance Summary:')
    console.log(`   Total iterations: ${finalMetrics.tradingMetrics.totalIterations}`)
    console.log(
      `   Success rate: ${((finalMetrics.tradingMetrics.successfulIterations / finalMetrics.tradingMetrics.totalIterations) * 100).toFixed(1)}%`
    )
    console.log(`   Total trades executed: ${finalMetrics.tradingMetrics.totalTradesExecuted}`)
    console.log(`   Bundles sent: ${finalMetrics.tradingMetrics.totalBundlesSent}`)
    console.log(
      `   Average iteration time: ${finalMetrics.tradingMetrics.averageIterationTime.toFixed(2)}ms`
    )
    console.log(
      `   Session duration: ${(finalMetrics.systemMetrics.uptime / 1000 / 60).toFixed(1)} minutes\n`
    )

    // Cancel all pending sell operations
    const cancelledTrades: string[] = []
    for (const [tradeId, trade] of this.activeTrades.entries()) {
      if (trade.sellTimeoutId) {
        clearTimeout(trade.sellTimeoutId)
        cancelledTrades.push(tradeId)
      }
    }

    if (cancelledTrades.length > 0) {
      console.log(`⚠️  Cancelled ${cancelledTrades.length} pending sell operations`)
    }

    // Clear all active trades
    this.activeTrades.clear()

    // Cleanup pool monitoring with error handling
    try {
      this.poolMonitor.cleanup()
    } catch (error) {
      console.warn('Warning: Pool monitor cleanup failed:', error)
    }

    // Reset pool keys
    this.poolKeys = null

    console.log('✅ Cleanup completed')
  }
}

/**
 * Factory function to create a new virtual wallet trading runner
 */
export const createVirtualWalletTradingRunner = (
  context: SolanaBotContext,
  options: VirtualTradingOptions,
  priceStrategy: PriceStrategy,
  raydiumClient: RaydiumCpmmClient
) => new VirtualWalletTradingRunner(context, options, priceStrategy, raydiumClient)
