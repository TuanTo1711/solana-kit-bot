import { getTransferSolInstruction } from '@solana-program/system'
import {
  findAssociatedTokenPda,
  getCloseAccountInstruction,
  getCreateAssociatedTokenInstruction,
  getSyncNativeInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token'
import {
  getBase58Codec,
  getProgramDerivedAddress,
  type Address,
  type GetAccountInfoApi,
  type Instruction,
  type Rpc,
} from '@solana/kit'

import { getSwapAddresses } from './constant'
import {
  fetchPool,
  getBuyInstructionAsync,
  getSellInstruction,
  getSellInstructionAsync,
  PUMP_AMM_PROGRAM_ADDRESS,
} from './generated'
import type {
  AtomicSwapOption,
  AtomicSwapParams,
  BuyOption,
  BuyParams,
  PoolKeys,
  PumpswapClient,
  SellOption,
  SellParams,
} from './types'

/**
 * Implementation of the PumpswapClient interface for interacting with PumpSwap AMM pools.
 * Provides methods to fetch pool information and create buy/sell/atomic swap instructions.
 */
class PumpswapClientImpl implements PumpswapClient {
  /**
   * Creates a new PumpswapClient instance.
   * @param rpc - The Solana RPC client for blockchain interactions
   */
  constructor(private readonly rpc: Rpc<GetAccountInfoApi>) {}

  /**
   * Fetches pool keys and metadata for a given pool ID.
   * @param poolId - The address of the pool to fetch information for
   * @returns Promise resolving to the complete pool keys including pool address
   */
  async fetchPoolKeys(poolId: Address<string>): Promise<PoolKeys> {
    const { data: poolKeys } = await fetchPool(this.rpc, poolId)
    return { pool: poolId, ...poolKeys }
  }

  /**
   * Creates a sequence of instructions for buying tokens from a PumpSwap pool.
   * This method handles:
   * - Creating associated token accounts if needed
   * - Transferring SOL and wrapping it as wSOL
   * - Executing the buy operation
   * - Cleaning up temporary accounts
   *
   * @param params - Buy operation parameters including amounts, buyer, and pool keys
   * @param option - Options for the buy operation (ATA existence flags)
   * @returns Promise resolving to an array of Solana instructions
   */
  async createBuyInstructions(params: BuyParams, option: BuyOption): Promise<Instruction[]> {
    const instructions: Instruction[] = []
    const { hasBaseAta = true, hasQuoteAta = false } = option
    const { amountOut, buyer, maxAmountIn, poolKeys } = params
    const { baseMint, quoteMint, coinCreator } = poolKeys

    const defaultAddresses = getSwapAddresses()

    const base58 = getBase58Codec()

    // Find or derive all required addresses for the swap operation
    const [[baseAta], [quoteAta], [coinCreatorVaultAuthority, [coinCreatorVaultAta]]] =
      await Promise.all([
        // Find the buyer's base token associated token account
        findAssociatedTokenPda({
          mint: baseMint,
          owner: buyer.address,
          tokenProgram: TOKEN_PROGRAM_ADDRESS,
        }),
        // Find the buyer's quote token (wrapped SOL) associated token account
        findAssociatedTokenPda({
          mint: quoteMint,
          owner: buyer.address,
          tokenProgram: TOKEN_PROGRAM_ADDRESS,
        }),
        // Derive the coin creator's vault authority and find their quote token ATA
        getProgramDerivedAddress({
          programAddress: PUMP_AMM_PROGRAM_ADDRESS,
          seeds: ['creator_vault', base58.encode(coinCreator)],
        }).then(([coinCreatorVaultAuthority]) => {
          return Promise.all([
            coinCreatorVaultAuthority,
            findAssociatedTokenPda({
              mint: quoteMint,
              owner: coinCreatorVaultAuthority,
              tokenProgram: TOKEN_PROGRAM_ADDRESS,
            }),
          ])
        }),
      ])

    // Create base token ATA if it doesn't exist
    if (!hasBaseAta) {
      const mint = poolKeys.baseMint
      const createBaseAta = getCreateAssociatedTokenInstruction({
        ata: baseAta,
        mint,
        owner: buyer.address,
        payer: buyer,
      })
      instructions.push(createBaseAta)
    }

    // Create quote token (wSOL) ATA if it doesn't exist
    if (!hasQuoteAta) {
      const mint = poolKeys.quoteMint
      const createBaseAta = getCreateAssociatedTokenInstruction({
        ata: quoteAta,
        mint,
        owner: buyer.address,
        payer: buyer,
      })
      instructions.push(createBaseAta)
    }

    // Transfer SOL to the quote token account and sync it as wrapped SOL
    const transferInstruction = getTransferSolInstruction({
      source: buyer,
      destination: quoteAta,
      amount: maxAmountIn,
    })
    instructions.push(transferInstruction, getSyncNativeInstruction({ account: quoteAta }))

    // Create the main buy instruction for the PumpSwap AMM
    const buyInstruction = await getBuyInstructionAsync({
      ...poolKeys,
      ...defaultAddresses,
      user: buyer,
      baseAmountOut: amountOut,
      maxQuoteAmountIn: maxAmountIn,
      userBaseTokenAccount: baseAta,
      userQuoteTokenAccount: quoteAta,
      coinCreatorVaultAta,
      coinCreatorVaultAuthority,
      userAccTarget: buyer,
    })

    instructions.push(buyInstruction)

    // Close the quote token ATA if it was created temporarily (to reclaim SOL rent)
    if (!hasQuoteAta) {
      const closeQuoteAta = getCloseAccountInstruction({
        account: quoteAta,
        destination: buyer.address,
        owner: buyer.address,
      })
      instructions.push(closeQuoteAta)
    }

    return instructions
  }

  /**
   * Creates a sequence of instructions for selling tokens to a PumpSwap pool.
   * This method handles:
   * - Creating quote token ATA if needed
   * - Executing the sell operation
   * - Closing temporary accounts
   * - Optionally closing the base token account if selling all tokens
   *
   * @param params - Sell operation parameters including amounts, seller, and pool keys
   * @param option - Options for the sell operation (ATA existence and sellAll flags)
   * @returns Promise resolving to an array of Solana instructions
   */
  async createSellInstructions(params: SellParams, option: SellOption): Promise<Instruction[]> {
    const instructions: Instruction[] = []
    const { sellAll = false, hasQuoteAta = false } = option
    const { amountIn, seller, minAmountOut, poolKeys } = params
    const { baseMint, quoteMint, coinCreator } = poolKeys

    const defaultAddresses = getSwapAddresses()
    const base58 = getBase58Codec()

    const [[baseAta], [quoteAta], [coinCreatorVaultAuthority]] = await Promise.all([
      findAssociatedTokenPda({
        mint: baseMint,
        owner: seller.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      }),
      findAssociatedTokenPda({
        mint: quoteMint,
        owner: seller.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      }),
      getProgramDerivedAddress({
        programAddress: PUMP_AMM_PROGRAM_ADDRESS,
        seeds: ['creator_vault', base58.encode(coinCreator)],
      }),
    ])

    // Create quote token (wSOL) ATA if it doesn't exist
    if (!hasQuoteAta) {
      const mint = poolKeys.quoteMint
      const createQuoteAta = getCreateAssociatedTokenInstruction({
        ata: quoteAta,
        mint,
        owner: seller.address,
        payer: seller,
      })
      instructions.push(createQuoteAta)
    }

    // Create the main sell instruction for the PumpSwap AMM
    const sellInstruction = await getSellInstructionAsync({
      ...poolKeys,
      ...defaultAddresses,
      user: seller,
      baseAmountIn: amountIn,
      minQuoteAmountOut: minAmountOut,
      userBaseTokenAccount: baseAta,
      userQuoteTokenAccount: quoteAta,
      coinCreatorVaultAuthority,
    })

    instructions.push(sellInstruction)

    // Close the quote token ATA if it was created temporarily
    if (!hasQuoteAta) {
      const closeQuoteAta = getCloseAccountInstruction({
        account: quoteAta,
        destination: seller.address,
        owner: seller.address,
      })
      instructions.push(closeQuoteAta)
    }

    // Close the base token ATA if selling all tokens (to reclaim rent)
    if (sellAll) {
      const closeBaseAta = getCloseAccountInstruction({
        account: baseAta,
        destination: seller.address,
        owner: seller.address,
      })
      instructions.push(closeBaseAta)
    }

    return instructions
  }

  /**
   * Creates a sequence of instructions for an atomic swap operation (buy then sell, or sell then buy).
   * This method is useful for:
   * - Volume generation/trading bots
   * - Testing pool liquidity
   * - Market making operations
   *
   * The atomic swap ensures both operations happen in the same transaction or fail together.
   *
   * @param params - Atomic swap parameters including amounts, payer, and pool keys
   * @param option - Options for the atomic swap (ATA flags, order preference, minimum output settings)
   * @returns Promise resolving to an array of Solana instructions
   */
  async createAtomicSwapInstructions(
    params: AtomicSwapParams,
    option: AtomicSwapOption
  ): Promise<Instruction[]> {
    const instructions: Instruction[] = []
    const { hasBaseAta = true, hasQuoteAta = false, minOutIsZero = true, buyFirst = true } = option
    const { poolKeys, payer, amountBuy, baseAmountBuy, amountSell } = params
    const { baseMint, quoteMint, coinCreator } = poolKeys

    const defaultAddresses = getSwapAddresses()
    const base58 = getBase58Codec()

    const [[baseAta], [quoteAta], [coinCreatorVaultAuthority, [coinCreatorVaultAta]]] =
      await Promise.all([
        findAssociatedTokenPda({
          mint: baseMint,
          owner: payer.address,
          tokenProgram: TOKEN_PROGRAM_ADDRESS,
        }),
        findAssociatedTokenPda({
          mint: quoteMint,
          owner: payer.address,
          tokenProgram: TOKEN_PROGRAM_ADDRESS,
        }),
        getProgramDerivedAddress({
          programAddress: PUMP_AMM_PROGRAM_ADDRESS,
          seeds: ['creator_vault', base58.encode(coinCreator)],
        }).then(([coinCreatorVaultAuthority]) => {
          return Promise.all([
            coinCreatorVaultAuthority,
            findAssociatedTokenPda({
              mint: quoteMint,
              owner: coinCreatorVaultAuthority,
              tokenProgram: TOKEN_PROGRAM_ADDRESS,
            }),
          ])
        }),
      ])

    // Create base token ATA if it doesn't exist
    if (!hasBaseAta) {
      const mint = poolKeys.baseMint
      const createBaseAta = getCreateAssociatedTokenInstruction({
        ata: baseAta,
        mint,
        owner: payer.address,
        payer: payer,
      })
      instructions.push(createBaseAta)
    }

    // Create quote token (wSOL) ATA if it doesn't exist
    if (!hasQuoteAta) {
      const mint = poolKeys.quoteMint
      const createBaseAta = getCreateAssociatedTokenInstruction({
        ata: quoteAta,
        mint,
        owner: payer.address,
        payer: payer,
      })
      instructions.push(createBaseAta)
    }

    // Create buy instruction - purchases base tokens with quote tokens
    const buyInstruction = await getBuyInstructionAsync({
      ...poolKeys,
      ...defaultAddresses,
      user: payer,
      baseAmountOut: baseAmountBuy ?? amountSell,
      maxQuoteAmountIn: amountBuy,
      userBaseTokenAccount: baseAta,
      userQuoteTokenAccount: quoteAta,
      coinCreatorVaultAta,
      coinCreatorVaultAuthority,
      userAccTarget: payer,
    })

    // Create sell instruction - sells base tokens for quote tokens
    const sellInstruction = getSellInstruction({
      ...poolKeys,
      ...defaultAddresses,
      user: payer,
      baseAmountIn: amountSell,
      minQuoteAmountOut: minOutIsZero ? 0n : amountBuy,
      userBaseTokenAccount: baseAta,
      userQuoteTokenAccount: quoteAta,
      coinCreatorVaultAta,
      coinCreatorVaultAuthority,
    })

    // Add instructions in the specified order (buy-first or sell-first)
    instructions.push(
      ...(buyFirst ? [buyInstruction, sellInstruction] : [sellInstruction, buyInstruction])
    )

    // Close the quote token ATA if it exists (to reclaim rent)
    if (hasQuoteAta) {
      const closeQuoteAta = getCloseAccountInstruction({
        account: quoteAta,
        destination: payer.address,
        owner: payer.address,
      })
      instructions.push(closeQuoteAta)
    }

    return instructions
  }
}

/**
 * Factory function to create a new PumpswapClient instance.
 *
 * @param rpc - The Solana RPC client for blockchain interactions
 * @returns A new PumpswapClient instance
 *
 * @example
 * ```typescript
 * import { createSolanaRpc } from '@solana/kit'
 * import { createPumpswapClient } from './client'
 *
 * const rpc = createSolanaRpc('https://api.mainnet-beta.solana.com')
 * const client = createPumpswapClient(rpc)
 *
 * // Fetch pool information
 * const poolKeys = await client.fetchPoolKeys('11111111111111111111111111111112')
 *
 * // Create buy instructions
 * const buyInstructions = await client.createBuyInstructions({
 *   amountOut: 1000n,
 *   buyer: { address: 'BuyerAddressHere' },
 *   maxAmountIn: 5000n,
 *   poolKeys
 * }, { hasBaseAta: false })
 * ```
 */
export const createPumpswapClient = (rpc: Rpc<GetAccountInfoApi>): PumpswapClient => {
  return new PumpswapClientImpl(rpc)
}
