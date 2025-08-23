/**
 * @fileoverview Transaction types and interfaces for Solana operations
 *
 * This module defines the core transaction types and interfaces used throughout
 * the Solana bot system for handling various transaction operations, bundles,
 * and transaction management.
 */

import type { PriorityLevel } from '@solana-kit-bot/provider'
import type {
  Base64EncodedWireTransaction,
  Instruction,
  Signature,
  Slot,
  TransactionSigner,
} from '@solana/kit'

/**
 * Bundle configuration for grouping multiple transactions
 *
 * Represents a group of instructions that should be executed together,
 * typically used for atomic operations or MEV protection via Jito.
 */
export interface Bundle {
  /** Array of Solana instructions to include in this transaction */
  instructions: Instruction[]

  /** Primary signer responsible for transaction fees */
  payer: TransactionSigner<string>

  /** Additional signers required for the instructions */
  additionalSigner: TransactionSigner[]
}

/**
 * Options for retrying bundle sending with status monitoring
 *
 * Configuration options for the retry mechanism when sending bundles,
 * providing control over retry attempts, delays, and status checking behavior.
 */
export interface RetryBundleOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number

  /** Delay between retry attempts in milliseconds (default: 2000) */
  retryDelay?: number

  /** Timeout for status checking in milliseconds (default: 30000) */
  statusCheckTimeout?: number

  /** Interval for checking bundle status in milliseconds (default: 1000) */
  statusCheckInterval?: number
}

/**
 * Result of bundle status check operation
 */
export interface BundleStatusResult {
  /** Whether the bundle landed successfully */
  landed: boolean

  /** Whether the bundle failed */
  failed: boolean

  /** Whether the bundle is still pending */
  pending: boolean

  /** Raw bundle status response */
  status?: any

  /** Error information if any */
  error?: Error
}

/**
 * Options for building sender transactions
 *
 * Configuration options specific to sender-based transaction building,
 * providing control over gas estimation, priority fees, and confirmation.
 */
export interface BuildSenderOptions {
  /** Unit Limit in lamports to expedite transaction processing */
  unitLimit?: number

  /** Unit Price in lamports per unit to expedite transaction processing */
  unitPrice?: number

  priorityFeeLevel: PriorityLevel | 'recommended'

  /** Jito tip amount in lamports for MEV protection and faster inclusion */
  senderTip?: number

  /** Additional signers to include in the transaction */
  additionalSigners?: TransactionSigner[]
}

/**
 * Comprehensive transaction manager interface
 *
 * Provides methods for building and sending various types of Solana transactions,
 * including simple transactions, bundles, and specialized transaction types.
 */
export interface TransactionManager {
  /**
   * Builds a simple Solana transaction with the provided instructions
   *
   * Creates a standard transaction containing the specified instructions,
   * properly signed and ready for submission to the network.
   *
   * @param instructions - Array of instructions to include
   * @param feePayer - Wallet responsible for transaction fees
   * @param minContextSlot - Optional minimum context slot for blockhash
   * @returns Promise resolving to base64-encoded wire transaction
   *
   * @example
   * ```typescript
   * const instructions = [
   *   getTransferSolInstruction({
   *     source: wallet1,
   *     destination: wallet2.address,
   *     amount: 1000000n
   *   })
   * ]
   *
   * const transaction = await txManager.buildSimpleTransaction(
   *   instructions,
   *   wallet1
   * )
   * ```
   */
  buildSimpleTransaction(
    instructions: Instruction[],
    feePayer: TransactionSigner,
    minContextSlot?: Slot,
    additionalSigners?: TransactionSigner[]
  ): Promise<Base64EncodedWireTransaction>

  /**
   * Builds a transaction using the sender API
   *
   * Creates a transaction optimized for sender-based submission with
   * enhanced options for gas management and priority handling.
   *
   * @param instructions - Array of instructions to include
   * @param feePayer - Wallet responsible for transaction fees
   * @param options - Sender-specific build options
   * @returns Promise resolving to base64-encoded wire transaction
   *
   * @example
   * ```typescript
   * const transaction = await txManager.buildSenderTransaction(
   *   instructions,
   *   wallet,
   *   {
   *     skipPreflight: false,
   *     priorityFee: 10000n,
   *     gasLimit: 200000n
   *   }
   * )
   * ```
   */
  buildSenderTransaction(
    instructions: Instruction[],
    feePayer: TransactionSigner,
    options: BuildSenderOptions
  ): Promise<Base64EncodedWireTransaction>

  /**
   * Builds a bundle of transactions with Jito tip for MEV protection
   *
   * Creates multiple transactions in a bundle format, automatically adding
   * a tip payment to the first transaction for Jito validator prioritization.
   *
   * @param bundles - Array of bundle configurations
   * @param tip - Tip amount in lamports for Jito validators
   * @returns Promise resolving to array of base64-encoded wire transactions
   *
   * @example
   * ```typescript
   * const bundles = [
   *   {
   *     instructions: [buyInstruction],
   *     payer: wallet1,
   *     additionalSigner: []
   *   },
   *   {
   *     instructions: [sellInstruction],
   *     payer: wallet2,
   *     additionalSigner: [wallet2]
   *   }
   * ]
   *
   * const bundleTransactions = await txManager.buildBundle(
   *   bundles,
   *   1000000n // 0.001 SOL tip
   * )
   * ```
   */
  buildBundle(bundles: Bundle[], tip: bigint): Promise<Base64EncodedWireTransaction[]>

