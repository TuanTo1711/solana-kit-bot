/**
 * @fileoverview Type definitions for virtual trading operations
 */

import type { TransactionSigner } from '@solana/kit'
import type { Bundle } from '@solana-kit-bot/core'

/**
 * Information about a signer's trade within a trading iteration
 */
export interface SignerTradeInfo {
  /** The transaction signer/wallet */
  signer: TransactionSigner
  /** Amount of tokens received from the buy transaction */
  amountOut: bigint
  /** Price paid for the transaction */
  price: number
}

/**
 * Complete information about an active trade
 */
export interface ActiveTrade {
  /** Map of signer address to their trade information */
  signerTrades: Map<string, SignerTradeInfo>
  /** Optional timeout ID for the scheduled sell transaction */
  sellTimeoutId?: NodeJS.Timeout
  /** The funding bundle used for this trade */
  fundingBundle: Bundle
}

/**
 * Result of executing a buy phase
 */
export interface BuyPhaseResult {
  /** Unique identifier for this trade */
  tradeId: string
  /** Map of signer addresses to their trade information */
  signerTrades: Map<string, SignerTradeInfo>
  /** The funding bundle used for this trade */
  fundingBundle: Bundle
}
