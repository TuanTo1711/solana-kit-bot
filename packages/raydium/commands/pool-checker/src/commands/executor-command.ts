import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token'
import type { Address } from '@solana/addresses'
import { type Signature } from '@solana/kit'
import { Command, type BaseContext } from 'clipanion'
import { combineLatest, filter, map, withLatestFrom } from 'rxjs'
import type { Telegraf } from 'telegraf'

import { formatUnits, wrapEscHandler, type SolanaBotContext } from '@solana-kit-bot/core'
import type { PoolKeys, RaydiumCpmmClient } from '@solana-kit-bot/raydium-cpmm'

import type { DexScreenerAPI } from '~/dexscreener-api'
import type { ConfigService } from '~/services'
import type { PoolMonitor } from '~/services/PoolMonitorService'
import type { PoolCheckerConfig } from '~/validator/pool-checker-validator'

type ExecutorContext = BaseContext &
  SolanaBotContext & {
    readonly telegraf: Telegraf
    readonly raydiumClient: RaydiumCpmmClient
    readonly poolMonitor: PoolMonitor
    readonly configService: ConfigService
    readonly dexscreenerAPI: DexScreenerAPI
  }

export class ExecutorCommand extends Command<ExecutorContext> {
  override async execute(): Promise<number | void> {
    const inquirer = await import('inquirer')
    const prompt = inquirer.default.prompt
    const { poolMonitor, configService } = this.context

    const configs = await configService.getAllConfig()
    const choices = this.createChoices(configs)
    const question = prompt<{ config: (typeof choices)[number]['value'] }>({
      type: 'select',
      name: 'config',
      message: 'Chọn cấu hình muốn chạy: ',
      choices,
    })

    const { config } = await wrapEscHandler<typeof question>(question)

    poolMonitor.stream$.subscribe({
      next: ({ poolKeys, type }) => {
        if (type === 'add') {
          this.doExecute(poolKeys, config, BigInt(new Date().getTime()))
        }
      },
    })
  }

  async doExecute(
    poolKeys: PoolKeys,
    config: {
      target: bigint
      mustBoost: boolean
      hasImage: boolean
      expiredTime: number
      amount: bigint
      profitAutoSell: number
      jitoTip: number
      id?: string | undefined
      totalBoost?: number | undefined
    },
    timestamp: bigint
  ): Promise<void> {
    const { jito } = this.context.provider
    const { token0Vault, token1Vault } = poolKeys
    const tipStream = await jito.tipStream()
    const subscribers = combineLatest([this.watchPool(token0Vault), this.watchPool(token1Vault)])

    const subscription = subscribers
      .pipe(
        withLatestFrom(tipStream),
        map(([[base, quote], tip]) => ({
          baseAmount: base.amount,
          quoteAmount: quote.amount,
          tip: Number(tip.landed_tips_99th_percentile.toFixed(9)),
        })),
        filter(({ quoteAmount }) => quoteAmount > 0n && quoteAmount >= config.target)
      )
      .subscribe({
        next: async ({ baseAmount, quoteAmount, tip }) => {
          subscription.unsubscribe()

          try {
            const metadataCheck = await this.checkMetadata(poolKeys, config)

            if (!metadataCheck) {
              return
            }

            if (!this.isExpired(timestamp, config.expiredTime)) {
              return
            }

            await this.doBuy(
              poolKeys,
              config.amount,
              baseAmount,
              quoteAmount,
              Math.max(tip, config.jitoTip),
              config
            )
          } catch (error) {
            console.error(error)
          }
        },
        error: error => {
          console.error(error)
        },
      })
  }

  private isExpired(poolTimestamp: bigint, expiresHour: number): boolean {
    const poolTime = Number(poolTimestamp)
    const currentTime = Date.now()
    const expirationTime = poolTime + expiresHour * 1000

    return currentTime > expirationTime
  }

  async doBuy(
    poolKeys: PoolKeys,
    amountIn: bigint,
    baseAmount: bigint,
    quoteAmount: bigint,
    tip: number,
    config: PoolCheckerConfig
  ) {
    const { payer, raydiumClient, transactionManager } = this.context

    const buyInstructions = await raydiumClient.createBuyInstructions(
      {
        amountIn,
        buyer: payer,
        minAmountOut: 0n,
        poolKeys,
      },
      { hasSolAta: false, hasTokenAta: false }
    )

    for (let i = 0; i < 10; i++) {
      const transaction = await transactionManager.buildSenderTransaction(buyInstructions, payer, {
        senderTip: tip,
      })

      const result = await transactionManager.sendSenderTransaction(transaction)
      const status = await transactionManager.confirmTransaction(result as Signature)

      if (status.confirmed) {
        const buyPrice = Number(baseAmount) / Number(quoteAmount)

        await Promise.all([
          this.notifyNewPool(poolKeys.poolId, payer.address, poolKeys.token1Mint),
          this.sell(poolKeys, buyPrice, config),
        ])
        break
      }
    }
  }

