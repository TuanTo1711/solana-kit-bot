/**
 * @fileoverview Context types and configuration for Solana Bot operations
 *
 * This module defines the core context types that carry execution state,
 * configuration, and dependencies throughout the Solana bot system.
 */

import type { Provider } from '@solana-kit-bot/provider'
import type { TransactionSigner } from '@solana/kit'
import type { TransactionManager } from './transaction'

/**
 * Core configuration interface for Solana bot operations
 *
 * Contains essential settings and parameters that control bot behavior,
 * risk management, and operational limits.
 */
export interface SolanaBotConfig {
  /** RPC endpoint URL for Solana network connection */
  rpc: string

  /** WebSocket endpoint URL for real-time data subscriptions */
  wsUrl: string

  /** Private key for the main wallet (base58 encoded) */
  privateKey: string

  /** Database URL for storing bot data */
  dbUrl?: string
}

/**
 * Primary execution context for all Solana bot operations
 *
 * This context object is passed through all runner executions and contains
 * the essential dependencies and configuration needed for bot operations.
 * It serves as the primary dependency injection container for the system.
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
  /**
   * Primary transaction signer for paying fees and signing transactions
   *
   * This wallet is responsible for transaction fees and serves as the
   * default signer for operations that don't specify a custom signer.
   */
  payer: TransactionSigner<string>

  /**
   * Provider instance managing RPC, WebSocket, and specialized API connections
   *
   * Provides access to Solana RPC methods, Jito bundle submission,
   * priority fee APIs, and other network services.
   */
  provider: Provider

  /**
   * Transaction manager for building and sending various transaction types
   *
   * Handles the construction, signing, and submission of simple transactions,
   * bundles, and specialized transaction types with proper error handling.
   */
  transactionManager: TransactionManager

  /**
   * Bot configuration and operational parameters
   *
   * Contains network settings, timeouts, retry policies, and other
   * configuration that controls bot behavior and risk management.
   */
  config: TConfig
}
