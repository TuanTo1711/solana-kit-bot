/**
 * @fileoverview Transaction Manager for building and sending Solana transactions and bundles
 *
 * This module provides a comprehensive transaction management system for Solana applications,
 * supporting various transaction types including simple transactions, bundles with tips,
 * and integration with Jito for MEV protection.
 */

import {
  estimateComputeUnitLimitFactory,
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
} from '@solana-program/compute-budget'
import { getTransferSolInstruction } from '@solana-program/system'
import {
  address,
  addSignersToTransactionMessage,
  appendTransactionMessageInstruction,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  pipe,
  prependTransactionMessageInstruction,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Base64EncodedWireTransaction,
  type Instruction,
  type Signature,
  type Slot,
  type TransactionBlockhashLifetime,
  type TransactionSigner,
} from '@solana/kit'

import { randomSenderAccount, type Provider } from '@solana-kit-bot/provider'
import type { BuildSenderOptions, Bundle, TransactionManager } from '~/types'

/**
 * Jito tip accounts for MEV protection
 *
 * These accounts are used to pay tips to Jito validators for transaction prioritization
 * and MEV (Maximal Extractable Value) protection. Tips are automatically distributed
 * among these accounts to improve transaction success rates.
 */
export const JITO_TIP_ACCOUNTS: string[] = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
]

/**
 * Randomly selects a Jito tip account
 *
 * @returns A randomly selected Jito tip account address
 */
export const randomTipAccount = (): string =>
  JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)]!

/**
 * Implementation of the TransactionManager interface
 *
 * Provides methods for building and sending various types of Solana transactions,
 * including simple transactions, sender transactions, and bundles with Jito tips.
 *
 * @implements TransactionManager
 */
class TransactionManagerImpl implements TransactionManager {
  private readonly estimatCUs: ReturnType<typeof estimateComputeUnitLimitFactory>

  /**
   * Creates a new TransactionManager instance
   *
   * @param provider - The provider instance for RPC and Jito connections
   */
  constructor(private readonly provider: Provider) {
    this.estimatCUs = estimateComputeUnitLimitFactory({ rpc: provider.rpc })
  }

