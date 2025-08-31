import { Command, Option, type BaseContext } from 'clipanion'
import chalk from 'chalk'

import {
  createLogger,
  FixedPriceStrategy,
  RandomPriceStrategy,
  wrapEscHandler,
  type PriceStrategy,
  type SolanaBotContext,
} from '@solana-kit-bot/core'
import { createPumpswapClient } from '@solana-kit-bot/pumpswap'
import {
  DEFAULT_TIP_SOL,
  LAMPORTS_PER_SOL,
  MAX_VIRTUAL_WALLETS,
  MIN_VIRTUAL_WALLETS,
} from './constants'
import { virtualTradingOptionsSchema, type VirtualTradingOptions } from './validation'
import { VirtualWalletTradingExecutor } from './executor'

export class VirtualTradingCommand extends Command<BaseContext & SolanaBotContext> {
  pool = Option.String('-p,--pool', { description: 'Địa chỉ pool để chạy lệnh', required: false })
  wallets = Option.String('-w,--wallets', {
    description: 'Số lượng ví muốn dùng',
    required: false,
  })
  tip = Option.String('-t,--tip', { description: 'Số tiền tip cho Jito', required: false })
  loops = Option.String('-l,--loops', {
    description: 'Số chu kỳ chạy (0 -> vô hạn, >0 -> số lần nhất định)',
    required: false,
  })
  interval = Option.String('-i,--interval', {
    description: 'Khoảng thời gian chạy lệnh (giây)',
    required: false,
  })
  strategy = Option.String('-s,--strategy', {
    description: 'Chiến lược định giá (fixed/random)',
    required: false,
  })
  amount? = Option.String('-a,--amount', {
    description: 'Số tiền sử dụng (strategy = fixed)',
    required: false,
  })
  min? = Option.String('-min,--min', {
    description: 'Số tiền tối thiểu sử dụng (strategy = random)',
    required: false,
  })
  max? = Option.String('-max,--max', {
    description: 'Số tiền tối đa sử dụng (strategy = random)',
    required: false,
  })

  private logger = createLogger(VirtualTradingCommand.name)