  /**
   * Sends a simple transaction to the Solana network
   *
   * Submits a pre-built transaction to the network using standard RPC methods.
   * Provides basic confirmation and error handling.
   *
   * @param transaction - Base64-encoded wire transaction to send
   * @returns Promise resolving to transaction signature
   *
   * @example
   * ```typescript
   * const signature = await txManager.sendSimpleTransaction(transaction)
   * console.log('Transaction sent:', signature)
   *
   * // Wait for confirmation
   * await provider.rpc.confirmTransaction(signature).send()
   * ```
   */
  sendSimpleTransaction(transaction: Base64EncodedWireTransaction): Promise<string>

  /**
   * Sends a transaction using the sender API
   *
   * Submits a transaction using enhanced sender capabilities, typically
   * providing better reliability and priority handling than standard RPC.
   *
   * @param transaction - Base64-encoded wire transaction to send
   * @returns Promise resolving to transaction signature
   *
   * @example
   * ```typescript
   * const signature = await txManager.sendSenderTransaction(transaction)
   * console.log('Priority transaction sent:', signature)
   * ```
   */
  sendSenderTransaction(transaction: Base64EncodedWireTransaction): Promise<string>

  /**
   * Sends a bundle of transactions using Jito
   *
   * Submits multiple transactions as an atomic bundle via Jito's MEV protection
   * network. All transactions in the bundle are executed together or not at all.
   *
   * @param bundles - Array of base64-encoded wire transactions
   * @returns Promise resolving to bundle ID
   *
   * @throws Error if bundle submission fails or is rejected
   *
   * @example
   * ```typescript
   * try {
   *   const bundleId = await txManager.sendBundle(bundleTransactions)
   *   console.log('Bundle submitted:', bundleId)
   *
   *   // Monitor bundle status
   *   const status = await jito.getBundleStatus(bundleId)
   *   console.log('Bundle status:', status)
   * } catch (error) {
   *   console.error('Bundle failed:', error.message)
   * }
   * ```
   */
  sendBundle(bundles: Base64EncodedWireTransaction[]): Promise<string>

  /**
   * Sends a bundle with retry mechanism and status monitoring
   *
   * Enhanced bundle sending that automatically retries failed submissions and
   * monitors bundle status through Jito's getBundleStatuses API. Provides
   * configurable retry logic and comprehensive status tracking.
   *
   * @param bundles - Array of base64-encoded wire transactions
   * @param options - Retry configuration options
   * @returns Promise resolving to bundle ID
   *
   * @throws Error if all retry attempts fail or bundle definitively fails
   *
   * @example
   * ```typescript
   * try {
   *   const bundleId = await txManager.sendBundleWithRetry(
   *     bundleTransactions,
   *     {
   *       maxRetries: 5,
   *       retryDelay: 3000,
   *       statusCheckTimeout: 45000
   *     }
   *   )
   *   console.log('Bundle successfully submitted and monitored:', bundleId)
   * } catch (error) {
   *   console.error('Bundle definitively failed:', error.message)
   * }
   * ```
   */
  sendBundleWithRetry(
    bundles: Base64EncodedWireTransaction[],
    options?: RetryBundleOptions
  ): Promise<string>

  /**
   * Checks the status of a bundle using Jito's getBundleStatuses API
   *
   * Queries bundle status and returns processed information about whether
   * the bundle has landed, failed, or is still pending.
   *
   * @param bundleId - Bundle identifier to check
   * @returns Promise resolving to bundle status result
   *
   * @example
   * ```typescript
   * const statusResult = await txManager.checkBundleStatus(bundleId)
   * if (statusResult.landed) {
   *   console.log('Bundle successfully landed!')
   * } else if (statusResult.failed) {
   *   console.log('Bundle failed permanently')
   * } else if (statusResult.pending) {
   *   console.log('Bundle still pending...')
   * }
   * ```
   */
  checkBundleStatus(bundleId: string): Promise<BundleStatusResult>

  /**
   * Confirms transaction status with retry mechanism
   *
   * Polls the network to check transaction confirmation status with retry logic.
   * Attempts to confirm the transaction up to the maximum retry limit before timing out.
   * Uses configurable retry parameters for optimal network performance.
   *
   * @param signature - Transaction signature to confirm
   * @param options - Optional configuration for confirmation behavior
   * @param options.maxRetries - Maximum number of confirmation attempts (default: 4)
   * @param options.retryDelay - Delay between retry attempts in milliseconds (default: 500)
   * @returns Promise resolving to confirmation result with status and error information
   * @throws Error if signature status polling fails
   *
   * @example
   * ```typescript
   * const result = await transactionManager.confirmTransaction(signature)
   * if (result.confirmed) {
   *   console.log('Transaction confirmed successfully')
   * } else {
   *   console.log('Transaction failed:', result.err)
   * }
   *
   * // With custom options
   * const result = await transactionManager.confirmTransaction(signature, {
   *   maxRetries: 6,
   *   retryDelay: 1000
   * })
   * ```
   */
  confirmTransaction(
    signature: Signature,
    options?: {
      maxRetries?: number
      retryDelay?: number
    }
  ): Promise<{ confirmed: true; err?: never } | { confirmed: false; err?: Error | null }>
}
