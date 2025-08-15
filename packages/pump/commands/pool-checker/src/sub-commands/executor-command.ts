import { address, type Address } from '@solana/addresses'
import type { Signature } from '@solana/kit'
import chalk from 'chalk'
import { Command, type BaseContext } from 'clipanion'
import { combineLatest, filter, map, Subscription, withLatestFrom } from 'rxjs'

import { formatUnits, wrapEscHandler, type SolanaBotContext } from '@solana-kit-bot/core'
import { computeBuyQuoteIn, type PoolKeys, type PumpswapClient } from '@solana-kit-bot/pumpswap'

import type { Config } from '~/database/client'
import { DexScreenerAPI } from '~/dexscreener-api'
import type { PoolMonitor } from '~/pool-monitor'
import type { ConfigService } from '~/services/ConfigService'
import type { TelegramService } from '~/services/TelegramService'

export type ExecutorContext = SolanaBotContext & {
  poolMonitor: PoolMonitor
  configService: ConfigService
  pumpswapClient: PumpswapClient
  dexscreenerAPI: DexScreenerAPI
  telegramService?: TelegramService
}

export class ExecutorCommand extends Command<BaseContext & ExecutorContext> {
  private poolStreamCache = new Map<Address, Subscription>()
  private configCache = new Map<string, Subscription>()

  override async execute(): Promise<number | void> {
    const inquirer = await import('inquirer')
    const prompt = inquirer.default.prompt
    const controller = new AbortController()

    while (!controller.signal.aborted) {
      const question = prompt({
        type: 'select',
        name: 'action',
        message: 'Chọn hành động: ',
        choices: [
          {
            name: '🚀 Chạy lệnh với cấu hình',
            value: this.run.bind(this),
          },
          {
            name: '🛑 Dừng lệnh theo cấu hình',
            value: this.stop.bind(this),
          },
          {
            name: '🛑 Dừng mua theo địa chỉ pool',
            value: this.stopPool.bind(this),
          },
          new inquirer.default.Separator(chalk.hex('#00FF88')('─'.repeat(100))),
          {
            name: `🔙 ${chalk.gray('Quay lại menu chính')}`,
            value: controller.abort.bind(controller),
          },
        ],
      })

      const answer = await wrapEscHandler<typeof question>(question)
      await answer.action()
    }

    return 0
  }

  async run() {
    const { poolMonitor, configService } = this.context
    const configs = await configService.getConfigs()

    if (configs.length === 0) {
      console.log('Chưa có cấu hình nào')
      return
    }

    const inquirer = await import('inquirer')
    const prompt = inquirer.default.prompt

    const question = prompt<{ config: (typeof configs)[number] }>({
      type: 'select',
      name: 'config',
      message: 'Chọn cấu hình muốn chạy: ',
      choices: configs.map((c, index) => {
        const formattedTarget = formatUnits(Number(c.target) / 10 ** 6)
        const boosted = c.hasBoost ? '- Có boost' : '- Không boost'
        const imaged = c.hasImage ? '- Có ảnh' : '- Không ảnh'
        const totalBoosted = c.hasBoost && c.totalBoost ? `- Tổng boost: ${c.totalBoost}` : ''
        return {
          name: `#${index + 1}. ${formattedTarget} ${boosted} ${imaged}${totalBoosted}`,
          value: c,
          disabled: this.configCache.has(c.id) ? 'Cấu hình đang chạy' : false,
        }
      }),
    })

    const answer = await wrapEscHandler<typeof question>(question)

    poolMonitor.start()
    const sub = poolMonitor.asObservable().subscribe({
      next: poolKeys => this.doBuy(poolKeys, answer.config),
    })

    this.configCache.set(answer.config.id, sub)
  }

