import type { Provider } from '@solana-kit-bot/provider'
import type { TransactionSigner } from '@solana/kit'

import type { Logger } from '~/logger'
import type { TransactionManager } from './transaction'
/**
 * Core configuration interface for Solana bot operations
 */
export interface SolanaBotConfig {
  /** RPC endpoint URL for Solana network connection */
  rpc: string

  /** WebSocket endpoint URL for real-time data subscriptions */
  wsUrl: string

  /** Private key for the main wallet (base58 encoded) */
  privateKey: string
}

/**
 * Primary execution context for all Solana bot operations
 *
 * This context object serves as the dependency injection container and is passed
 * through all runner executions.
 *
 * @template TConfig - Custom configuration type extending SolanaBotConfig
 *
 * @example
 * ```typescript
 * const context: SolanaBotContext = {
 *   payer: mainWallet,
 *   provider: solanaProvider,
 *   transactionManager: txManager,
 *   config: {
 *     rpcUrl: 'https://api.mainnet-beta.solana.com',
 *   }
 * }
 *
 * await runner.execute(context)
 * ```
 */
export interface SolanaBotContext<TConfig extends SolanaBotConfig = SolanaBotConfig> {
  /** Primary transaction signer for paying fees and signing transactions */
  payer: TransactionSigner<string>

  /** Provider instance managing RPC, WebSocket, and specialized API connections */
  provider: Provider

  /** Transaction manager for building and sending various transaction types */
  transactionManager: TransactionManager

  /** Bot configuration and operational parameters */
  config: TConfig

  logger: Logger
}
