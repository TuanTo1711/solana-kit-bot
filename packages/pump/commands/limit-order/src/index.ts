import { getMintDecoder, getTokenDecoder } from '@solana-program/token'
import { address, type Address } from '@solana/addresses'
import type { Signature } from '@solana/kit'
import chalk from 'chalk'
import CliTable3 from 'cli-table3'
import { Command, type BaseContext } from 'clipanion'
import Decimal from 'decimal.js'
import { combineLatest, filter, map, Subject, takeUntil, tap, withLatestFrom } from 'rxjs'

import { formatUnits, wrapEscHandler, type SolanaBotContext } from '@solana-kit-bot/core'
import {
  computeBuyQuoteIn,
  createPumpswapClient,
  type PoolKeys,
  type PumpswapClient,
} from '@solana-kit-bot/pumpswap'

const SOL_USD_POOL_BASE = 'DQyrAcCrDXQ7NeoqGgDCZwBvWDcYmFCjSb9JtteuvPpz'
const SOL_USD_POOL_QUOTE = 'HLmqeL62xR1QoZ1HKKbXRrdN1p3phKpxRMb2VVopvBBz'
const LAMPORTS_PER_SOL = 10 ** 9
const TOKEN_DECIMALS = 10 ** 6
const CONFIRMATION_RETRIES = 2
const CONFIRMATION_RETRY_DELAY = 1000
const POOL_WATCH_DELAY = 1000

/**
 * Pool information interface for display purposes
 */
interface PoolInfo {
  priceInSol: Decimal
  priceInUSD: Decimal
  marketCap: string
}

/**
 * Pool data interface with calculated values
 */
interface PoolData {
  baseDecimal: Decimal
  quoteDecimal: Decimal
  priceInSol: Decimal
  priceInUSD: Decimal
  marketCap: Decimal
}

type PriorityFee = 'recommended' | 'Min' | 'Low' | 'Medium' | 'High' | 'VeryHigh'

export type PumpswapLimitOrderConfig = {
  pool: string
  target: bigint
  amount: bigint
  slippage: number
  priorityFeeLevel: PriorityFee
  jitoTip: number
  expired: number
}

export class PumpswapLimitOrderCommand extends Command<BaseContext & SolanaBotContext> {
  private stop$ = new Subject<boolean>()

