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
 */
export interface Bundle {
  instructions: Instruction[]
  payer: TransactionSigner<string>
  additionalSigner: TransactionSigner[]
}

/**
 * Options for retrying bundle sending with status monitoring
 */
export interface RetryBundleOptions {
  maxRetries?: number
  retryDelay?: number
  statusCheckTimeout?: number
  statusCheckInterval?: number
}

/**
 * Result of bundle status check operation
 */
export interface BundleStatusResult {
  landed: boolean
  failed: boolean
  pending: boolean
  status?: any
  error?: Error
}

/**
 * Options for building sender transactions
 */
export interface BuildSenderOptions {
  unitLimit?: number
  unitPrice?: number
  priorityFeeLevel: PriorityLevel | 'recommended'
  senderTip?: number
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
   * @param instructions - Array of instructions to include
   * @param feePayer - Wallet responsible for transaction fees
   * @param minContextSlot - Optional minimum context slot for blockhash
   * @param additionalSigners - Additional signers for the transaction
   * @returns Promise resolving to base64-encoded wire transaction
   */
  buildSimpleTransaction(
    instructions: Instruction[],
    feePayer: TransactionSigner,
    minContextSlot?: Slot,
    additionalSigners?: TransactionSigner[]
  ): Promise<Base64EncodedWireTransaction>

  /**
   * Builds a transaction using the sender API with enhanced options
   *
   * @param instructions - Array of instructions to include
   * @param feePayer - Wallet responsible for transaction fees
   * @param options - Sender-specific build options
   * @returns Promise resolving to base64-encoded wire transaction
   */
  buildSenderTransaction(
    instructions: Instruction[],
    feePayer: TransactionSigner,
    options: BuildSenderOptions
  ): Promise<Base64EncodedWireTransaction>

  /**
   * Builds a bundle of transactions with Jito tip for MEV protection
   *
   * @param bundles - Array of bundle configurations
   * @param tip - Tip amount in lamports for Jito validators
   * @returns Promise resolving to array of base64-encoded wire transactions
   */
  buildBundle(bundles: Bundle[], tip: bigint): Promise<Base64EncodedWireTransaction[]>

  /**
   * Sends a simple transaction to the Solana network
   *
   * @param transaction - Base64-encoded wire transaction to send
   * @returns Promise resolving to transaction signature
   */
  sendSimpleTransaction(transaction: Base64EncodedWireTransaction): Promise<string>

  /**
   * Sends a transaction using the sender API
   *
   * @param transaction - Base64-encoded wire transaction to send
   * @returns Promise resolving to transaction signature
   */
  sendSenderTransaction(transaction: Base64EncodedWireTransaction): Promise<string>

  /**
   * Sends a bundle of transactions using Jito
   *
   * @param bundles - Array of base64-encoded wire transactions
   * @returns Promise resolving to bundle ID
   * @throws Error if bundle submission fails or is rejected
   */
  sendBundle(bundles: Base64EncodedWireTransaction[]): Promise<string>

  /**
   * Sends a bundle with retry mechanism and status monitoring
   *
   * @param bundles - Array of base64-encoded wire transactions
   * @param options - Retry configuration options
   * @returns Promise resolving to bundle ID
   * @throws Error if all retry attempts fail or bundle definitively fails
   */
  sendBundleWithRetry(
    bundles: Base64EncodedWireTransaction[],
    options?: RetryBundleOptions
  ): Promise<string>

  /**
   * Checks the status of a bundle using Jito's getBundleStatuses API
   *
   * @param bundleId - Bundle identifier to check
   * @returns Promise resolving to bundle status result
   */
  checkBundleStatus(bundleId: string): Promise<BundleStatusResult>

  /**
   * Confirms transaction status with retry mechanism
   *
   * @param signature - Transaction signature to confirm
   * @param options - Optional configuration for confirmation behavior
   * @param options.maxRetries - Maximum number of confirmation attempts
   * @param options.retryDelay - Delay between retry attempts in milliseconds
   * @returns Promise resolving to confirmation result with status and error information
   * @throws Error if signature status polling fails
   */
  confirmTransaction(
    signature: Signature,
    options?: {
      maxRetries?: number
      retryDelay?: number
    }
  ): Promise<{ confirmed: true; err?: never } | { confirmed: false; err?: Error | null }>
}
