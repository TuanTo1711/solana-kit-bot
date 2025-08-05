import type { SolanaBotContext } from '@solana-kit-bot/core'
import chalk from 'chalk'
import { Command, type BaseContext } from 'clipanion'

export class RaydiumLaunchlabCommand extends Command<BaseContext & SolanaBotContext> {
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

        const raydiumLaunchlabBanner = figlet.textSync('LAUNCHLAB', {
          font: 'ANSI Shadow',
          horizontalLayout: 'default',
          verticalLayout: 'default',
        })
        this.context.stdout.write(
          '\n' + gradient(['#FFD700', '#FFC400'])(raydiumLaunchlabBanner) + '\n'
        )
        this.context.stdout.write(gradient(['#FFD700', '#FFC400'])('═'.repeat(100)) + '\n')

        const now = new Date()
        const timeString = now.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
        this.context.stdout.write(
          chalk.hex('#FFD700')('🚀 ') +
            chalk.white.bold('Solana Bot - Raydium Launchlab Trading Module') +
            chalk.hex('#FFD700')(' 🚀') +
            '\n'
        )
        this.context.stdout.write(
          chalk.gray('⏰ ') +
            chalk.white(`${timeString}`) +
            chalk.gray('  │  🟢 ') +
            chalk.hex('#FFD700')('Active') +
            chalk.gray('  │  📊 ') +
            chalk.hex('#FFC400')('Trading Ready') +
            '\n'
        )
        this.context.stdout.write(gradient(['#FFD700', '#FFC400'])('═'.repeat(100)) + '\n')

        const { command } = await inquirer.prompt<{
          command: () => Promise<void> | Promise<Command> | void
        }>({
          type: 'list',
          name: 'command',
          message: chalk.bold('🎯 Chọn chức năng:'),
          choices: [
            ...initChoices,
            new inquirer.Separator(chalk.hex('#FFC400')('─'.repeat(100))),
            {
              name: `🔙 ${chalk.gray('Quay lại menu chính')}`,
              value: controller.abort.bind(controller),
            },
          ],
          theme: {
            style: {
              answer: (text: string) => chalk.hex('#FFD700')(text),
              message: (text: string, status: string) =>
                status === 'done' ? chalk.hex('#FFD700')(text) : chalk.hex('#FFC400')(text),
              error: (text: string) => chalk.red(text),
              defaultAnswer: (text: string) => chalk.dim(text),
              help: (text: string) => chalk.dim(text),
              highlight: (text: string) => chalk.hex('#FFD700').bold(text),
              key: (text: string) => chalk.hex('#FFC400').bold(text),
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
              message: chalk.hex('#FFD700').bold('Nhấn Enter để quay lại menu chính...'),
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
        value: () => this.getCommand('virtual-trading'),
      },
      {
        name: `🔍 Lọc và mua khi pool đạt yêu cầu ${chalk.gray('- Pool Checker')}`,
        value: () => this.getCommand('pool-checker', 'run'),
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

    this.context.stdout.write('\n' + gradient(['#FFD700', '#FFC400'])(banner) + '\n')
    this.context.stdout.write(gradient(['#FFD700', '#FFC400'])('═'.repeat(100)) + '\n')

    await this.cli.run([`${name}${commandArgs ? ' ' + commandArgs : ''}`], this.context)
  }
}

RaydiumLaunchlabCommand.paths = [['raydium-launchlab']]
