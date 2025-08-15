import type { SolanaBotContext } from '@solana-kit-bot/core'
import chalk from 'chalk'
import { Command, type BaseContext } from 'clipanion'

export class PumpswapCommand extends Command<BaseContext & SolanaBotContext> {
  override async execute(): Promise<number | void> {
    const controller = new AbortController()
    const initChoices = this.createMenuChoices()
    const inquirer = (await import('inquirer')).default
    const figlet = (await import('figlet')).default
    const gradient = (await import('gradient-string')).default

    while (!controller.signal.aborted) {
      try {
        // Clear screen using stdout
        this.context.stdout.write('\x1b[2J\x1b[0f')

        const banner = figlet.textSync('PUMPSWAP', {
          font: 'ANSI Shadow',
          horizontalLayout: 'default',
          verticalLayout: 'default',
        })
        this.context.stdout.write('\n' + gradient(['#FFFFFF', '#00FF88'])(banner) + '\n')
        this.context.stdout.write(gradient(['#FFFFFF', '#00FF88'])('═'.repeat(100)) + '\n')

        const now = new Date()
        const timeString = now.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
        this.context.stdout.write(
          chalk.hex('#00FF88')('🚀 ') +
            chalk.white.bold('Solana Bot - PumpSwap Trading Module') +
            chalk.hex('#00FF88')(' 🚀') +
            '\n'
        )
        this.context.stdout.write(
          chalk.gray('⏰ ') +
            chalk.white(`${timeString}`) +
            chalk.gray('  │  🟢 ') +
            chalk.hex('#00FF88')('Active') +
            chalk.gray('  │  📊 ') +
            chalk.hex('#FFFFFF')('Trading Ready') +
            '\n'
        )
        this.context.stdout.write(gradient(['#FFFFFF', '#00FF88'])('═'.repeat(100)) + '\n')

        const { command } = await inquirer.prompt<{
          command: () => Promise<void> | Promise<Command> | void
        }>({
          type: 'list',
          name: 'command',
          message: chalk.bold('🎯 Chọn chức năng:'),
          choices: [
            ...initChoices,
            new inquirer.Separator(chalk.hex('#00FF88')('─'.repeat(100))),
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

        await command()
        this.context.stdout.write('\n')
        if (!controller.signal.aborted) {
          await inquirer.prompt([
            {
              type: 'confirm',
              name: 'continue',
              message: chalk.hex('#00FF88').bold('Nhấn Enter để quay lại menu chính...'),
              default: true,
            },
          ])
          return
        }
        this.context.stdout.write('\x1b[2J\x1b[0f')
      } catch (error) {
        controller.abort()
      }
    }
  }

  private createMenuChoices() {
    return [
      {
        name: `💰 Mua + Bán với nhiều ví ảo ${chalk.gray('- Virtual Trading')}`,
        value: () => this.getCommand('pumpswap virtual-trading'),
      },
      {
        name: `🔍 Lọc và mua khi pool đạt yêu cầu ${chalk.gray('- Pool Checker')}`,
        value: () => this.getCommand('pumpswap pool-checker', 'run'),
      },
      {
        name: `📈 Đặt lệnh mua tự động ${chalk.gray('- Limit Order Buy')}`,
        value: () => this.getCommand('limit-order'),
        disabled: `- Chưa phát triển xong`,
      },
    ]
  }

  private async getCommand(name: string, commandArgs: string = '') {
    // Clear screen using stdout
    this.context.stdout.write('\x1b[2J\x1b[0f')
    const figlet = (await import('figlet')).default
    const gradient = (await import('gradient-string')).default

    const banner = figlet.textSync(name.replace(/-/g, ' '), {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default',
    })

    this.context.stdout.write('\n' + gradient(['#FFFFFF', '#00FF88'])(banner) + '\n')
    this.context.stdout.write(gradient(['#FFFFFF', '#00FF88'])('═'.repeat(100)) + '\n')

    await this.cli.run([`${name}${commandArgs ? ' ' + commandArgs : ''}`], this.context)
  }
}

PumpswapCommand.paths = [['pumpswap']]