  async doBuy(poolKeys: PoolKeys & { timestamp: bigint }, config: Config) {
    const tipStream = await this.context.provider.jito.tipStream()
    const { poolBaseTokenAccount, poolQuoteTokenAccount, pool } = poolKeys

    const subscriber = combineLatest([
      this.watchAccount(poolBaseTokenAccount),
      this.watchAccount(poolQuoteTokenAccount),
    ])
      .pipe(
        withLatestFrom(tipStream),
        map(([[base, quote], tip]) => ({
          baseAmount: base.amount,
          quoteAmount: quote.amount,
          tip: Number(tip.landed_tips_99th_percentile.toFixed(9)),
        })),
        filter(
          ({ baseAmount, quoteAmount }) =>
            baseAmount > 0 && quoteAmount > 0 && baseAmount >= config.target
        )
      )
      .subscribe({
        next: async ({ baseAmount, quoteAmount, tip }) => {
          subscriber.unsubscribe()
          const metadataCheck = await this.checkMetadata(poolKeys, config)

          if (!metadataCheck) {
            return
          }

          if (this.isExpired(poolKeys.timestamp, config.expiresHour)) {
            return
          }

          await this.buy(poolKeys, config, baseAmount, quoteAmount, tip)
        },
      })

    this.poolStreamCache.set(pool, subscriber)
  }

  async checkMetadata(poolKeys: PoolKeys, config: Config): Promise<boolean> {
    try {
      const { dexscreenerAPI } = this.context

      // Get all token information in one API call
      const tokenInfo = await dexscreenerAPI.getTokenInfo(poolKeys.baseMint)

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

  async buy(
    poolKeys: PoolKeys,
    config: Config,
    baseAmount: bigint,
    quoteAmount: bigint,
    tip: number
  ) {
    const { pumpswapClient, transactionManager, payer } = this.context
    const { maxQuote, base } = computeBuyQuoteIn({
      quote: config.amount,
      slippage: 5,
      baseReserve: baseAmount,
      quoteReserve: quoteAmount,
      coinCreator: poolKeys.coinCreator,
    })

    const buyInstructions = await pumpswapClient.createBuyInstructions(
      {
        amountOut: base,
        buyer: payer,
        maxAmountIn: maxQuote,
        poolKeys: poolKeys,
      },
      { hasBaseAta: false, hasQuoteAta: false }
    )

    for (let i = 0; i < 10; i++) {
      const transaction = await transactionManager.buildSenderTransaction(buyInstructions, payer, {
        senderTip: tip,
      })

      const result = await transactionManager.sendSenderTransaction(transaction)
      const status = await transactionManager.confirmTransaction(result as Signature)

      if (status.confirmed) {
        console.log(`🚀 Mua thành công: ${poolKeys.pool}`)

        if (this.context.telegramService?.isReady()) {
          await this.context.telegramService.notifyBuySuccess({
            poolAddress: poolKeys.pool,
            baseMint: poolKeys.baseMint,
            baseAmount: base,
            quoteAmount: maxQuote,
            txSignature: result,
          })
        }

        break
      }
    }
  }

  private isExpired(poolTimestamp: bigint, expiresHour: number): boolean {
    const poolTime = Number(poolTimestamp)
    const currentTime = Date.now()
    const expirationTime = poolTime + expiresHour * 60 * 60 * 1000

    return currentTime > expirationTime
  }

  watchAccount(address: Address) {
    const { advanceSubscriptions } = this.context.provider
    return advanceSubscriptions.accountNotifications(address, {
      delay: 1000,
      initial: false,
      retry: Infinity,
    })
  }

  stop() {}

  async stopPool() {
    const inquirer = await import('inquirer')
    const prompt = inquirer.default.prompt
    const pools = Object.keys(this.poolStreamCache.keys())

    const question = prompt<{ pool: Address }>({
      type: 'search',
      name: 'pool',
      message: 'Nhập pool muốn dừng theo dõi: ',
      source: async input => {
        if (!input) {
          return []
        }

        return pools
          .filter(pool => pool.toLowerCase().includes(input.toLowerCase()))
          .map(pool => ({ name: pool, value: pool }))
      },
      filter: (value: string) => address(value),
    })

    const answer = await wrapEscHandler<typeof question>(question)
    const subscriber = this.poolStreamCache.get(answer.pool)
    if (subscriber) {
      subscriber.unsubscribe()
      this.poolStreamCache.delete(answer.pool)
      console.log(`🛑 Dừng theo dõi pool: ${answer.pool}`)
    }
  }
}

ExecutorCommand.paths = [['executor']]