  override async execute(): Promise<number | void> {
    const inquirer = await import('inquirer')
    const prompt = inquirer.default.prompt

    const question = prompt<PumpswapLimitOrderConfig>([
      {
        type: 'input',
        name: 'pool',
        message: 'Nhập địa chỉ pool: ',
        transformer: value => value.trim(),
      },
      {
        type: 'input',
        name: 'target',
        message: 'Nhập mức pool mục tiêu: ',
        transformer: value => value.trim(),
        validate: (value: string) =>
          isNaN(parseFloat(value)) || Number(value) <= 0 ? 'Vui lòng nhập một số lớn hơn 0' : true,
        filter: (value: string) => BigInt(Number(value) * 10 ** 6),
      },
      {
        type: 'input',
        name: 'amount',
        message: 'Nhập số tiền mua: ',
        transformer: value => value.trim(),
        validate: (value: string) =>
          isNaN(parseFloat(value)) || Number(value) <= 0 ? 'Vui lòng nhập một số lớn hơn 0' : true,
        filter: (value: string) => BigInt(Number(value) * 10 ** 9),
      },
      {
        type: 'number',
        name: 'slippage',
        message: 'Nhập độ trượt giá: ',
        min: 1,
        default: 10,
      },
      {
        type: 'select',
        name: 'priorityFeeLevel',
        message: 'Chọn mức phí ưu tiên: ',
        default: 'recommended',
        choices: [
          {
            name: 'Tự động (tối ưu)',
            value: 'recommended',
          },
          {
            name: 'Thấp nhất',
            value: 'Min',
          },
          {
            name: 'Thấp',
            value: 'Low',
          },
          {
            name: 'Trung bình',
            value: 'Medium',
          },
          {
            name: 'Cao',
            value: 'High',
          },
          {
            name: 'Rất cao',
            value: 'VeryHigh',
          },
        ],
        filter: (value: string) => value as PriorityFee,
      },
      {
        type: 'input',
        name: 'expired',
        message: 'Thời gian hết hạn của lệnh (0 = vô hạn, tính theo giờ từ lúc đặt lệnh): ',
        required: true,
        default: '0',
        transformer: (value: string) => value.trim(),
        validate: (value: string) =>
          isNaN(parseInt(value, 10)) || parseInt(value, 10) < 0
            ? 'Thời gian hết hạn phải lớn hơn 0'
            : true,
        filter: (value: string) => parseInt(value, 10) * 3600 * 1000,
      },
      {
        type: 'input',
        name: 'jitoTip',
        message: 'Nhập jito tip: ',
        default: '0.001',
        transformer: value => value.trim(),
        validate: (value: string) =>
          isNaN(parseFloat(value)) || Number(value) < 0
            ? 'Vui lòng nhập một số lớn hơn hoặc bằng 0'
            : true,
        filter: (value: string) => Number(value),
      },
    ])

    try {
      const answer = await wrapEscHandler<PumpswapLimitOrderConfig>(question)
      const pumpswapClient = createPumpswapClient(this.context.provider.rpc)

      console.log('🔍 Đang kiểm tra pool...')
      const poolKeys = await pumpswapClient.fetchPoolKeys(answer.pool).catch((error: Error) => {
        throw new Error(`Không thể lấy thông tin pool: ${error.message}`)
      })
      const currentPoolData = await this.fetchAndCalculatePoolData(poolKeys)

      const solPriceInUSD = await this.getSolPriceInUSD()
      const afterOrderData = this.calculateAfterOrderPrices(
        currentPoolData,
        answer.target,
        solPriceInUSD
      )

      this.displayComparisonTable({
        current: {
          priceInSol: currentPoolData.priceInSol,
          priceInUSD: currentPoolData.priceInUSD,
          marketCap: currentPoolData.marketCap.toFixed(0),
        },
        afterOrder: {
          priceInSol: afterOrderData.priceInSol,
          priceInUSD: afterOrderData.priceInUSD,
          marketCap: afterOrderData.marketCap.toFixed(1),
        },
      })

      if (!(await this.confirmOrder())) {
        throw new Error('Đã hủy đặt lệnh')
      }

      await this.startPoolMonitoring(poolKeys, pumpswapClient, answer)

      if (answer.expired > 0) {
        const timeout = setTimeout(() => {
          console.log('⏰ Lệnh đã hết hạn')
          this.stop$.next(true)
        }, answer.expired)

        this.stop$.subscribe({
          next: () => clearTimeout(timeout),
          complete: () => clearTimeout(timeout),
        })
      }

      return this.waitForCompletion()
    } catch (error) {
      console.log('\n❌ Lệnh đã được hủy bỏ')
      return 1
    }
  }

  /**
   * Displays a comparison table showing current vs predicted pool metrics
   * @param data - Object containing current and after-order pool information
   */
  private displayComparisonTable(data: { current: PoolInfo; afterOrder: PoolInfo }) {
    const { current, afterOrder } = data

    console.log(`\n${chalk.bold.cyan('So sánh thông tin pool:')}`)

    const table = new CliTable3({
      head: [
        chalk.bold.white('Thông số'),
        chalk.bold.white('Hiện tại'),
        chalk.bold.white('Sau đặt lệnh'),
      ],
      style: {
        head: [],
        border: ['gray'],
        compact: true,
      },
      colWidths: [20, 25, 25],
      wordWrap: true,
    })

    table.push(
      [
        chalk.cyan('Giá (SOL)'),
        chalk.green(`$${this.formatPrice(current.priceInSol)}`),
        chalk.green(`$${this.formatPrice(afterOrder.priceInSol)}`),
      ],
      [
        chalk.cyan('Giá (USD)'),
        chalk.yellow(`$${this.formatPrice(current.priceInUSD)}`),
        chalk.yellow(`$${this.formatPrice(afterOrder.priceInUSD)}`),
      ],
      [
        chalk.cyan('Market cap'),
        chalk.blue(`$${current.marketCap}K`),
        chalk.blue(`$${afterOrder.marketCap}K`),
      ]
    )

    console.log(table.toString())
  }

  /**
   * Prompts user for order confirmation
   * @returns Promise resolving to boolean indicating user confirmation
   */
  private async confirmOrder(): Promise<boolean> {
    const inquirer = await import('inquirer')
    const { confirmed } = await inquirer.default.prompt<{ confirmed: boolean }>({
      type: 'confirm',
      name: 'confirmed',
      message: 'Bạn có chắc chắn muốn chạy lệnh này không?',
    })
    return confirmed
  }

