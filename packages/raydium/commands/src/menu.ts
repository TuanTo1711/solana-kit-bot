import chalk from 'chalk'

import { RaydiumCpmmFastPumpCommand } from '@solana-kit-bot/raydium-cpmm-fast-pump'
import { PoolCheckerCommand } from '@solana-kit-bot/raydium-launchlab-pool-checker'
import { VirtualTradingCommand } from '@solana-kit-bot/raydium-launchlab-virtual-trading'

export const menu = [
  {
    name: `Mua với nhiều ví ảo ${chalk.gray('- Virtual Trading')}`,
    value: VirtualTradingCommand.paths,
  },
  {
    name: `Lọc và mua khi pool đạt yêu cầu ${chalk.gray('- Pool Checker')}`,
    value: PoolCheckerCommand,
  },
  {
    name: `Mua bơm nhanh ${chalk.gray('- Fast Pump')}`,
    value: RaydiumCpmmFastPumpCommand,
  },
]
