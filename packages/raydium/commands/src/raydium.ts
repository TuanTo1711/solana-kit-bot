import { Command, type BaseContext } from 'clipanion'
import { type SolanaBotContext } from '@solana-kit-bot/core'

export class RaydiumCommands extends Command<BaseContext & SolanaBotContext> {
  private readonly rootPrefix = 'raydium '

  override async execute(): Promise<number | void> {
    const { default: inquirer } = await import('inquirer')
    const prompt = inquirer.prompt
    const controller = new AbortController()

    while (!controller.signal.aborted) {
      prompt<{ command: () => Promise<void> }>({
        type: 'select',
        name: 'command',
        message: 'Chọn chức năng bạn muốn sử dụng: ',
        choices: [
          {
            name: 'Virtual Trading',
            value: this.cli.run.bind(this.cli, [`${this.rootPrefix}`]),
          },
          {
            name: 'Fast Pump',
            value: this.cli.run.bind(this.cli, [`${this.rootPrefix} fast-pump`]),
          },
        ],
      })
    }
  }
}