  /**
   * Fetches mint information for a given address
   * @param address - Mint address to fetch information for
   * @returns Promise resolving to decoded mint data
   */
  private async getMint(address: Address) {
    const { rpc } = this.context.provider
    const mint = await rpc.getAccountInfo(address, { encoding: 'base64' }).send()
    const buffer = Buffer.from(mint.value!.data[0], mint.value!.data[1])
    return getMintDecoder().decode(buffer)
  }

  /**
   * Fetches pool data and calculates current price metrics
   * @param poolAddress - The pool address to fetch data from
   * @returns Promise resolving to calculated pool data
   */
  private async fetchAndCalculatePoolData(poolKeys: PoolKeys): Promise<PoolData> {
    const [baseData, quoteData, solPriceInUSD, mint] = await Promise.all([
      this.context.provider.rpc.getTokenAccountBalance(poolKeys.poolBaseTokenAccount).send(),
      this.context.provider.rpc.getTokenAccountBalance(poolKeys.poolQuoteTokenAccount).send(),
      this.getSolPriceInUSD(),
      this.getMint(poolKeys.baseMint),
    ])

    const baseDecimal = new Decimal(baseData.value.amount).div(TOKEN_DECIMALS)
    const quoteDecimal = new Decimal(quoteData.value.amount).div(LAMPORTS_PER_SOL)
    const priceInSol = quoteDecimal.div(baseDecimal)
    const priceInUSD = priceInSol.mul(solPriceInUSD)
    const marketCap = priceInUSD.mul(mint.supply.toString()).div(TOKEN_DECIMALS)

    return {
      baseDecimal,
      quoteDecimal,
      priceInSol,
      priceInUSD,
      marketCap,
    }
  }

  /**
   * Calculates predicted prices after the order execution
   * @param currentData - Current pool data
   * @param target - Target amount for the order
   * @param solPriceInUSD - Current SOL price in USD
   * @returns Calculated prices after order execution
   */
  private calculateAfterOrderPrices(currentData: PoolData, target: bigint, solPriceInUSD: Decimal) {
    const { baseDecimal, quoteDecimal } = currentData
    const targetDecimal = new Decimal(target.toString()).div(TOKEN_DECIMALS)
    const constant = targetDecimal.div(baseDecimal)
    const quoteAmountAfter = quoteDecimal.div(constant)
    const priceInSolAfter = quoteAmountAfter.div(targetDecimal)

    return {
      priceInSol: priceInSolAfter,
      priceInUSD: priceInSolAfter.mul(solPriceInUSD),
      marketCap: priceInSolAfter.mul(currentData.marketCap).div(currentData.priceInSol),
    }
  }

  /**
   * Fetches current SOL price in USD from the SOL/USD pool
   * @returns Promise resolving to SOL price in USD as Decimal
   */
  private async getSolPriceInUSD(): Promise<Decimal> {
    const { rpc } = this.context.provider
    const [baseMintInfo, quoteMintInfo] = await Promise.all([
      rpc.getAccountInfo(address(SOL_USD_POOL_BASE), { encoding: 'base64' }).send(),
      rpc.getAccountInfo(address(SOL_USD_POOL_QUOTE), { encoding: 'base64' }).send(),
    ])

    const baseAmount = this.decodeTokenAmount(baseMintInfo.value!.data, LAMPORTS_PER_SOL)
    const quoteAmount = this.decodeTokenAmount(quoteMintInfo.value!.data, TOKEN_DECIMALS)

    return quoteAmount.div(baseAmount)
  }

  /**
   * Decodes token amount from account data
   * @param data - Encoded account data tuple
   * @param decimals - Token decimals for conversion
   * @returns Decoded token amount as Decimal
   */
  private decodeTokenAmount(data: [string, string], decimals: number): Decimal {
    const [encodedData, encoding] = data
    const buffer = Buffer.from(encodedData, encoding as BufferEncoding)
    const amount = getTokenDecoder().decode(buffer).amount
    return new Decimal(amount.toString()).div(decimals)
  }

  /**
   * Formats price values for display, handling very small numbers with scientific notation
   * @param price - Price value to format
   * @returns Formatted price string
   */
  private formatPrice(price: Decimal): string {
    try {
      const exp = price.e

      if (exp > 0) {
        return price.toFixed(2)
      }

      if (exp < 0) {
        const exponent = Math.abs(exp) - 1
        const expString = price.exp().toString()
        const parts = expString.split('.')

        if (parts.length < 2 || !parts[1]) {
          return `0.0(${exponent})0000`
        }

        const decimalPart = parts[1].slice(exponent, exponent + 4)
        return `0.0(${exponent})${decimalPart}`
      }

      return price.toFixed(0)
    } catch {
      return price.toString()
    }
  }

