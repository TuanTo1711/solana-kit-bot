import { Command, type BaseContext } from 'clipanion'
import { generateKeyPairSigner } from '@solana/kit'

import { wrapEscHandler, type SolanaBotContext } from '@solana-kit-bot/core'
import { createMint } from '@solana-kit-bot/token-program'

type CreatePoolInput = {
  baseAmount: bigint
  quoteMint: string
  quoteAmount: bigint
  jitoTip: bigint
}

export class RaydiumCpmmCreatePoolCommand extends Command<BaseContext & SolanaBotContext> {
  override async execute(): Promise<number | void> {
    const { default: inquirer } = await import('inquirer')
    const prompt = inquirer.prompt

    const question = prompt<CreatePoolInput>([
      {
        type: 'input',
        name: 'baseAmount',
        message: 'Nhập số lượng cho token đầu vào: ',
        required: true,
        filter: (value: string) => BigInt((Number(value) * 10 ** 6).toFixed(0)),
      },
      {
        type: 'input',
        name: 'quoteMint',
        message: 'Nhập địa chỉ token đầu ra: ',
        required: true,
      },
      {
        type: 'input',
        name: 'quoteAmount',
        message: 'Nhập số lượng cho token đầu ra: ',
        required: true,
        filter: (value: string) => BigInt((Number(value) * 10 ** 6).toFixed(0)),
      },
    ])

    const answer = await wrapEscHandler<typeof question>(question)

    const { baseAmount } = answer
    await generateKeyPairSigner()
    createMint({
      name: 'Test Token',
      symbol: 'TEST',
      uri: 'https://example.com',
      supply: baseAmount,
      decimals: 6,
      payer: this.context.payer,
      revokeFreezeAuthority: true,
      revokeMintAuthority: true,
    })
  }
}
