import { wrapEscHandler, type SolanaBotContext } from '@solana-kit-bot/core'
import { type RaydiumCpmmClient } from '@solana-kit-bot/raydium-cpmm'
import { Command, type BaseContext } from 'clipanion'
import { Telegraf } from 'telegraf'
import { PoolService } from '../services/PoolService'
import type { PoolMonitor } from '~/services/PoolMonitorService'

type TelegramBotContext = BaseContext &
  SolanaBotContext & {
    readonly raydiumClient: RaydiumCpmmClient
    readonly poolService: PoolService
    readonly poolMonitor: PoolMonitor
    readonly telegraf: Telegraf
  }

/**
 * Telegram bot command for pool checker functionality
 */
export class TelegramBotCommand extends Command<TelegramBotContext> {
  private telegraf!: Telegraf
  private isRunning = false

  /**
   * Initialize Telegram bot with configuration
   */
  initialize() {
    this.telegraf = this.context.telegraf
    this.setupBotHandlers()
  }

  /**
   * Setup bot command handlers and middleware
   */
  private setupBotHandlers() {
    const { raydiumClient, poolService } = this.context
    this.telegraf.start(ctx => {
      ctx.reply(
        'Chào mừng bạn đến với Pool Checker Bot! 🚀\n\nSử dụng /help để xem danh sách lệnh.'
      )
    })

    this.telegraf.command('help', ctx => {
      ctx.reply(
        '📚 Danh sách lệnh:\n\n' +
          '/add <pool_address> - Thêm pool mới\n' +
          '/list - Xem danh sách pools\n' +
          '/stats - Xem thống kê pools\n' +
          '/search <keyword> - Tìm kiếm pool\n' +
          '/help - Hiển thị trợ giúp'
      )
    })

    this.telegraf.command('add', async ctx => {
      const poolAddress = ctx.message.text.split(' ')[1]
      if (!poolAddress) {
        ctx.reply('Vui lòng cung cấp địa chỉ pool.\nVí dụ: /add <pool_address>')
        return
      }

      try {
        const poolKeys = await raydiumClient.fetchPoolKeys(poolAddress)

        const createdPool = await poolService.addPoolFromTelegram(poolAddress, poolKeys)

        ctx.reply(
          `✅ Đã thêm pool thành công!\n\n📋 Thông tin pool:\n• Địa chỉ: ${createdPool.address}\n• Token0 Mint: ${createdPool.token0Mint}\n• Token1 Mint: ${createdPool.token1Mint}\n• Trạng thái: ${createdPool.isActive ? 'Hoạt động' : 'Không hoạt động'}`
        )
        this.context.poolMonitor.watchPool(poolKeys)
      } catch (error) {
        console.error('Error adding pool:', error)
        ctx.reply(
          `❌ Lỗi khi thêm pool: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`
        )
      }
    })

    this.telegraf.command('list', async ctx => {
      try {
        const pools = await poolService.getActivePools(10)

        if (pools.length === 0) {
          ctx.reply('📭 Chưa có pool nào được thêm vào hệ thống.')
          return
        }

        const poolList = pools
          .map(
            (pool, index) =>
              `${index + 1}. ${pool.address}\n   Token0: ${pool.token0Mint}\n   Token1: ${pool.token1Mint}`
          )
          .join('\n\n')

        ctx.reply(`📋 Danh sách pools (${pools.length} pools):\n\n${poolList}`)
      } catch (error) {
        console.error('Error listing pools:', error)
        ctx.reply(
          `❌ Lỗi khi lấy danh sách pools: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`
        )
      }
    })

    this.telegraf.command('search', async ctx => {
      const searchTerm = ctx.message.text.split(' ')[1]
      if (!searchTerm) {
        ctx.reply('Vui lòng cung cấp từ khóa tìm kiếm.\nVí dụ: /search <keyword>')
        return
      }

      try {
        const pools = await poolService.searchPools(searchTerm, 5)

        if (pools.length === 0) {
          ctx.reply(`🔍 Không tìm thấy pool nào chứa từ khóa "${searchTerm}"`)
          return
        }

        const poolList = pools
          .map(
            (pool, index) =>
              `${index + 1}. ${pool.address}\n   Token0: ${pool.token0Mint}\n   Token1: ${pool.token1Mint}`
          )
          .join('\n\n')

        ctx.reply(`🔍 Kết quả tìm kiếm cho "${searchTerm}" (${pools.length} pools):\n\n${poolList}`)
      } catch (error) {
        console.error('Error searching pools:', error)
        ctx.reply(
          `❌ Lỗi khi tìm kiếm: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`
        )
      }
    })

    this.telegraf.catch((err, ctx) => {
      console.error('Bot error:', err)
      ctx.reply('Đã xảy ra lỗi khi xử lý yêu cầu của bạn.')
    })
  }

  override async execute(): Promise<number | void> {
    this.initialize()

    const inquirer = await import('inquirer')
    const prompt = inquirer.default.prompt
    const controller = new AbortController()

    while (!controller.signal.aborted) {
      const question = prompt<{ action: () => Promise<void> }>({
        type: 'select',
        name: 'action',
        message: 'Chọn thao tác: ',
        choices: [
          {
            name: 'Khởi động telegram bot',
            value: this.start.bind(this),
            disabled: this.isRunning,
          },
          {
            name: 'Dừng telegram bot',
            value: this.stop.bind(this),
            disabled: !this.isRunning,
          },
          {
            name: 'Xem trạng thái bot',
            value: this.status.bind(this),
          },
          {
            name: 'Thoát',
            value: () => {
              controller.abort()
              return Promise.resolve()
            },
          },
        ],
      })

      const answer = await wrapEscHandler<typeof question>(question)

      await answer.action()
    }

    return 0
  }

  /**
   * Start the Telegram bot
   */
  async start() {
    if (this.isRunning) {
      console.log('Bot đã đang chạy!')
      return
    }

    try {
      console.log('Đang khởi động Telegram bot...')
      this.telegraf.launch()
      this.isRunning = true
      console.log('✅ Bot đã được khởi động thành công!')

      process.once('SIGINT', () => this.telegraf.stop('SIGINT'))
      process.once('SIGTERM', () => this.telegraf.stop('SIGTERM'))
    } catch (error) {
      console.error('❌ Lỗi khi khởi động bot:', error)
      throw error
    }
  }

  /**
   * Stop the Telegram bot
   */
  async stop() {
    if (!this.isRunning) {
      console.log('Bot chưa được khởi động!')
      return
    }

    try {
      console.log('Đang dừng Telegram bot...')
      this.telegraf.stop()
      this.isRunning = false
      console.log('✅ Bot đã được dừng thành công!')
    } catch (error) {
      console.error('❌ Lỗi khi dừng bot:', error)
      throw error
    }
  }

  /**
   * Check bot status
   */
  async status() {
    console.log(`Trạng thái bot: ${this.isRunning ? 'Đang chạy ✅' : 'Đã dừng ❌'}`)
  }

  override async catch(error: any): Promise<void> {
    console.error('❌ Lỗi trong TelegramBotCommand:', error)

    if (this.isRunning) {
      try {
        this.telegraf.stop()
        this.isRunning = false
      } catch (stopError) {
        console.error('Lỗi khi dừng bot:', stopError)
      }
    }
  }
}
TelegramBotCommand.paths = [['telegrambot run']]
