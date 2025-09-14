import * as fs from 'fs'

import {
  createKeyPairSignerFromBytes,
  getBase58Codec,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit'
import { Command, type BaseContext } from 'clipanion'
import { type DistinctQuestion } from 'inquirer'
import { fileSelector } from 'inquirer-file-selector'

import {
  createLogger,
  wrapEscHandler,
  type Bundle,
  type SolanaBotContext,
} from '@solana-kit-bot/core'
import { createRaydiumCpmmClient } from '@solana-kit-bot/raydium-cpmm'

export type Pumper = {
  keypair: string
  amount: bigint
}

export type RaydiumCpmmFastPumpConfig = {
  pool: string
  wallets: number
  method: 'manual' | 'file'
  tip: bigint
}

export class RaydiumCpmmFastPumpCommand extends Command<BaseContext & SolanaBotContext> {
  private readonly logger = createLogger('RaydiumCpmmFastPumpCommand')

  override async execute(): Promise<number | void> {
    const { default: inquirer } = await import('inquirer')
    const prompt = inquirer.prompt

    const question = prompt<RaydiumCpmmFastPumpConfig>([
      {
        type: 'input',
        name: 'pool',
        message: 'Nhập địa chỉ pool: ',
        required: true,
        validate: (value: string) =>
          value.length === 0 ? 'Địa chỉ pool không được để trống' : true,
      },
      {
        type: 'list',
        name: 'method',
        message: 'Chọn phương thức lấy ví: ',
        choices: [
          {
            name: 'Nhập tay ',
            value: 'manual',
          },
          {
            name: 'Lấy từ file ',
            value: 'file',
          },
        ],
        default: 'manual',
      },
      {
        type: 'number',
        name: 'wallets',
        message: 'Nhập số lượng ví: ',
        required: true,
        min: 1,
        when: (answers: Partial<RaydiumCpmmFastPumpConfig>) => answers.method === 'manual',
      },
      {
        type: 'input',
        name: 'tip',
        message: 'Nhập tip: ',
        default: '0.0001',
        required: true,
        validate: (value: string) =>
          isNaN(parseFloat(value)) || Number(value) <= 0 ? 'Số lượng SOL phải lớn hơn 0' : true,
        filter: (value: string) => BigInt(Number(value) * 10 ** 9),
      },
    ])

    const answer = await wrapEscHandler<typeof question>(question)

    const { wallets, method } = answer
    const pumpers: Pumper[] = []

    if (method === 'manual') {
      for (let i = 0; i < wallets; i++) {
        const question = prompt<Pumper>([this.createKeypairInput(i), this.createAmountInput(i)])
        const answer = await wrapEscHandler<typeof question>(question)
        pumpers.push(answer)
      }
    }

    if (method === 'file') {
      const fileSelected = await fileSelector({
        message: 'Chọn file: ',
        allowCancel: true,
      })

      if (!fileSelected?.path) {
        throw new Error('Không tìm thấy file')
      }

      const fileContent = fs.readFileSync(fileSelected?.path, 'utf8')
      const lines = fileContent.split('\n')
      for (const line of lines) {
        const [keypair, amount] = line.split(' ')
        const signer = keypair!
        const amountIn = BigInt(Number(amount?.replace('\r', '')) * 10 ** 9)

        console.log([signer, amountIn])

        pumpers.push({
          keypair: signer,
          amount: BigInt(Number(amount?.replace('\r', '')) * 10 ** 9),
        })
      }
    }

    await this.doExecute(answer, pumpers)
  }

  async doExecute(answer: RaydiumCpmmFastPumpConfig, pumpers: Pumper[]) {
    const { pool, tip } = answer
    const { provider, transactionManager } = this.context
    const base58 = getBase58Codec()
    const bundle: Bundle[] = []

    const raydiumCpmmClient = createRaydiumCpmmClient(provider.rpc)
    const poolKeys = await raydiumCpmmClient.fetchPoolKeys(pool)
    const pumperChunk = this.chunk(pumpers, 2)

    for (const pumpers of pumperChunk) {
      const instructions: Instruction[] = []
      const signers: TransactionSigner[] = []
      for (const pumper of pumpers) {
        const { keypair, amount } = pumper
        const signer = await createKeyPairSignerFromBytes(base58.encode(keypair))
        const buyInstructions = await raydiumCpmmClient.createBuyInstructions(
          {
            poolKeys,
            buyer: signer,
            amountIn: amount,
            minAmountOut: 1n,
          },
          { hasSolAta: false, hasTokenAta: true }
        )

        instructions.push(...buyInstructions)
        signers.push(signer)
      }

      bundle.push({
        instructions,
        payer: signers[0]!,
        additionalSigner: signers,
      })
    }

    const chunk = this.chunk(bundle, 5)

    for (const bundles of chunk) {
      const bundler = await transactionManager.buildBundle(bundles, tip)
      const result = await transactionManager.sendBundle(bundler)
      this.logger.info(`Đã gửi bundle với ${pumpers.length} ví: `, { bundleId: result })
    }
  }

  private chunk<T>(arr: T[], size: number) {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
      arr.slice(i * size, (i + 1) * size)
    )
  }

  private createKeypairInput(i: number): DistinctQuestion<{ keypair: string }> {
    return {
      type: 'password',
      name: 'keypair',
      message: `Nhập private key cho ví ${i + 1}: `,
      mask: '#',
    }
  }

  private createAmountInput(i: number): DistinctQuestion<{ amount: bigint }> {
    return {
      type: 'input',
      name: 'amount',
      message: `Nhập số lượng SOL dùng cho ví ${i + 1}: `,
      required: true,
      validate: (value: string) =>
        isNaN(parseFloat(value)) || Number(value) <= 0 ? 'Số lượng SOL phải lớn hơn 0' : true,
      filter: (value: string) => BigInt(Number(value) * 10 ** 9),
    }
  }
}
RaydiumCpmmFastPumpCommand.paths = [['fast-pump']]
