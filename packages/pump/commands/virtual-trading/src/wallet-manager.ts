/**
 * @fileoverview Wallet management utilities for virtual trading
 */

import { getTransferSolInstruction } from '@solana-program/system'
import { generateKeyPairSigner, type TransactionSigner } from '@solana/kit'

import type { Bundle } from '@solana-kit-bot/core'

import { TRANSFER_AMOUNT_SOL, LAMPORTS_PER_SOL, TRANSACTION_FEE } from './constants'

/**
 * Manages virtual wallet creation, funding, and cleanup operations
 */
export class WalletManager {
  /**
   * Create multiple virtual wallets for trading
   * @param count - Number of wallets to create
   * @returns Array of generated keypair signers
   */
  async createVirtualWallets(count: number): Promise<TransactionSigner[]> {
    return await Promise.all(Array.from({ length: count }, () => generateKeyPairSigner()))
  }

  /**
   * Create a funding bundle to transfer SOL to virtual wallets
   * @param payer - Main wallet that provides funding
   * @param recipients - Virtual wallets to receive funding
   * @returns Bundle containing funding instructions
   */
  createFundingBundle(payer: TransactionSigner, recipients: TransactionSigner[]): Bundle {
    const transferAmount = TRANSFER_AMOUNT_SOL * LAMPORTS_PER_SOL
    const transferInstructions = recipients.map(recipient =>
      getTransferSolInstruction({
        source: payer,
        destination: recipient.address,
        amount: transferAmount,
      })
    )

    return {
      instructions: transferInstructions,
      payer,
      additionalSigner: recipients,
    }
  }

  /**
   * Create a refund instruction to return unused SOL from virtual wallet to main wallet
   * @param virtualWallet - Virtual wallet returning funds
   * @param mainWallet - Main wallet receiving the refund
   * @returns Transfer instruction for the refund
   */
  createRefundInstruction(virtualWallet: TransactionSigner, mainWallet: TransactionSigner) {
    const refundAmount = TRANSFER_AMOUNT_SOL * LAMPORTS_PER_SOL - TRANSACTION_FEE

    return getTransferSolInstruction({
      source: virtualWallet,
      destination: mainWallet.address,
      amount: refundAmount,
    })
  }

  /**
   * Calculate the funding amount needed per wallet
   * @returns Amount in lamports
   */
  getFundingAmountPerWallet(): bigint {
    return BigInt(TRANSFER_AMOUNT_SOL * LAMPORTS_PER_SOL)
  }

  /**
   * Calculate the total funding amount needed for multiple wallets
   * @param walletCount - Number of wallets
   * @returns Total amount in lamports
   */
  getTotalFundingAmount(walletCount: number): bigint {
    return BigInt(walletCount) * this.getFundingAmountPerWallet()
  }

  /**
   * Calculate the refund amount after accounting for transaction fees
   * @returns Refund amount in lamports
   */
  getRefundAmount(): bigint {
    return BigInt(TRANSFER_AMOUNT_SOL * LAMPORTS_PER_SOL - TRANSACTION_FEE)
  }
}
