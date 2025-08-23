import type { Address } from '@solana/addresses'
import {
  createKeyPairSignerFromBytes,
  getBase58Codec,
  type Instruction,
  type KeyPairSigner,
} from '@solana/kit'
import { Command, type BaseContext } from 'clipanion'
import type { DistinctQuestion } from 'inquirer'

import { wrapEscHandler, type Bundle, type SolanaBotContext } from '@solana-kit-bot/core'
import { computeBuyQuoteIn, createPumpswapClient } from '@solana-kit-bot/pumpswap'

export type Pumper = {
  keypair: string
  amount: bigint
}

export type PumpswapFastPumpConfig = {
  pool: string
  slippage: number
  jitoTip: bigint
}

export class PumpwapFastPumpCommand extends Command<BaseContext & SolanaBotContext> {
  override async execute(): Promise<number | void> {
    const pumpers: Pumper[] = []

    const { default: inquirer } = await import('inquirer')
    const prompt = inquirer.prompt

    const config = prompt<PumpswapFastPumpConfig>([
      {
        type: 'input',
        name: 'pool',
        message: 'Nhập địa chỉ pool: ',
        transformer: value => value.trim(),
      },
      {
        type: 'number',
        name: 'slippage',
        message: 'Nhập slippage: ',
        min: 1,
      },
      {
        type: 'input',
        name: 'jitoTip',
        message: 'Nhập jito tip: ',
        default: '0.001',
        validate: (value: string) =>
          isNaN(parseFloat(value)) || Number(value) <= 0 ? 'Số lượng SOL phải lớn hơn 0' : true,
        filter: (value: string) => BigInt(Number(value) * 10 ** 9),
      },
    ])

    const answer = await wrapEscHandler<typeof config>(config)

    const { numberWallet } = await this.getNumberWallet()
    for (let i = 0; i < numberWallet; i++) {
      const question = prompt<Pumper>([this.createKeypairInput(i), this.createAmountInput(i)])
      const answer = await wrapEscHandler<typeof question>(question)
      pumpers.push(answer)
    }

    await this.doExecute(answer, pumpers)
  }

  async doExecute(answer: PumpswapFastPumpConfig, pumpers: Pumper[]) {
    const { pool, slippage, jitoTip } = answer
    const { provider, transactionManager } = this.context
    const pumpswapClient = createPumpswapClient(provider.rpc)
    const bundle: Bundle[] = []
    const chunked = this.chunk(pumpers, 2)

    console.log('Đang tải thông tin pool: ')
    const poolKeys = await pumpswapClient.fetchPoolKeys(pool)

    const { poolBaseTokenAccount, poolQuoteTokenAccount } = poolKeys

    let [baseTokenBalance, quoteTokenBalance] = await Promise.all([
      this.getBalance(poolBaseTokenAccount),
      this.getBalance(poolQuoteTokenAccount),
    ])

    for (const pumpers of chunked) {
      const instructions: Instruction[] = []
      const signers: KeyPairSigner[] = []
      for (const pumper of pumpers) {
        const { amount, keypair } = pumper

        const buyResult = computeBuyQuoteIn({
          quote: amount,
          baseReserve: baseTokenBalance,
          quoteReserve: quoteTokenBalance,
          coinCreator: poolKeys.coinCreator,
          slippage: slippage,
        })

        const { base, maxQuote, priceImpact } = buyResult
        const signer = await createKeyPairSignerFromBytes(getBase58Codec().encode(keypair))
        const buyInstructions = await pumpswapClient.createBuyInstructions(
          {
            maxAmountIn: amount,
            amountOut: base,
            buyer: signer,
            poolKeys,
          },
          { hasBaseAta: false, hasQuoteAta: false }
        )

        instructions.push(...buyInstructions)
        signers.push(signer)

        console.log({
          wallet: signer.address,
          amount: amount.toString(),
          base: base.toString(),
          maxQuote: maxQuote.toString(),
          priceImpact: `${priceImpact.toFixed(3)}%`,
          baseTokenBalance: baseTokenBalance.toString(),
          quoteTokenBalance: quoteTokenBalance.toString(),
        })

        baseTokenBalance -= base
        quoteTokenBalance += maxQuote
      }

      bundle.push({
        instructions,
        payer: signers[0]!,
        additionalSigner: signers,
      })
    }

    const chunk = this.chunk(bundle, 5)
    for (const bundler of chunk) {
      try {
        const bundled = await transactionManager.buildBundle(bundler, jitoTip)
        const id = await transactionManager.sendBundle(bundled)
        console.log(id)
      } catch (error) {
        console.error(error)
      }
    }
  }

  private chunk<T>(array: T[], size: number) {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
      array.slice(i * size, (i + 1) * size)
    )
  }

  private async getBalance(address: Address) {
    const balance = await this.context.provider.rpc.getTokenAccountBalance(address).send()
    return BigInt(balance.value.amount)
  }

  private createKeypairInput = (index: number): DistinctQuestion<{ keypair: string }> => {
    return {
      type: 'password',
      name: `keypair`,
      message: `Nhập private key cho ví ${index + 1}: `,
      mask: '#',
    }
  }

  private createAmountInput = (index: number): DistinctQuestion<{ amount: bigint }> => {
    return {
      type: 'input',
      name: `amount`,
      message: `Nhập số lượng SOL dùng cho ví ${index + 1}: `,
      validate: (value: string) =>
        isNaN(parseFloat(value)) || Number(value) <= 0 ? 'Số lượng SOL phải lớn hơn 0' : true,
      filter: (value: string) => BigInt(Number(value) * 10 ** 9),
    }
  }

  private async getNumberWallet() {
    const { default: inquirer } = await import('inquirer')
    const prompt = inquirer.prompt

    const question = prompt<{ numberWallet: number }>({
      type: 'number',
      name: 'numberWallet',
      message: 'Nhập số ví sử dụng: ',
      min: 1,
    })

    return await wrapEscHandler<typeof question>(question)
  }
}

PumpwapFastPumpCommand.paths = [['pumpswap fast-pump']]
