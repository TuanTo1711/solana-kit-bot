/**
 * @fileoverview Trading operations for buy and sell transactions
 */

import type { Bundle, PriceStrategy, SolanaBotContext } from '@solana-kit-bot/core'
import {
  computeBaseInSwap,
  type PoolKeys,
  type RaydiumCpmmClient,
} from '@solana-kit-bot/raydium-cpmm'

import {
  DEFAULT_BUNDLE_ENCODING,
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAY_MS,
  BUNDLE_TIMEOUT_MS,
} from './constants'
import { PoolMonitor } from './pool-monitor'
import type { BuyPhaseResult, SignerTradeInfo } from './types'
import { WalletManager } from './wallet-manager'

/**
 * Handles trading operations including buy and sell transactions
 */
export class TradingOperations {
  private readonly walletManager = new WalletManager()

  constructor(
    private readonly raydiumClient: RaydiumCpmmClient,
    private readonly poolMonitor: PoolMonitor
  ) {}

  /**
   * Execute a buy phase creating multiple buy transactions
   * @param context - Solana bot context
   * @param iteration - Current iteration number
   * @param walletCount - Number of wallets to use
   * @param priceStrategy - Strategy for calculating prices
   * @param poolKeys - Pool keys for the target pool
   * @param tip - Tip amount for bundle submission (in lamports)
   * @returns Buy phase result with trade information
   */
  async executeBuyPhase(
    context: SolanaBotContext,
    iteration: number,
    walletCount: number,
    priceStrategy: PriceStrategy,
    poolKeys: PoolKeys,
    tip: bigint
  ): Promise<BuyPhaseResult> {
    const { payer, transactionManager } = context
    const bundleBuy: Bundle[] = []

    // Create virtual wallets
    const signers = await this.walletManager.createVirtualWallets(walletCount)

    // Create funding bundle
    const fundingBundle = this.walletManager.createFundingBundle(payer, signers)
    bundleBuy.push(fundingBundle)

    // Create buy transactions for each signer (parallel processing)
    const signerTrades = new Map<string, SignerTradeInfo>()

    const createBuyTransaction = async (signer: any, index: number) => {
      // Calculate price for this specific signer
      const priceResult = await priceStrategy.calculatePrice({
        iteration,
        timestamp: Date.now(),
        metadata: {
          signerIndex: index,
          signerId: signer.address,
          totalSigners: signers.length,
        },
      })

      const amountIn = BigInt(priceResult.price)

      // Calculate expected output based on current pool state
      const swapResult = computeBaseInSwap(
        amountIn,
        this.poolMonitor.baseReserve,
        this.poolMonitor.quoteReserve,
        1.0 // 1% slippage tolerance
      )
      const { amountOut } = swapResult

      // Create buy instructions
      const buyInstructions = await this.raydiumClient.createBuyInstructions(
        {
          amountIn,
          buyer: payer,
          minAmountOut: 0n,
          poolKeys,
        },
        { hasSolAta: false, hasTokenAta: true }
      )

      // Create refund instruction
      const refundInstruction = this.walletManager.createRefundInstruction(signer, payer)

      const bundle = {
        instructions: [...buyInstructions, refundInstruction],
        payer: signer,
        additionalSigner: [signer, payer],
      }

      // Store trade information
      const tradeInfo = {
        signer,
        amountOut,
        price: priceResult.price,
      }

      console.log(`Ví ${index + 1}: giá=${priceResult.price}, mua=${amountIn}, nhận=${amountOut}`)

      return { bundle, tradeInfo, signerAddress: signer.address }
    }

    // Process all signers in parallel
    const buyTransactions = await Promise.all(
      signers.map((signer, index) => createBuyTransaction(signer, index))
    )

    // Add bundles and trade info to respective collections
    buyTransactions.forEach(({ bundle, tradeInfo, signerAddress }) => {
      bundleBuy.push(bundle)
      signerTrades.set(signerAddress, tradeInfo)
    })

    // Build and send bundle with retry logic
    const buyBundle = await transactionManager.buildBundle(bundleBuy, tip)
    await this.sendBundleWithRetry(context, buyBundle)

    const tradeId = `trade-${iteration}-${Date.now()}`

    console.log(`Đã gửi bundle mua cho lần lặp ${iteration} với ${signerTrades.size} ví`)

    return { tradeId, signerTrades, fundingBundle }
  }

  /**
   * Execute a sell phase selling tokens from previous buy transactions
   * @param context - Solana bot context
   * @param tradeId - Unique identifier for this trade
   * @param signerTrades - Map of signer trades from buy phase
   * @param fundingBundle - Funding bundle from buy phase
   * @param poolKeys - Pool keys for the target pool
   * @param tip - Tip amount for bundle submission (in lamports)
   */
  async executeSellPhase(
    context: SolanaBotContext,
    tradeId: string,
    signerTrades: Map<string, SignerTradeInfo>,
    fundingBundle: Bundle,
    poolKeys: PoolKeys,
    tip: bigint
  ): Promise<void> {
    const { payer, transactionManager } = context
    const bundleSell: Bundle[] = []

    bundleSell.push(fundingBundle)

    // Create sell transactions for each signer (parallel processing)
    const createSellTransaction = async ([signerAddress, tradeData]: [string, SignerTradeInfo]) => {
      const { signer, amountOut, price } = tradeData

      // Create sell instructions
      const sellInstructions = await this.raydiumClient.createSellInstructions(
        {
          amountIn: amountOut,
          minAmountOut: 0n,
          poolKeys,
          seller: payer,
        },
        { hasSolAta: false, sellAll: false }
      )

      // Create refund instruction
      const refundInstruction = this.walletManager.createRefundInstruction(signer, payer)

      const bundle = {
        instructions: [...sellInstructions, refundInstruction],
        payer: signer,
        additionalSigner: [signer, payer],
      }

      console.log(`Ví ${signerAddress}: bán số lượng=${amountOut} (đã mua với giá=${price})`)

      return bundle
    }

    // Process all sell transactions in parallel
    const sellTransactions = await Promise.all(
      Array.from(signerTrades.entries()).map(createSellTransaction)
    )

    bundleSell.push(...sellTransactions)

    const sellBundle = await transactionManager.buildBundle(bundleSell, tip)
    await this.sendBundleWithRetry(context, sellBundle)

    console.log(`Đã gửi bundle bán cho ${tradeId} với ${signerTrades.size} ví`)
  }

  /**
   * Send bundle with retry logic and timeout
   * @param context - Solana bot context
   * @param bundle - Bundle to send
   */
  private async sendBundleWithRetry(context: SolanaBotContext, bundle: any): Promise<void> {
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Bundle submission timeout')), BUNDLE_TIMEOUT_MS)
        })

        await Promise.race([
          context.provider.jito.sendShakingBundle(bundle, { encoding: DEFAULT_BUNDLE_ENCODING }),
          timeoutPromise,
        ])

        return
      } catch (error) {
        lastError = error as Error
        console.warn(`Bundle submission attempt ${attempt}/${MAX_RETRY_ATTEMPTS} failed:`, error)

        if (attempt < MAX_RETRY_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt))
        }
      }
    }

    throw new Error(
      `Bundle submission failed after ${MAX_RETRY_ATTEMPTS} attempts: ${lastError?.message}`
    )
  }
}
