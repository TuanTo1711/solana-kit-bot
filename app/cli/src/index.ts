import { createKeyPairSignerFromBytes, getBase58Codec } from '@solana/kit'
import { Builtins, Cli } from 'clipanion'
import Conf from 'conf'

import {
  createTransactionManager,
  type SolanaBotConfig,
  type SolanaBotContext,
} from '@solana-kit-bot/core'
import { createProvider, SENDER_ENPOINTS, type Provider } from '@solana-kit-bot/provider'
import { VirtualTradingCommand as PumpswapVirtualTradingCommand } from '@solana-kit-bot/pumpswap-virtual-trading'
import { PoolCheckerCommand } from '@solana-kit-bot/raydium-launchlab-pool-checker'
import { VirtualTradingCommand } from '@solana-kit-bot/raydium-launchlab-virtual-trading'
import { PumpswapPoolCheckerCommand } from '@solana-kit-bot/pumpswap-pool-checker'
import { PumpswapLimitOrderCommand } from '@solana-kit-bot/pumpswap-limit-order'
import { PumpfunSniperBumpCommand } from '@solana-kit-bot/pumpfun-sniper-bump'

import { ConfigCommand } from './commands/config'
import { PumpswapCommand } from './commands/pumpswap'
import { RaydiumLaunchlabCommand } from './commands/raydium-launchlab'
import { RunCommand } from './commands/run'

class Application {
  private cli: Cli

  constructor() {
    this.cli = new Cli({
      binaryLabel: 'Solana Bot CLI',
      binaryName: `solana-bot-kit`,
      binaryVersion: '1.0.0',
      enableColors: true,
      enableCapture: true,
    })
  }

  public async run() {
    const [_, __, ...args] = process.argv
    const config = new Conf<SolanaBotConfig>({
      projectName: '.solana-bot-cli',
      configName: 'config',
    }).store

    this.cli.register(RunCommand)
    this.cli.register(ConfigCommand)
    this.cli.register(Builtins.HelpCommand)

    if (!config || !config.rpc || !config.wsUrl || !config.privateKey) {
      await this.cli.runExit(args)
      return
    }

    const rpcUrl = config.rpc
    const apiKey = rpcUrl.includes('=') ? rpcUrl.substring(rpcUrl.indexOf('=') + 1) : ''

    const provider: Provider = createProvider({
      apiKey,
      commitment: 'confirmed',
      senderUrl: SENDER_ENPOINTS['Singapore'],
    })
    const transactionManager = createTransactionManager(provider)
    const payer = await createKeyPairSignerFromBytes(getBase58Codec().encode(config.privateKey))
    const context: SolanaBotContext = {
      config,
      provider,
      transactionManager,
      payer,
    }

    this.cli.register(PumpswapCommand)
    this.cli.register(PumpswapVirtualTradingCommand)
    this.cli.register(PumpswapLimitOrderCommand)
    this.cli.register(PumpfunSniperBumpCommand)

    this.cli.register(VirtualTradingCommand)
    this.cli.register(PoolCheckerCommand)

    this.cli.register(RaydiumLaunchlabCommand)
    this.cli.register(PumpswapPoolCheckerCommand)

    await this.cli.runExit(args, context)
  }
}

export const app = new Application()
app.run()
