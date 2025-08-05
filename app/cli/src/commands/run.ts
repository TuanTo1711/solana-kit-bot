import type { SolanaBotContext } from '@solana-kit-bot/core'
import chalk from 'chalk'
import { Command, type BaseContext } from 'clipanion'
import figlet from 'figlet'
import gradient from 'gradient-string'

export class RunCommand extends Command<BaseContext & SolanaBotContext> {
  private startTime: Date

  constructor() {
    super()
    this.startTime = new Date()
  }

  private displayBanner(): void {
    const banner = figlet.textSync('SOLANA BOT', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default',
    })

    this.context.stdout.write('\n' + gradient(['#9945FF', '#14F195'])(banner) + '\n')

    const currentTime = this.startTime.toLocaleString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    const statusBar = [
      chalk.hex('#9945FF')('🚀 CLI tự động hóa chương trình trên Solana'),
      chalk.hex('#14F195')('⚡ Phiên bản: 1.0.0'),
      chalk.hex('#e84393')(`🕒 Khởi động vào ${currentTime}`),
    ].join('\n')

    this.context.stdout.write(chalk.bold(statusBar) + '\n')
    this.context.stdout.write(gradient(['#9945FF', '#14F195'])('═'.repeat(80)) + '\n')
  }

  override async execute(): Promise<number | void> {
    const inquirer = await import('inquirer')
    const prompt = inquirer.default.prompt

    while (true) {
      this.displayBanner()
      const choices = this.createMenuChoices()

      const { action } = await prompt<{
        action: () => Promise<void | number>
      }>({
        type: 'list',
        name: 'action',
        message: chalk.bold('🎯 Chọn chức năng bạn muốn sử dụng: '),
        choices: [
          ...choices,
          new inquirer.default.Separator(chalk.hex('#00cec9')('─'.repeat(80))),
          {
            name: `🚪 ${chalk.hex('#e17055')('Thoát')} ${chalk.gray('- Đóng ứng dụng')}`,
            value: process.exit.bind(process, 0),
          },
        ],
        pageSize: 15,
        theme: {
          style: {
            answer: (text: string) => chalk.hex('#9945FF')(text),
            message: (text: string, status: string) =>
              status === 'done' ? chalk.green(text) : chalk.blue(text),
            error: (text: string) => chalk.red(text),
            defaultAnswer: (text: string) => chalk.dim(text),
            help: (text: string) => chalk.dim(text),
            highlight: (text: string) => chalk.bold(text),
            key: (text: string) => chalk.hex('#14F195').bold(text),
          },
        },
      })
      this.context.stdout.write('\x1b[2J\x1b[0f')
      await action()
      this.context.stdout.write('\x1b[2J\x1b[0f')
    }
  }

  private createMenuChoices() {
    const choices = []
    choices.push({
      name: `®️  ${gradient(['#FFD700', '#FFC400'])('Raydium Launchlab')} ${chalk.gray('- Raydium Launchlab Trading Bot')}`,
      value: this.cli.run.bind(this.cli, ['raydium-launchlab']),
    })

    choices.push({
      name: `📚 ${chalk.hex('#0984e3')('Trợ giúp')} ${chalk.gray('- Hướng dẫn sử dụng chi tiết')}`,
      value: this.showHelp.bind(this),
    })

    choices.push({
      name: `🔧 ${chalk.hex('#4F46E5')('Cấu hình Bot')} ${chalk.gray('- Cấu hình toàn cục cho bot')}`,
      value: this.cli.run.bind(this.cli, ['config']),
    })

    return choices
  }

  private async showHelp(): Promise<void> {
    const inquirer = (await import('inquirer')).default

    const helpBanner = figlet.textSync('HELP', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default',
    })

    this.context.stdout.write('\n' + gradient(['#0984e3', '#74b9ff'])(helpBanner) + '\n')
    this.context.stdout.write(gradient(['#0984e3', '#74b9ff'])('═'.repeat(80)) + '\n')

    this.context.stdout.write(
      chalk.hex('#0984e3').bold(`📖 Hướng dẫn sử dụng Solana Bot CLI`) + '\n'
    )

    this.context.stdout.write(chalk.hex('#00b894').bold(`🔧 Quản lý cấu hình:`) + '\n')
    this.context.stdout.write(
      chalk.gray('   ├─ solana-kit-bot config          ') +
        chalk.cyan('# Menu tương tác cấu hình') +
        '\n'
    )
    this.context.stdout.write(
      chalk.gray('   ├─ solana-kit-bot config show     ') +
        chalk.cyan('# Hiển thị cấu hình hiện tại') +
        '\n'
    )
    this.context.stdout.write(chalk.gray('   └─ solana-kit-bot config set <key> <value>') + '\n')

    this.context.stdout.write(chalk.hex('#9945FF').bold(`🚀 Chạy bot:`) + '\n')
    this.context.stdout.write(
      chalk.gray('   ├─ solana-kit-bot run             ') +
        chalk.cyan('# Menu tương tác chính') +
        '\n'
    )
    this.context.stdout.write(
      chalk.gray('   ├─ solana-kit-bot pumpswap run    ') + chalk.cyan('# Chạy bot Pumpswap') + '\n'
    )
    this.context.stdout.write(chalk.gray('   └─ solana-kit-bot <subcommand> run') + '\n')

    this.context.stdout.write(chalk.hex('#FFD700').bold(`⚡ Tạo client cho chương trình:`) + '\n')
    this.context.stdout.write(chalk.gray('   └─ solana-kit-bot program-generate <options>') + '\n')

    this.context.stdout.write(chalk.hex('#e17055').bold(`📚 Trợ giúp chi tiết:`) + '\n')
    this.context.stdout.write(
      chalk.gray('   ├─ solana-kit-bot --help          ') +
        chalk.cyan('# Trợ giúp tổng quát') +
        '\n'
    )
    this.context.stdout.write(
      chalk.gray('   └─ solana-kit-bot <command> --help ') +
        chalk.cyan('# Trợ giúp lệnh cụ thể') +
        '\n'
    )

    this.context.stdout.write(chalk.hex('#fd79a8').bold(`⌨️  Phím tắt:`) + '\n')
    this.context.stdout.write(
      chalk.gray('   ├─ Ctrl+C                         ') +
        chalk.cyan('# Ép dừng chương trình') +
        '\n'
    )
    this.context.stdout.write(
      chalk.gray('   ├─ ESC                            ') + chalk.cyan('# Thoát nhập lệnh') + '\n'
    )

    this.context.stdout.write(
      chalk.gray('   └─ ↑↓ Arrow Keys                  ') + chalk.cyan('# Điều hướng menu') + '\n'
    )

    this.context.stdout.write(gradient(['#0984e3', '#74b9ff'])('═'.repeat(80)) + '\n')

    await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continue',
        message: chalk.hex('#0984e3').bold('Nhấn Enter để quay lại menu chính...'),
        default: true,
      },
    ])
  }
}

RunCommand.paths = [['run']]