  async sell(poolKeys: PoolKeys, buyPrice: number, config: PoolCheckerConfig): Promise<void> {
    const { jito } = this.context.provider
    const { token0Vault, token1Vault } = poolKeys
    try {
      const tipStream = await jito.tipStream()
      const subscribers = combineLatest([this.watchPool(token0Vault), this.watchPool(token1Vault)])

      const profitPercentage = config.profitSell / 100
      const targetSellPrice = buyPrice * (1 + profitPercentage)

      const subscription = subscribers
        .pipe(
          withLatestFrom(tipStream),
          map(([[base, quote], tip]) => ({
            baseAmount: base.amount,
            quoteAmount: quote.amount,
            tip: tip.landed_tips_95th_percentile,
            currentPrice: Number(base.amount) / Number(quote.amount),
          })),
          filter(({ currentPrice }) => currentPrice >= targetSellPrice)
        )
        .subscribe({
          next: async ({ tip, currentPrice }) => {
            subscription.unsubscribe()

            try {
              await this.doSell(poolKeys, Math.max(tip, config.jitoTip), buyPrice, currentPrice)
            } catch (error) {
              console.error('❌ Lỗi khi chốt lời:', error)
            }
          },
          error: error => {
            console.error('❌ Lỗi trong quá trình theo dõi giá:', error)
          },
        })
    } catch (error) {
      throw error
    }
  }

  /**
   * Execute sell transaction
   */
  async doSell(
    poolKeys: PoolKeys,
    tip: number,
    buyPrice: number,
    currentPrice: number
  ): Promise<void> {
    const { payer, raydiumClient, transactionManager, provider } = this.context
    const { token1Mint } = poolKeys
    const [tokenAccount] = await findAssociatedTokenPda({
      mint: token1Mint,
      owner: payer.address,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    })
    const {
      value: { amount },
    } = await provider.rpc.getTokenAccountBalance(tokenAccount).send()
    const amountIn = Number(amount) * 0.5
    const sellInstructions = await raydiumClient.createSellInstructions(
      {
        amountIn: BigInt(amountIn.toFixed(0)),
        seller: payer,
        minAmountOut: 0n,
        poolKeys,
      },
      { hasSolAta: false, sellAll: true }
    )

    for (let i = 0; i < 10; i++) {
      const transaction = await transactionManager.buildSenderTransaction(sellInstructions, payer, {
        senderTip: tip,
      })

      const result = await transactionManager.sendSenderTransaction(transaction)
      const status = await transactionManager.confirmTransaction(result as Signature)

      if (status.confirmed) {
        const profitAmount = currentPrice - buyPrice
        const profitPercentage = (profitAmount / buyPrice) * 100

        await this.notifyProfitTaken(poolKeys.poolId, {
          buyPrice,
          sellPrice: currentPrice,
          profitPercentage: profitPercentage.toFixed(2),
        })

        break
      }
    }
  }

  /**
   * Check token metadata requirements
   */
  async checkMetadata(poolKeys: PoolKeys, config: PoolCheckerConfig): Promise<boolean> {
    try {
      const { dexscreenerAPI } = this.context

      // Get all token information in one API call
      const tokenInfo = await dexscreenerAPI.getTokenInfo(poolKeys.token1Mint)

      if (!tokenInfo.metadata) {
        console.log('❌ No metadata found for token')
        return false
      }

      if (config.hasImage) {
        if (!tokenInfo.metadata.imageUrl) {
          return false
        }
      }

      if (config.hasBoost) {
        if (!tokenInfo.hasActiveBoosts) {
          return false
        }

        // Check total boost amount if specified in config
        if (config.totalBoost) {
          if (tokenInfo.totalBoostAmount !== config.totalBoost) {
            console.log(
              `❌ Total boost amount mismatch: expected ${config.totalBoost}, got ${tokenInfo.totalBoostAmount}`
            )
            return false
          }
          console.log(`✅ Total boost amount matches: ${tokenInfo.totalBoostAmount}`)
        }
      }

      return true
    } catch (error) {
      console.error('❌ Failed to check metadata:', error)
      return false
    }
  }

