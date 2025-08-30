import { address, type Address } from '@solana/addresses'
import type { Signature } from '@solana/kit'
import chalk from 'chalk'
import { Command, type BaseContext } from 'clipanion'
import { combineLatest, filter, map, Subscription, withLatestFrom } from 'rxjs'

import { abbreviateNumber, wrapEscHandler, type SolanaBotContext } from '@solana-kit-bot/core'
import { computeBuyQuoteIn, type PoolKeys, type PumpswapClient } from '@solana-kit-bot/pumpswap'

import type { Config } from '~/database/client'
import { DexScreenerAPI } from '~/external/dexscreener-api'
import type { PoolMonitor } from '~/monitor/pool-monitor'
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
            name: '🚀 Chọn cấu hình chạy',
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
        theme: {
          style: {
            answer: (text: string) => chalk.hex('#00FF88')(text),
            message: (text: string, status: string) =>
              status === 'done' ? chalk.hex('#00FF88')(text) : chalk.hex('#FFFFFF')(text),
            error: (text: string) => chalk.red(text),
            defaultAnswer: (text: string) => chalk.dim(text),
            help: (text: string) => chalk.dim(text),
            highlight: (text: string) => chalk.hex('#00FF88').bold(text),
            key: (text: string) => chalk.hex('#FFFFFF').bold(text),
          },
        },
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
    const choices = configs.map((c, index) => {
      const formattedTarget = abbreviateNumber(Number(c.target) / 10 ** 6)
      const boosted = c.hasBoost ? '- Có boost' : '- Không boost'
      const imaged = c.hasImage ? '- Có ảnh' : '- Không ảnh'
      const totalBoosted = c.hasBoost && c.totalBoost ? `- Tổng boost: ${c.totalBoost}` : ''
      return {
        name: `#${index + 1}. ${formattedTarget} ${boosted} ${imaged}${totalBoosted}`,
        value: c,
        disabled: this.configCache.has(c.id) ? '- Cấu hình đang chạy' : false,
      }
    })

    const question = prompt<{ config: (typeof configs)[number] | 'back' }>({
      type: 'select',
      name: 'config',
      message: 'Chọn cấu hình muốn chạy: ',
      choices: [
        ...choices,
        new inquirer.default.Separator(chalk.hex('#00FF88')('─'.repeat(100))),
        {
          name: `🔙 ${chalk.gray('Hủy chạy lệnh')}`,
          value: 'back',
        },
      ],
      theme: {
        style: {
          answer: (text: string) => chalk.hex('#00FF88')(text),
          message: (text: string, status: string) =>
            status === 'done' ? chalk.hex('#00FF88')(text) : chalk.hex('#FFFFFF')(text),
          error: (text: string) => chalk.red(text),
          defaultAnswer: (text: string) => chalk.dim(text),
          help: (text: string) => chalk.dim(text),
          highlight: (text: string) => chalk.hex('#00FF88').bold(text),
          key: (text: string) => chalk.hex('#FFFFFF').bold(text),
        },
      },
    })

    const { config } = await wrapEscHandler<typeof question>(question)

    if (config === 'back') {
      return
    }

    // Prompt xác nhận chạy cấu hình
    const confirmQuestion = prompt<{ confirm: boolean }>({
      type: 'confirm',
      name: 'confirm',
      message: 'Bạn có chắc chắn muốn chạy cấu hình này không?',
      default: false,
    })

    const { confirm } = await wrapEscHandler<typeof confirmQuestion>(confirmQuestion)

    if (!confirm) {
      console.log('❌ Đã hủy chạy cấu hình')
      return
    }

    // Log cấu hình sau khi xác nhận
    console.log('🚀 Bắt đầu chạy với cấu hình:')
    console.log(`   📊 Mục tiêu: ${abbreviateNumber(Number(config.target) / 10 ** 6)}`)
    console.log(`   💰 Số tiền: ${Number(config.amount) / 10 ** 9} SOL`)
    console.log(`   📈 Lợi nhuận: ${config.profitSell}%`)
    console.log(`   💡 Tip: ${Number(config.jitoTip) / 10 ** 9} SOL`)
    console.log(`   ⏰ Hết hạn: ${config.expiresHour} giờ`)
    console.log(`   🚀 Boost: ${config.hasBoost ? 'Có' : 'Không'}`)
    if (config.hasBoost && config.totalBoost) {
      console.log(`   🚀 Tổng boost: ${config.totalBoost}`)
    }
    console.log(`   🖼️ Hình ảnh: ${config.hasImage ? 'Có' : 'Không'}`)
    console.log('')

    poolMonitor.start()
    const sub = poolMonitor.asObservable().subscribe({
      next: poolKeys => {
        try {
          this.doBuy(poolKeys, config)
        } catch (error) {
          console.error(`❌ Lỗi khi xử lý pool event:`, error)
        }
      },
      error: err => {
        console.error(`❌ Lỗi pool monitor subscription:`, err)
      },
    })

    this.configCache.set(config.id, sub)
  }

  async doBuy(poolKeys: PoolKeys & { timestamp: bigint }, config: Config) {
    try {
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
            try {
              subscriber.unsubscribe()
              const metadataCheck = await this.checkMetadata(poolKeys, config)

              if (!metadataCheck) {
                console.log(`Pool ${pool} không đáp ứng điều kiện`)
                return
              }

              if (this.isExpired(poolKeys.timestamp, config.expiresHour)) {
                console.log(`Pool ${pool} đã hết hạn`)
                return
              }

              await this.buy(poolKeys, config, baseAmount, quoteAmount, tip)
            } catch (error) {
              console.error(`❌ Lỗi khi xử lý pool ${pool}:`, error)
            }
          },
          error: err => {
            console.error(`❌ Lỗi stream cho pool ${pool}:`, err)
            // Cleanup subscriber on error
            if (this.poolStreamCache.has(pool)) {
              this.poolStreamCache.delete(pool)
            }
          },
        })

      this.poolStreamCache.set(pool, subscriber)
      console.log('Đã lắng nghe pool: ' + pool)
    } catch (error) {
      console.error(`❌ Lỗi khởi tạo doBuy cho pool ${poolKeys.pool}:`, error)
    }
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
          if (tokenInfo.totalBoostAmount <= config.totalBoost) {
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
    try {
      const { pumpswapClient, transactionManager, payer } = this.context
      const { base } = computeBuyQuoteIn({
        quote: config.amount,
        slippage: 1,
        baseReserve: baseAmount,
        quoteReserve: quoteAmount,
        coinCreator: poolKeys.coinCreator,
      })

      const buyInstructions = await pumpswapClient.createBuyInstructions(
        {
          amountOut: base,
          buyer: payer,
          maxAmountIn: config.amount,
          poolKeys: poolKeys,
        },
        { hasBaseAta: false, hasQuoteAta: false }
      )

      let buySuccess = false
      for (let i = 0; i < 10 && !buySuccess; i++) {
        try {
          const transaction = await transactionManager.buildSenderTransaction(
            buyInstructions,
            payer,
            {
              senderTip: Math.max(tip, Number(config.jitoTip) / 10 ** 9),
              priorityFeeLevel: 'recommended',
            }
          )

          const result = await transactionManager.sendSenderTransaction(transaction)
          const status = await transactionManager.confirmTransaction(result as Signature)

          if (status.confirmed) {
            console.log(`🚀 Mua thành công: ${poolKeys.pool}`)
            buySuccess = true

            try {
              if (this.context.telegramService?.isReady()) {
                await this.context.telegramService.notifyBuySuccess({
                  poolAddress: poolKeys.pool,
                  baseMint: poolKeys.baseMint,
                  payer: payer.address,
                  txSignature: result,
                })
              }
            } catch (telegramError) {
              console.error('❌ Lỗi gửi thông báo Telegram:', telegramError)
            }
          } else {
            console.log(`⚠️ Giao dịch không thành công, thử lại lần ${i + 1}/10`)
          }
        } catch (txError) {
          console.error(`❌ Lỗi giao dịch lần ${i + 1}/10:`, txError)

          // Wait a bit before retrying
          if (i < 9) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
      }

      if (!buySuccess) {
        console.error(`❌ Không thể mua sau 10 lần thử cho pool: ${poolKeys.pool}`)
      }
    } catch (error) {
      console.error(`❌ Lỗi nghiêm trọng trong hàm buy cho pool ${poolKeys.pool}:`, error)
    }
  }

  private isExpired(poolTimestamp: bigint, expiresHour: number): boolean {
    const poolTime = Number(poolTimestamp) * 1000

    const currentTime = Date.now() // ms
    const expirationTime = poolTime + expiresHour * 60 * 60 * 1000 // ms

    return currentTime > expirationTime
  }

  watchAccount(address: Address) {
    try {
      const { advanceSubscriptions } = this.context.provider
      return advanceSubscriptions.accountNotifications(address, {
        delay: 1000,
        initial: false,
        retry: Infinity,
      })
    } catch (error) {
      console.error(`❌ Lỗi khi theo dõi account ${address}:`, error)
      throw error
    }
  }

  stop() {}

  async stopPool() {
    try {
      const inquirer = await import('inquirer')
      const prompt = inquirer.default.prompt
      const pools = Array.from(this.poolStreamCache.keys())

      if (pools.length === 0) {
        console.log('❌ Không có pool nào đang được theo dõi')
        return
      }

      const question = prompt<{ pool: Address }>({
        type: 'search',
        name: 'pool',
        message: 'Nhập pool muốn dừng theo dõi: ',
        source: async input => {
          if (!input) {
            return pools.map(pool => ({ name: pool, value: pool }))
          }

          return pools
            .filter(pool => pool.toLowerCase().includes(input.toLowerCase()))
            .map(pool => ({ name: pool, value: pool }))
        },
        filter: (value: string) => {
          try {
            return address(value)
          } catch (error) {
            console.error('❌ Địa chỉ pool không hợp lệ:', error)
            throw error
          }
        },
      })

      const answer = await wrapEscHandler<typeof question>(question)
      const subscriber = this.poolStreamCache.get(answer.pool)
      if (subscriber) {
        subscriber.unsubscribe()
        this.poolStreamCache.delete(answer.pool)
        console.log(`🛑 Dừng theo dõi pool: ${answer.pool}`)
      } else {
        console.log(`❌ Không tìm thấy pool: ${answer.pool}`)
      }
    } catch (error) {
      console.error('❌ Lỗi khi dừng theo dõi pool:', error)
    }
  }
}

ExecutorCommand.paths = [['executor']]
