# @solana-kit-bot/core

Core package cho Solana Kit Bot - Hệ thống runner và quản lý giao dịch Solana
với hỗ trợ tiếng Việt.

## 📋 Mục lục

- [Tổng quan](#tổng-quan)
- [Cài đặt](#cài-đặt)
- [Kiến trúc](#kiến-trúc)
- [API Reference](#api-reference)
- [Ví dụ sử dụng](#ví-dụ-sử-dụng)
- [Strategies](#strategies)
- [Logger](#logger)
- [Transaction Manager](#transaction-manager)
- [Runners](#runners)
- [Đóng góp](#đóng-góp)

## 🔎 Tổng quan

Package `@solana-kit-bot/core` cung cấp framework cốt lõi cho việc phát triển
các bot trading trên Solana. Bao gồm:

- **Runner System**: Framework để thực hiện các tác vụ lặp đi lặp lại với các
  strategy khác nhau
- **Transaction Manager**: Quản lý và gửi transactions/bundles với hỗ trợ Jito
  MEV protection
- **Logging System**: Hệ thống log với hỗ trợ tiếng Việt và color-coding
- **Strategy System**: Các chiến lược về pricing, timing và execution
- **Type Definitions**: TypeScript types đầy đủ cho toàn bộ ecosystem

## 📦 Cài đặt

```bash
pnpm add @solana-kit-bot/core
```

## 🏗️ Kiến trúc

### Core Components

```
@solana-kit-bot/core
├── runners/           # Framework chạy các tác vụ lặp đi lặp lại
├── strategies/        # Các chiến lược execution, timing, pricing
├── transaction-manager # Quản lý giao dịch Solana và bundles
├── logger/           # Hệ thống logging với hỗ trợ tiếng Việt
├── types/            # TypeScript type definitions
└── utils/            # Utility functions
```

### Strategy Pattern

Core package sử dụng strategy pattern để cung cấp tính linh hoạt:

- **Execution Strategies**: Điều khiển khi nào dừng execution (time-based,
  count-based, hybrid)
- **Timing Strategies**: Điều khiển timing giữa các executions (fixed interval,
  exponential backoff, adaptive)
- **Price Strategies**: Tính toán giá (fixed, random, market-based, dynamic)

## 📚 API Reference

### Core Exports

```typescript
// Runners
export { BaseRunner, IterableRunner, IterationRunner } from './runner'

// Strategies
export {
  // Execution strategies
  CountBasedExecutionStrategy,
  TimeBasedExecutionStrategy,
  HybridExecutionStrategy,
  IterationExecutionStrategy,

  // Timing strategies
  FixedIntervalTiming,
  ExponentialBackoffTiming,
  AdaptiveTiming,
  ImmediateTiming,

  // Price strategies
  AbstractPriceStrategy,
  FixedPriceStrategy,
  RandomPriceStrategy,
  DynamicPriceStrategy,
} from './strategies'

// Transaction Management
export {
  createTransactionManager,
  JITO_TIP_ACCOUNTS,
} from './transaction-manager'

// Logging
export { createLogger } from './logger'

// Types
export * from './types'

// Utils
export { ceilDiv, floorDiv, wrapEscHandler } from './utils'
```

## 💡 Ví dụ sử dụng

### 1. Tạo một Simple Runner

```typescript
import {
  IterationRunner,
  createLogger,
  FixedPriceStrategy,
} from '@solana-kit-bot/core'
import type { SolanaBotContext, RunnerResult } from '@solana-kit-bot/core'

class MyTradingRunner extends IterationRunner {
  private logger = createLogger()

  async executeIteration(
    context: SolanaBotContext,
    iteration: number
  ): Promise<RunnerResult> {
    this.logger.trading(`Đang thực hiện giao dịch lần thứ ${iteration}`)

    try {
      // Thực hiện logic trading của bạn ở đây
      const result = await this.performTrade(context)

      this.logger.success(`Hoàn thành giao dịch lần ${iteration}`)
      return this.createSuccessResult(`Trade ${iteration} completed`)
    } catch (error) {
      this.logger.error(`Lỗi giao dịch lần ${iteration}: ${error}`)
      return this.createErrorResult(error as Error)
    }
  }

  private async performTrade(context: SolanaBotContext) {
    // Implementation trading logic
  }
}

// Sử dụng runner
const runner = new MyTradingRunner({
  interval: 5000, // 5 giây
  maxIterations: 10, // Tối đa 10 lần
  stopOnError: false, // Tiếp tục khi có lỗi
})

await runner.execute(context)
```

### 2. Sử dụng Transaction Manager

```typescript
import { createTransactionManager } from '@solana-kit-bot/core'
import { createProvider } from '@solana-kit-bot/provider'

// Tạo provider và transaction manager
const provider = createProvider({
  rpcUrl: 'https://api.mainnet-beta.solana.com',
})
const txManager = createTransactionManager(provider)

// Gửi transaction đơn giản
const transaction = await txManager.buildSimpleTransaction(
  instructions,
  feePayer
)
const signature = await txManager.sendSimpleTransaction(transaction)

// Gửi bundle với Jito tip
const bundles = [
  { instructions: buyInstructions, payer: wallet1, additionalSigner: [] },
  { instructions: sellInstructions, payer: wallet2, additionalSigner: [] },
]

const bundleTransactions = await txManager.buildBundle(bundles, 1000000n) // 0.001 SOL tip
const bundleId = await txManager.sendBundle(bundleTransactions)
```

### 3. Sử dụng Logger

```typescript
import { createLogger } from '@solana-kit-bot/core'

const logger = createLogger()

// Các log levels với emoji và màu sắc
logger.success('Giao dịch thành công!') // ✅ màu xanh lá
logger.error('Có lỗi xảy ra!') // ❌ màu đỏ
logger.warning('Cảnh báo thanh khoản thấp') // ⚠️ màu vàng
logger.trading('Đang thực hiện mua BTC') // 📈 màu tím
logger.system('Hệ thống đang khởi động...') // ⚙️ màu xanh dương
logger.info('Thông tin pool') // ℹ️ màu cyan
logger.debug('Debug data: %o', data) // 🐛 màu xám

// Timestamp tự động với timezone Việt Nam
// [25/12/2024 14:30:45] [SUCCESS] ✅ Giao dịch thành công!
```

## 🎯 Strategies

### Execution Strategies

Điều khiển khi nào dừng việc thực thi:

```typescript
import {
  CountBasedExecutionStrategy,
  TimeBasedExecutionStrategy,
  HybridExecutionStrategy,
} from '@solana-kit-bot/core'

// Dừng sau 10 lần thực hiện
const countStrategy = new CountBasedExecutionStrategy(10, true)

// Dừng sau 5 phút
const timeStrategy = new TimeBasedExecutionStrategy(5 * 60 * 1000, true)

// Dừng khi EITHER đạt 10 lần HOẶC 5 phút (mode: 'or')
const hybridStrategy = new HybridExecutionStrategy(
  5 * 60 * 1000, // 5 phút
  10, // 10 lần
  'or', // dừng khi một trong hai điều kiện thỏa mãn
  true // dừng khi có lỗi
)
```

### Timing Strategies

Điều khiển thời gian giữa các lần thực thi:

```typescript
import {
  FixedIntervalTiming,
  ExponentialBackoffTiming,
  AdaptiveTiming,
} from '@solana-kit-bot/core'

// Khoảng cách cố định 3 giây
const fixedTiming = new FixedIntervalTiming(3000)

// Exponential backoff: bắt đầu 1s, tăng gấp đôi, tối đa 30s
const backoffTiming = new ExponentialBackoffTiming(1000, 2, 30000)

// Adaptive timing dựa trên success rate
const adaptiveTiming = new AdaptiveTiming(2000, 10000, 0.8)
```

### Price Strategies

Tính toán giá giao dịch:

```typescript
import {
  FixedPriceStrategy,
  RandomPriceStrategy,
  DynamicPriceStrategy,
} from '@solana-kit-bot/core'

// Giá cố định
const fixedPrice = new FixedPriceStrategy(0.01) // 0.01 SOL

// Giá ngẫu nhiên trong khoảng
const randomPrice = new RandomPriceStrategy({
  minPrice: 0.005,
  maxPrice: 0.02,
  precision: 6,
})

// Giá động dựa trên market conditions
const dynamicPrice = new DynamicPriceStrategy({
  basePrice: 0.01,
  volatilityFactor: 0.1,
  trendSensitivity: 0.05,
})

// Sử dụng price strategy
const context = {
  iteration: 1,
  timestamp: Date.now(),
  metadata: { walletIndex: 0 },
}

const priceResult = await randomPrice.calculatePrice(context)
console.log(`Giá tính toán: ${priceResult.price} SOL`)
```

## 🔧 Transaction Manager

### Tính năng chính

- **Simple Transactions**: Giao dịch Solana thông thường
- **Bundle Support**: Gửi nhiều giao dịch cùng lúc với Jito
- **MEV Protection**: Tự động tip cho Jito validators
- **Error Handling**: Xử lý lỗi chi tiết với message tiếng Việt
- **Type Safety**: Full TypeScript support

### Jito Bundle Example

```typescript
import {
  createTransactionManager,
  JITO_TIP_ACCOUNTS,
} from '@solana-kit-bot/core'

// Các tip accounts được random select tự động
console.log('Các Jito tip accounts:', JITO_TIP_ACCOUNTS)

const bundles = [
  {
    instructions: [buyInstruction1, buyInstruction2],
    payer: wallet1,
    additionalSigner: [wallet1],
  },
  {
    instructions: [sellInstruction1],
    payer: wallet2,
    additionalSigner: [],
  },
]

// Tự động thêm tip vào transaction đầu tiên
const tip = 1000000n // 0.001 SOL
const bundleTransactions = await txManager.buildBundle(bundles, tip)
const bundleId = await txManager.sendBundle(bundleTransactions)

logger.success(`Bundle sent with ID: ${bundleId}`)
```

## 🏃‍♂️ Runners

### BaseRunner

Abstract base class cho tất cả runners:

```typescript
import { BaseRunner } from '@solana-kit-bot/core'

class MyRunner extends BaseRunner {
  async execute(context: SolanaBotContext): Promise<RunnerResult> {
    // Implementation
  }
}
```

### IterableRunner

Cho các tác vụ cần lặp đi lặp lại với strategy:

```typescript
import {
  IterableRunner,
  CountBasedExecutionStrategy,
  FixedIntervalTiming,
} from '@solana-kit-bot/core'

class MyIterableRunner extends IterableRunner {
  constructor() {
    super(
      {
        /* config */
      },
      new CountBasedExecutionStrategy(10, false),
      new FixedIntervalTiming(5000)
    )
  }

  async executeIteration(
    context: SolanaBotContext,
    iteration: number
  ): Promise<RunnerResult> {
    // Implementation cho mỗi iteration
  }
}
```

### IterationRunner

High-level runner với configuration đơn giản:

```typescript
import { IterationRunner } from '@solana-kit-bot/core'

class MyTradingRunner extends IterationRunner {
  constructor() {
    super({
      interval: 5000, // 5 giây giữa các iteration
      maxIterations: 0, // 0 = vô hạn
      stopOnError: false, // Tiếp tục khi có lỗi
      gracefulShutdown: true, // Xử lý SIGINT/SIGTERM
    })
  }

  async executeIteration(
    context: SolanaBotContext,
    iteration: number
  ): Promise<RunnerResult> {
    // Trading logic
  }
}
```

## 🛠️ Utils

### Math Utilities

```typescript
import { ceilDiv, floorDiv } from '@solana-kit-bot/core'

// BigInt division with ceiling
const result1 = ceilDiv(100n, 30n) // 4n

// BigInt division with floor
const result2 = floorDiv(100n, 30n) // 3n
```

### Prompt Utilities

```typescript
import inquirer from 'inquirer'
import { wrapEscHandler } from '@solana-kit-bot/core'

// Wrap inquirer prompts với ESC handler
const answers = await wrapEscHandler(
  inquirer.prompt([
    {
      type: 'input',
      name: 'poolAddress',
      message: 'Nhập địa chỉ pool:',
    },
  ])
)
```

## 📁 Cấu trúc Project

```
packages/core/
├── src/
│   ├── runner/
│   │   ├── abstract/
│   │   │   ├── base.ts              # BaseRunner abstract class
│   │   │   ├── iterable-runner.ts   # IterableRunner cho repeated tasks
│   │   │   └── index.ts
│   │   ├── iteration-runner.ts      # High-level IterationRunner
│   │   └── index.ts
│   ├── strategies/
│   │   ├── execution/               # Execution control strategies
│   │   ├── timing/                  # Timing control strategies
│   │   ├── pricing/                 # Price calculation strategies
│   │   └── index.ts
│   ├── types/                       # TypeScript definitions
│   ├── utils/                       # Utility functions
│   ├── transaction-manager.ts       # Solana transaction management
│   ├── logger.ts                    # Enhanced logging system
│   └── index.ts                     # Main exports
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

## 🤝 Đóng góp

1. Fork repository
2. Tạo feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

ISC License - xem file [LICENSE](../../LICENSE) để biết thêm chi tiết.

## 🔗 Links

- [Solana Documentation](https://docs.solana.com/)
- [Jito Documentation](https://jito.gitbook.io/mev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)

---

Built with ❤️ by Yuuta - To Hoang Tuan