  /**
   * Retrieves the latest blockhash from the network
   *
   * @param minContextSlot - Optional minimum context slot for the blockhash
   * @returns Promise resolving to the latest blockhash with lifetime information
   * @throws Error if blockhash retrieval fails
   */
  private async getBlockhash(minContextSlot?: Slot): Promise<TransactionBlockhashLifetime> {
    try {
      const { rpc } = this.provider
      const { value: blockhash } = await rpc
        .getLatestBlockhash({
          commitment: 'confirmed',
          ...(minContextSlot && { minContextSlot }),
        })
        .send()
      return blockhash
    } catch (error) {
      throw new Error(
        `Failed to get blockhash: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Creates a base transaction message with common setup
   *
   * @param blockhash - Transaction blockhash and lifetime information
   * @param instructions - Array of instructions to include
   * @param feePayer - Transaction fee payer signer
   * @returns Configured transaction message
   */
  private createBaseMessage(
    blockhash: TransactionBlockhashLifetime,
    instructions: Instruction[],
    feePayer: TransactionSigner
  ) {
    return pipe(
      createTransactionMessage({ version: 0 }),
      msg => setTransactionMessageLifetimeUsingBlockhash(blockhash, msg),
      msg => appendTransactionMessageInstructions(instructions, msg),
      msg => setTransactionMessageFeePayer(feePayer.address, msg)
    )
  }

  /**
   * Builds a simple transaction with the provided instructions
   *
   * @param instructions - Array of instructions to execute
   * @param feePayer - Transaction fee payer signer
   * @param minContextSlot - Optional minimum context slot
   * @returns Promise resolving to base64-encoded wire transaction
   * @throws Error if transaction building fails
   */
  async buildSimpleTransaction(
    instructions: Instruction[],
    feePayer: TransactionSigner,
    minContextSlot?: Slot
  ): Promise<Base64EncodedWireTransaction> {
    try {
      const blockhash = await this.getBlockhash(minContextSlot)
      const message = this.createBaseMessage(blockhash, instructions, feePayer)
      const transaction = await signTransactionMessageWithSigners(message)
      return getBase64EncodedWireTransaction(transaction)
    } catch (error) {
      throw new Error(
        `Failed to build simple transaction: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Builds a sender transaction (implementation pending)
   *
   * @param instructions - Array of instructions to execute
   * @param feePayer - Transaction fee payer signer
   * @param options - Build options for sender transaction
   * @returns Promise resolving to base64-encoded wire transaction
   * @throws Error indicating method is not implemented
   */
  async buildSenderTransaction(
    instructions: Instruction[],
    feePayer: TransactionSigner,
    options: BuildSenderOptions
  ): Promise<Base64EncodedWireTransaction> {
    let { unitLimit, unitPrice, senderTip } = options
    const blockhash = await this.getBlockhash()
    let message = this.createBaseMessage(blockhash, instructions, feePayer)

    if (!senderTip) {
      try {
        const tipFloor = await this.provider.jito.getTipFloor()
        const recommendedTip = Math.max(tipFloor.landed_tips_99th_percentile, 0.001)
        senderTip = Number(recommendedTip.toFixed(9))
      } catch (error) {
        senderTip = 0.001
      }
    }

    const tipAmount = senderTip * 10 ** 9
    message = prependTransactionMessageInstruction(
      getTransferSolInstruction({
        source: feePayer,
        destination: address(randomSenderAccount()),
        amount: BigInt(tipAmount.toFixed(0)),
      }),
      message
    )

    if (!unitLimit) {
      try {
        const units = await this.estimatCUs(message)
        unitLimit = units < 1000 ? 200_000 : Math.ceil(units * 1.2)
      } catch (error) {
        unitLimit = 200_000
      }
    }

    message = prependTransactionMessageInstruction(
      getSetComputeUnitLimitInstruction({ units: Number(unitLimit.toFixed(0)) }),
      message
    )

    if (!unitPrice) {
      try {
        const transaction = await signTransactionMessageWithSigners(message)
        const serializeTransaction = getBase64EncodedWireTransaction(transaction)
        const { priorityFeeEstimate } = await this.provider.rpc
          .getPriorityFeeEstimate({
            transaction: serializeTransaction,
            options: {
              recommended: true,
              transactionEncoding: 'base64',
            },
          })
          .send()
        const ceil = Math.ceil(Number(priorityFeeEstimate) * 1.2)
        unitPrice = Number(ceil.toFixed(0))
      } catch (error) {
        unitPrice = 50_000
      }
    }

    message = prependTransactionMessageInstruction(
      getSetComputeUnitPriceInstruction({ microLamports: unitPrice }),
      message
    )

    const transaction = await signTransactionMessageWithSigners(message)
    return getBase64EncodedWireTransaction(transaction)
  }

  /**
   * Builds a bundle of transactions with Jito tip for MEV protection
   *
   * Creates multiple transactions in a bundle, with the first transaction
   * including a tip payment to a randomly selected Jito validator account.
   *
   * @param bundles - Array of bundle configurations
   * @param tip - Tip amount in lamports for Jito validators
   * @returns Promise resolving to array of base64-encoded wire transactions
   * @throws Error if bundle building fails
   */
  async buildBundle(bundles: Bundle[], tip: bigint): Promise<Base64EncodedWireTransaction[]> {
    try {
      if (bundles.length === 0) {
        throw new Error('Cannot build empty bundle')
      }

      if (tip < 0n) {
        throw new Error('Tip amount cannot be negative')
      }

      const blockhash = await this.getBlockhash()

      const transactions = await Promise.all(
        bundles.map(async ({ instructions, payer, additionalSigner }, index) => {
          if (!instructions || instructions.length === 0) {
            throw new Error(`Bundle at index ${index} has no instructions`)
          }

          let message = addSignersToTransactionMessage(
            additionalSigner,
            this.createBaseMessage(blockhash, instructions, payer)
          )

          // Add tip to first transaction
          if (index === 0 && tip > 0n) {
            message = appendTransactionMessageInstruction(
              getTransferSolInstruction({
                source: payer,
                destination: address(randomTipAccount()),
                amount: tip,
              }),
              message
            )
          }

          return signTransactionMessageWithSigners(message)
        })
      )

      return transactions.map(t => getBase64EncodedWireTransaction(t))
    } catch (error) {
      throw new Error(
        `Failed to build bundle: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Sends a simple transaction to the network
   *
   * @param transaction - Base64-encoded wire transaction to send
   * @returns Promise resolving to transaction signature
   * @throws Error if transaction sending fails
   */
  async sendSimpleTransaction(transaction: Base64EncodedWireTransaction): Promise<string> {
    try {
      const { rpc } = this.provider
      const signature = await rpc.sendTransaction(transaction, { encoding: 'base64' }).send()
      return signature
    } catch (error) {
      throw new Error(
        `Failed to send simple transaction: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Sends a transaction using the sender API
   *
   * @param transaction - Base64-encoded wire transaction to send
   * @returns Promise resolving to transaction signature
   * @throws Error if transaction sending fails
   */
  async sendSenderTransaction(transaction: Base64EncodedWireTransaction): Promise<string> {
    try {
      const { sender } = this.provider
      const signature = await sender
        .sendTransaction(transaction, { encoding: 'base64', maxRetries: 0, skipPreflight: true })
        .send()
      return signature
    } catch (error) {
      throw new Error(
        `Failed to send sender transaction: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Sends a bundle of transactions using Jito
   *
   * @param bundles - Array of base64-encoded wire transactions to send as bundle
   * @returns Promise resolving to bundle ID
   * @throws Error if bundle sending fails
   */
  async sendBundle(bundles: Base64EncodedWireTransaction[]): Promise<string> {
    try {
      if (bundles.length === 0) {
        throw new Error('Cannot send empty bundle')
      }

      const { jito } = this.provider
      const signature = await jito.sendShakingBundle(bundles, {
        encoding: 'base64',
        skipPreflight: true,
      })
      return signature
    } catch (error) {
      throw new Error(
        `Failed to send bundle: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

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
  async confirmTransaction(
    signature: Signature,
    options?: {
      maxRetries?: number
      retryDelay?: number
    }
  ): Promise<{ confirmed: true; err?: never } | { confirmed: false; err?: Error | null }> {
    const { maxRetries = 4, retryDelay = 500 } = options || {}
    const { rpc } = this.provider

    try {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const statuses = await rpc.getSignatureStatuses([signature]).send()
        const status = statuses.value[0]

        // Transaction failed with error
        if (status?.err) {
          return {
            confirmed: false,
            err: status.err instanceof Error ? status.err : new Error(String(status.err)),
          }
        }

        // Transaction successfully confirmed
        if (
          status?.confirmationStatus === 'confirmed' ||
          status?.confirmationStatus === 'finalized'
        ) {
          return { confirmed: true }
        }

        // Wait before next retry attempt (skip delay on last attempt)
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
      }

      // Timeout: max retries exceeded without confirmation
      return { confirmed: false, err: null }
    } catch (error) {
      throw new Error(
        `Failed to confirm transaction: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}

/**
 * Factory function to create a TransactionManager instance
 *
 * @param provider - Provider instance for RPC and Jito connections
 * @returns New TransactionManager instance
 */
export const createTransactionManager = (provider: Provider): TransactionManager =>
  new TransactionManagerImpl(provider)