  override async execute(): Promise<number | void> {
    const options = {
      pool: this.pool,
      wallets: this.wallets,
      tip: this.tip,
      loops: this.loops,
      interval: this.interval,
      strategy: this.strategy,
      amount: this.amount,
      min: this.min,
      max: this.max,
    }

    const inquirer = await import('inquirer')
    const prompt = inquirer.createPromptModule({
      input: process.stdin,
      output: process.stdout,
    })

    const questions = prompt<VirtualTradingOptions>(
      [
        {
          type: 'input',
          name: 'pool',
          message: 'Địa chỉ pool: ',
          required: true,
          transformer: (value: string) => value.trim(),
          validate: (value: string) =>
            value.length === 0 ? 'Địa chỉ pool không được để trống' : true,
        },
        {
          type: 'number',
          name: 'wallets',
          message: 'Số lượng ví muốn dùng: ',
          required: true,
          min: MIN_VIRTUAL_WALLETS,
          max: MAX_VIRTUAL_WALLETS,
          validate: (value: number | undefined) =>
            !value || isNaN(value)
              ? `Số lượng ví phải từ ${MIN_VIRTUAL_WALLETS} đến ${MAX_VIRTUAL_WALLETS}`
              : true,
        },
        {
          type: 'list',
          name: 'strategy',
          message: 'Chọn chiến lược định giá: ',
          choices: [
            { name: 'Định giá cố định', value: 'fixed' },
            { name: 'Định giá ngẫu nhiên', value: 'random' },
          ],
          default: 'random',
        },
        {
          type: 'input',
          name: 'amount',
          message: 'Nhập số tiền sử dụng: ',
          required: false,
          when: (answers: Partial<VirtualTradingOptions>) => answers.strategy === 'fixed',
          validate: (value: string) =>
            isNaN(parseFloat(value)) || parseFloat(value) <= 0
              ? 'Số tiền sử dụng phải lớn hơn 0'
              : true,
        },
        {
          type: 'input',
          name: 'min',
          message: 'Nhập giá tối thiểu: ',
          required: false,
          when: (answers: Partial<VirtualTradingOptions>) => answers.strategy === 'random',
          validate: (value: string) =>
            isNaN(parseFloat(value)) || parseFloat(value) <= 0
              ? 'Giá tối thiểu phải lớn hơn 0'
              : true,
        },
        {
          type: 'input',
          name: 'max',
          message: 'Nhập giá tối đa: ',
          required: false,
          when: (answers: Partial<VirtualTradingOptions>) => answers.strategy === 'random',
          validate: (value: string) =>
            isNaN(parseFloat(value)) || parseFloat(value) <= 0 ? 'Giá tối đa phải lớn hơn 0' : true,
        },
        {
          type: 'input',
          name: 'tip',
          message: 'Số tiền tip cho Jito: ',
          required: true,
          default: DEFAULT_TIP_SOL.toString(),
          transformer: (value: string) => value.trim(),
          validate: (value: string) =>
            value.length === 0 ? 'Số tiền tip không được để trống' : true,
        },
        {
          type: 'number',
          name: 'loops',
          message: 'Số chu kỳ chạy: ',
          min: 0,
          required: true,
          validate: (value: number | undefined) =>
            isNaN(value!) || value! < 0 ? 'Số chu kỳ phải lớn hơn hoặc bằng 0' : true,
        },
        {
          type: 'input',
          name: 'interval',
          message: 'Khoảng thời gian giữa các chu kỳ (giây): ',
          required: true,
          validate: (value: string) =>
            isNaN(parseFloat(value)) || parseFloat(value) < 0
              ? 'Khoảng thời gian phải lớn hơn 0'
              : true,
        },
        {
          type: 'input',
          name: 'timeout',
          message: 'Khoảng thời gian chờ để bán (giây): ',
          required: true,
          validate: (value: string) =>
            isNaN(parseFloat(value)) || parseFloat(value) < 0
              ? 'Khoảng thời gian phải lớn hơn 0'
              : true,
        },
      ],
      options
    )

    const answers = await wrapEscHandler<typeof questions>(questions)
    const { data, success, error } = virtualTradingOptionsSchema.safeParse(answers)
    if (!success) {
      this.context.stderr.write(error)
      return
    }

    this.printPrettyConfig(data)

    const priceStrategy = this.initializePricingStrategy(data)

    if (!priceStrategy) {
      this.context.stderr.write('Chiến lược định giá không hợp lệ')
      return
    }

    const { confirmed } = await prompt<{ confirmed: boolean }>({
      type: 'confirm',
      name: 'confirmed',
      message: 'Bạn có chắc chắn muốn chạy lệnh này không?',
      default: true,
    })

    if (!confirmed) {
      this.context.stderr.write('Đã hủy thực thi lệnh')
      return
    }

    const client = createPumpswapClient(this.context.provider.rpc)
    const executor = new VirtualWalletTradingExecutor(this.context, data, priceStrategy, client)
    try {
      await executor.setup()
      const result = await executor.execute(this.context)

      this.logger.info(result.data ?? 'Chạy lệnh thành công')
    } catch (error) {
      this.context.stderr.write('Lỗi khi chạy virtual trading: ')

      throw error
    }
  }

  /**
   * In ra màn hình bản tóm tắt cấu hình đã định dạng
   *
   * Hiển thị tất cả các tham số đã cấu hình theo định dạng dễ đọc,
   * với màu sắc để dễ nhìn hơn.
   *
   * @private
   * @param {VirtualTradingOptions} parsedConfig - Các tùy chọn cấu hình đã xác thực
   */
  private printPrettyConfig = (parsedConfig: VirtualTradingOptions) => {
    console.log('Chi tiết cấu hình lệnh:')
    console.log(`   - Địa chỉ pool                        | ${chalk.blue(parsedConfig.pool)}`)
    console.log(
      `   - Số lượng ví                         | ${chalk.green(parsedConfig.wallets)} ví`
    )
    console.log(
      `   - Số tiền tip                         | ${chalk.green(Number(parsedConfig.tip) / LAMPORTS_PER_SOL)} SOL`
    )
    console.log(
      `   - Số chu kỳ chạy                      | ${chalk.green(parsedConfig.loops === 0 ? 'Vô hạn' : parsedConfig.loops)} lần`
    )
    console.log(
      `   - Khoảng thời gian chờ để bán         | ${chalk.green(parsedConfig.timeout / 1000)} giây`
    )

    console.log(
      `   - Khoảng thời gian giữa các chu kỳ    | ${chalk.green(parsedConfig.interval / 1000)} giây`
    )
    console.log(
      `   - Chiến lược định giá                 | ${chalk.green(parsedConfig.strategy === 'fixed' ? 'Cố định' : 'Ngẫu nhiên')}`
    )
    if (parsedConfig.strategy === 'fixed') {
      console.log(
        `   - Số tiền sử dụng                     | ${chalk.green(Number(parsedConfig.amount) / LAMPORTS_PER_SOL)} SOL`
      )
    } else {
      console.log(
        `   - Giá tối thiểu                       | ${chalk.green(Number(parsedConfig.min) / LAMPORTS_PER_SOL)} SOL`
      )
      console.log(
        `   - Giá tối đa                          | ${chalk.green(Number(parsedConfig.max) / LAMPORTS_PER_SOL)} SOL`
      )
    }
  }

