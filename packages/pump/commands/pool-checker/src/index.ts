import chalk from 'chalk'
import { Cli, Command, type BaseContext } from 'clipanion'

import { wrapEscHandler, type SolanaBotContext } from '@solana-kit-bot/core'
import { createPumpswapClient } from '@solana-kit-bot/pumpswap'

import { PrismaClient } from './database/client'
import { DexScreenerAPI } from './external/dexscreener-api'
import { PoolMonitor } from './monitor/pool-monitor'
import { ConfigService, PoolService, TelegramService, type TelegramConfig } from './services'
import { ConfigCommand, ExecutorCommand } from './sub-commands'

export class PumpswapPoolCheckerCommand extends Command<BaseContext & SolanaBotContext> {
  private db!: PrismaClient
  private configService!: ConfigService
  private poolMonitor!: PoolMonitor
  private dexscreenerAPI!: DexScreenerAPI
  private poolService!: PoolService
  private telegramService!: TelegramService

  init() {
    this.db = new PrismaClient()
    this.configService = new ConfigService(this.db)
    this.poolService = new PoolService(this.db)
    this.dexscreenerAPI = new DexScreenerAPI()
    this.poolMonitor = new PoolMonitor(this.context, this.poolService)

    // Initialize Telegram service
    const telegramConfig: TelegramConfig = {
      botToken: '7655879426:AAGEU4os80GcClr3VIZ6eyyr2e4yZaUzhJ8',
      chatIds: ['5112769500', '7116705965'],
      enabled: true,
    }
    this.telegramService = new TelegramService(telegramConfig)
  }

  override async execute(): Promise<number | void> {
    const inquirer = await import('inquirer')
    const prompt = inquirer.default.prompt
    const controller = new AbortController()

    this.init()

    while (!controller.signal.aborted) {
      const question = prompt<{ action: () => Promise<void> }>({
        type: 'select',
        name: 'action',
        message: 'Chọn hành động: ',
        choices: [
          {
            name: '🚀 Quản lý chạy lệnh',
            value: this.runExecutor.bind(this),
          },
          {
            name: '⚙️ Quản lý cấu hình',
            value: this.runConfigManager.bind(this),
          },
          {
            name: 'Quản lý CSDL',
            value: this.runDatabaseManager.bind(this),
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
  }

  private async runConfigManager() {
    const cli = Cli.from(ConfigCommand)
    await cli.run(['config'], {
      ...this.context,
      configService: this.configService,
    })
  }

  private async runExecutor() {
    const cli = Cli.from(ExecutorCommand)
    await cli.run(['executor'], {
      ...this.context,
      configService: this.configService,
      pumpswapClient: createPumpswapClient(this.context.provider.rpc),
      poolMonitor: this.poolMonitor,
      dexscreenerAPI: this.dexscreenerAPI,
      telegramService: this.telegramService,
    })
  }

  private async runDatabaseManager() {}
}

PumpswapPoolCheckerCommand.paths = [['pumpswap pool-checker run']]
