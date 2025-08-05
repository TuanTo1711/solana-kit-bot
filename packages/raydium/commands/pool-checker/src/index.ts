import { Cli, Command, type BaseContext } from 'clipanion'
import { Telegraf } from 'telegraf'

import { wrapEscHandler, type SolanaBotContext } from '@solana-kit-bot/core'
import { createRaydiumCpmmClient } from '@solana-kit-bot/raydium-cpmm'

import { PoolCheckerConfigCommand } from '~/commands/config-command'
import { ExecutorCommand } from './commands/executor-command'
import { TelegramBotCommand } from './commands/telegrambot-command'
import { PrismaClient } from './database/client'
import { DexScreenerAPI } from './dexscreener-api'
import { ConfigService, PoolService } from './services'
import { PoolMonitor } from './services/PoolMonitorService'

export class PoolCheckerCommand extends Command<BaseContext & SolanaBotContext> {
  private configService!: ConfigService
  private poolService!: PoolService
  private telegraf!: Telegraf
  private poolMonitor!: PoolMonitor

  async initialize() {
    const prisma = new PrismaClient()
    this.configService = new ConfigService(prisma)
    this.poolService = new PoolService(prisma)
    this.telegraf = new Telegraf('7655879426:AAGEU4os80GcClr3VIZ6eyyr2e4yZaUzhJ8')
    this.poolMonitor = new PoolMonitor()
  }

  override async execute(): Promise<number | void> {
    await this.initialize()

    const controller = new AbortController()
    const inquirer = await import('inquirer')
    const prompt = inquirer.default.prompt

    while (!controller.signal.aborted) {
      const question = prompt<{ command: () => Promise<void> }>({
        type: 'select',
        name: 'command',
        message: 'Lựa chọn lệnh: ',
        choices: [
          {
            name: 'Quản lý cấu hình',
            value: this.runConfigCommand.bind(this),
          },
          {
            name: 'Telegram Bot',
            value: this.runTelebot.bind(this),
          },
          {
            name: 'Thực thi lệnh',
            value: this.runExecutor.bind(this),
          },
          {
            name: 'Quay lại menu',
            value: async () => controller.abort(),
          },
        ],
      })

      const { command } = await wrapEscHandler<typeof question>(question)

      await command()
    }
  }

  async runConfigCommand() {
    await Cli.from([PoolCheckerConfigCommand]).run(['config run'], {
      ...this.context,
      configService: this.configService,
    })
  }

  async runTelebot() {
    const raydiumClient = createRaydiumCpmmClient(this.context.provider.rpc)
    await Cli.from([TelegramBotCommand]).run(['telegrambot run'], {
      ...this.context,
      raydiumClient,
      poolService: this.poolService,
      telegraf: this.telegraf,
      poolMonitor: this.poolMonitor,
    })
  }

  async runExecutor() {
    const raydiumClient = createRaydiumCpmmClient(this.context.provider.rpc)
    await Cli.from([ExecutorCommand]).run(['executor run'], {
      ...this.context,
      raydiumClient,
      dexscreenerAPI: new DexScreenerAPI(),
      telegraf: this.telegraf,
      poolMonitor: this.poolMonitor,
      configService: this.configService,
    })
  }
}

PoolCheckerCommand.paths = [['pool-checker run']]
PoolCheckerCommand.usage = Command.Usage({
  category: `Raydium Launchlab`,
  description: `Lọc và mua khi pool đạt yêu cầu`,
  details: `
  Hệ thống kiểm tra và mua khi pool đạt yêu cầu.
  `,
  examples: [
    [`A basic example`, `$0 pool-checker`],
    [`A second example`, `$0 pool-checker -t 700000000 -b -i -e 24 -a 1 -p 10 -tip 0.000000001`],
  ],
})