  /**
   * Khởi tạo và cấu hình chiến lược định giá dựa trên tùy chọn người dùng
   *
   * Tạo và cấu hình phiên bản chiến lược định giá phù hợp dựa trên
   * lựa chọn của người dùng. Hỗ trợ hai chiến lược:
   * 1. Chiến lược Giá Cố định:
   *    - Sử dụng một số tiền không đổi cho tất cả các lần mua
   *    - Được cấu hình với một tham số số tiền duy nhất
   * 2. Chiến lược Giá Ngẫu nhiên:
   *    - Tạo số tiền ngẫu nhiên trong một khoảng xác định
   *    - Được cấu hình với các tham số giá tối thiểu/tối đa
   *
   * @private
   * @param {VirtualTradingOptions} config - Các tùy chọn cấu hình đã xác thực
   * @returns {PriceStrategy | null} Phiên bản chiến lược định giá đã khởi tạo, hoặc null nếu xác thực thất bại
   * @throws {Error} Nếu cấu hình chiến lược không hợp lệ
   */
  private initializePricingStrategy = (config: VirtualTradingOptions): PriceStrategy | null => {
    switch (config.strategy) {
      case 'fixed': {
        if (!config.amount) {
          return null
        }

        const fixedStrategy = new FixedPriceStrategy({
          fixedPrice: Number(config.amount),
          precision: 0,
        })

        return fixedStrategy
      }

      case 'random': {
        if (!config.min || !config.max) {
          return null
        }
        const randomStrategy = new RandomPriceStrategy({
          minPrice: Number(config.min),
          maxPrice: Number(config.max),
          precision: 0,
        })
        return randomStrategy
      }

      default:
        return null
    }
  }
}

VirtualTradingCommand.paths = [['pumpswap virtual-trading'], ['pumpswap v-trading']]

VirtualTradingCommand.usage = VirtualTradingCommand.usage = Command.Usage({
  category: `Raydium Launchlab`,
  description: `Thực hiện mua và bán với nhiều ví ảo`,
  details: `
  Hệ thống giao dịch ảo tinh vi cho các pool Raydium Concentrated Liquidity Market Maker (CPMM) thực hiện các gói giao dịch tần suất cao sử dụng nhiều ví ảo.

  ✨ Tính năng:

  - ${chalk.green('Quản lý Ví Ảo')}: Tạo và quản lý nhiều ví tạm thời cho giao dịch
  - ${chalk.green('Chiến lược Mua-Rồi-Bán')}: Thực hiện giao dịch mua và giao dịch bán tự động sau thời gian chờ có thể cấu hình
  - ${chalk.green('Chiến lược Định giá Linh hoạt')}: Hỗ trợ định giá cố định và ngẫu nhiên tùy chỉnh
  - ${chalk.green('Tối ưu hóa Bundle')}: Sử dụng Jito bundles cho việc gửi gói giao dịch
  - ${chalk.green('Dọn dẹp Tự động')}: Xử lý tài trợ ví, hoàn tiền và dọn dẹp tài nguyên tự động
  `,
  examples: [
    [
      `- Ví dụ chạy vô hạn với số lượng mua giới hạn`,
      `$0 virtual-trading -p ... 
                          -w 4 -t 0.00001
                          ${chalk.green('-s fixed')} -amount 0.000001
                          ${chalk.green('-l 0')} -interval 1`,
    ],
    [
      `- Ví dụ chạy 10 lần với số lượng mua ngẫu nhiên`,
      `$0 virtual-trading -p ...
                          -w 4 -t 0.00001
                          ${chalk.green('-l 10')} -i 1 
                          ${chalk.green('-s random')} -min 0.000001 -max 0.000001`,
    ],
  ],
})