  private watchPool(address: Address) {
    const { advanceSubscriptions } = this.context.provider

    const subscriber = advanceSubscriptions.accountNotifications(address, {
      delay: 3000,
      initial: true,
      retry: Infinity,
    })

    return subscriber
  }

  private createChoices(
    configs: {
      target: bigint
      mustBoost: boolean
      hasImage: boolean
      expiredTime: number
      amount: bigint
      profitAutoSell: number
      jitoTip: number
      id?: string | undefined
      totalBoost?: number | undefined
    }[]
  ) {
    return configs.map(config => {
      const image = config.hasImage ? 'Có hình' : 'Không hình'
      const boost = config.mustBoost ? 'Có boost' : 'Không có boost'
      const totalBoost = config.totalBoost ?? ''
      const target = formatUnits(Number(config.target) / 10 ** 6)
      return {
        name: `${target} - ${boost} - ${image} ${'-' + totalBoost}`,
        value: config,
      }
    })
  }

  /**
   * Send broadcast message to all users
   * @param message - Message content to broadcast
   */
  async broadcastMessage(message: string): Promise<void> {
    try {
      console.log('📤 Đang gửi tin nhắn đến tất cả người dùng...')

      // Get all chat IDs from bot's active chats
      const chatIds = this.getAllChatIds()

      if (chatIds.length === 0) {
        console.log('📭 Không có người dùng nào để gửi tin nhắn.')
        return
      }

      let successCount = 0
      let failCount = 0

      // Send message to each chat
      for (const chatId of chatIds) {
        try {
          await this.context.telegraf.telegram.sendMessage(chatId, message)
          successCount++
        } catch (error) {
          console.error(`❌ Lỗi gửi tin nhắn đến chat ${chatId}:`, error)
          failCount++
        }
      }

      console.log(`✅ Đã gửi tin nhắn thành công: ${successCount}/${chatIds.length}`)
      if (failCount > 0) {
        console.log(`❌ Tin nhắn thất bại: ${failCount}`)
      }
    } catch (error) {
      console.error('❌ Lỗi khi gửi tin nhắn broadcast:', error)
      throw error
    }
  }

  /**
   * Send notification about new pool to all users
   * @param poolAddress - Pool address
   * @param poolInfo - Pool information
   */
  async notifyNewPool(poolId: string, buyer: string, tokenMint: string): Promise<void> {
    const message = `
🟢 **ĐÃ MUA TOKEN MỚI**

+ ⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}
+ 🪙 Token: \`${tokenMint}\`

🔍 Xem chi tiết:
• 📊 Dexscreener: https://dexscreener.com/solana/${poolId}?maker=${buyer}
• 📋 Holders: https://solscan.io/token/${tokenMint}#holders
`

    await this.broadcastMessage(message)
  }

  /**
   * Send notification about profit taken to all users
   * @param poolAddress - Pool address
   * @param profitInfo - Profit information
   */
  async notifyProfitTaken(
    poolAddress: string,
    profitInfo: {
      buyPrice: number
      sellPrice: number
      profitPercentage: string
    }
  ): Promise<void> {
    const message =
      `💰 Chốt lời thành công!\n\n` +
      `📊 Thông tin giao dịch:\n` +
      `• Pool: \`${poolAddress}\`\n` +
      `• Giá mua: \`${profitInfo.buyPrice.toFixed(6)}\`\n` +
      `• Giá bán: \`${profitInfo.sellPrice.toFixed(6)}\`\n` +
      `• Lợi nhuận: \`${profitInfo.profitPercentage}%\`\n\n` +
      `🎉 Chúc mừng! Giao dịch đã hoàn thành thành công!`

    await this.broadcastMessage(message)
  }

  /**
   * Get all active chat IDs
   * Note: This is a simplified implementation. In production, you should store chat IDs in a database
   */
  private getAllChatIds(): number[] {
    // In a real implementation, you would retrieve chat IDs from a database
    // For now, we'll use a simple in-memory storage
    if (!this.activeChatIds) {
      this.activeChatIds = new Set<number>()
    }
    return Array.from(this.activeChatIds)
  }

  private activeChatIds?: Set<number> = new Set([5112769500, 7116705965])
}

ExecutorCommand.paths = [['executor run']]