  /**
   * Waits for the completion signal and returns the final result
   * @returns Promise resolving to command result when operation completes
   */
  private waitForCompletion(): Promise<void> {
    return new Promise<void>(resolve => {
      this.stop$.subscribe({
        complete: () => {
          resolve()
        },
      })
    })
  }

  private async startPoolMonitoring(
    poolKeys: PoolKeys,
    pumpswapClient: PumpswapClient,
    config: PumpswapLimitOrderConfig
  ): Promise<void> {
    const { poolBaseTokenAccount, poolQuoteTokenAccount } = poolKeys
    const { transactionManager, payer, provider } = this.context
    const tipStream$ = await provider.jito.tipStream()
    const stream$ = combineLatest([
      this.watchPool(poolBaseTokenAccount),
      this.watchPool(poolQuoteTokenAccount),
    ])

    let maxBase = 0n
    stream$
      .pipe(
        takeUntil(this.stop$),
        withLatestFrom(tipStream$),
        map(([[base, quote], tip]) => ({
          baseAmount: base.amount,
          quoteAmount: quote.amount,
          tip: Number(tip.landed_tips_99th_percentile.toFixed(9)),
        })),
        tap(({ baseAmount, tip }) => {
          if (baseAmount > maxBase) {
            maxBase = baseAmount
          }
          console.log('Thông tin pool:', {
            'Mục tiêu': formatUnits(config.target / BigInt(TOKEN_DECIMALS)),
            'Số tiền mua': Number(config.amount) / LAMPORTS_PER_SOL,
            'Token pool hiện tại': `${Decimal(baseAmount.toString())} | ${formatUnits(
              baseAmount / BigInt(TOKEN_DECIMALS)
            )}`,
            'Ví trả phí': payer.address,
            Tip: `${tip} SOL`,
            'Token pool cao nhất': `${Decimal(maxBase.toString())} | ${formatUnits(
              maxBase / BigInt(TOKEN_DECIMALS)
            )}`,
          })
        }),
        filter(({ baseAmount }) => baseAmount > 0 && baseAmount >= config.target)
      )
      .subscribe({
        next: async ({ baseAmount, quoteAmount, tip }) => {
          this.stop$.next(true)

          try {
            console.log('🎯 Đạt giá mục tiêu! Thực hiện giao dịch...')

            const { base, maxQuote } = computeBuyQuoteIn({
              quote: config.amount,
              baseReserve: baseAmount,
              quoteReserve: quoteAmount,
              coinCreator: poolKeys.coinCreator,
              slippage: config.slippage,
            })
            const buyInstructions = await pumpswapClient.createBuyInstructions(
              {
                maxAmountIn: maxQuote,
                amountOut: base,
                buyer: payer,
                poolKeys,
              },
              { hasBaseAta: false, hasQuoteAta: false }
            )

            const transaction = await transactionManager.buildSenderTransaction(
              buyInstructions,
              payer,
              {
                senderTip: Math.max(config.jitoTip, tip),
                priorityFeeLevel: config.priorityFeeLevel,
              }
            )
            const signature = await transactionManager.sendSenderTransaction(transaction)
            console.log(`📤 Giao dịch đã gửi: ${signature}`)
            const status = await transactionManager.confirmTransaction(signature as Signature, {
              maxRetries: CONFIRMATION_RETRIES,
              retryDelay: CONFIRMATION_RETRY_DELAY,
            })

            if (status.confirmed) {
              console.log(`✅ Giao dịch đã được xác nhận: ${signature}`)
              this.stop$.next(true)
              return
            }

            console.log('❌ Giao dịch thất bại sau tất cả các lần thử')
          } catch (error) {
            console.error('❌ Lỗi khi gửi giao dịch:', error)
          }
        },
        error: error => {
          console.error('❌ Lỗi khi theo dõi pool:', error)
        },
        complete: () => {
          console.log('✅ Hoàn thành theo dõi pool')
        },
      })
  }

  private watchPool(address: Address) {
    const { advanceSubscriptions } = this.context.provider
    return advanceSubscriptions.accountNotifications(address, {
      delay: POOL_WATCH_DELAY,
      initial: true,
      retry: Infinity,
    })
  }
}

PumpswapLimitOrderCommand.paths = [['pumpswap limit-order']]
