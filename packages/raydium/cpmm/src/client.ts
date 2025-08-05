import { getTransferSolInstruction } from '@solana-program/system'
import {
  findAssociatedTokenPda,
  getCloseAccountInstruction,
  getCreateAssociatedTokenInstruction,
  getSyncNativeInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token'
import { address, getProgramDerivedAddress } from '@solana/addresses'
import { getBytesEncoder, type GetAccountInfoApi, type Instruction, type Rpc } from '@solana/kit'

import { AUTHORITY_SEED } from './constants'
import {
  fetchMaybePoolState,
  getSwapBaseInputInstruction,
  RAYDIUM_CP_SWAP_PROGRAM_ADDRESS,
} from './generated'
import type {
  AtomicSwapOption,
  AtomicSwapParams,
  BuyOption,
  BuyParams,
  PoolKeys,
  RaydiumCpmmClient,
  SellOption,
  SellParams,
} from './types'

class RaydiumCpmmClientImpl implements RaydiumCpmmClient {
  constructor(private readonly rpc: Rpc<GetAccountInfoApi>) {}

  async fetchPoolKeys(id: string): Promise<PoolKeys> {
    const poolId = address(id)
    const poolState = await fetchMaybePoolState(this.rpc, poolId)

    if (!poolState.exists) {
      throw new Error(`Pool ${id} not found`)
    }

    return { poolId, ...poolState.data }
  }

  async createBuyInstructions(params: BuyParams, option: BuyOption) {
    const instructions: Instruction[] = []
    const { hasSolAta = false, hasTokenAta = true } = option
    const { amountIn, buyer, minAmountOut, poolKeys } = params
    const { token0Mint: WSolMint, token1Mint: tokenMint } = poolKeys

    const [[inputTokenAccount], [outputTokenAccount], [authority]] = await Promise.all([
      findAssociatedTokenPda({
        mint: WSolMint,
        owner: buyer.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      }),
      findAssociatedTokenPda({
        mint: tokenMint,
        owner: buyer.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      }),
      getProgramDerivedAddress({
        programAddress: RAYDIUM_CP_SWAP_PROGRAM_ADDRESS,
        seeds: [getBytesEncoder().encode(AUTHORITY_SEED)],
      }),
    ])

    if (!hasSolAta) {
      const mint = WSolMint
      const createBaseAta = getCreateAssociatedTokenInstruction({
        ata: inputTokenAccount,
        mint,
        owner: buyer.address,
        payer: buyer,
      })
      instructions.push(createBaseAta)
    }

    if (!hasTokenAta) {
      const mint = tokenMint
      const createBaseAta = getCreateAssociatedTokenInstruction({
        ata: outputTokenAccount,
        mint,
        owner: buyer.address,
        payer: buyer,
      })
      instructions.push(createBaseAta)
    }

    const transferInstruction = getTransferSolInstruction({
      source: buyer,
      destination: inputTokenAccount,
      amount: amountIn,
    })
    instructions.push(transferInstruction, getSyncNativeInstruction({ account: inputTokenAccount }))

    const buyInstruction = getSwapBaseInputInstruction({
      ammConfig: poolKeys.ammConfig,
      inputTokenAccount,
      outputTokenAccount,
      amountIn,
      inputTokenMint: poolKeys.token0Mint,
      outputTokenMint: poolKeys.token1Mint,
      inputTokenProgram: poolKeys.token0Program,
      outputTokenProgram: poolKeys.token1Program,
      inputVault: poolKeys.token0Vault,
      outputVault: poolKeys.token1Vault,
      payer: buyer,
      observationState: poolKeys.observationKey,
      minimumAmountOut: minAmountOut,
      poolState: poolKeys.poolId,
      authority,
    })

    instructions.push(buyInstruction)

    if (!hasSolAta) {
      const closeQuoteAta = getCloseAccountInstruction({
        account: inputTokenAccount,
        destination: buyer.address,
        owner: buyer.address,
      })
      instructions.push(closeQuoteAta)
    }

    return instructions
  }

  async createSellInstructions(params: SellParams, option: SellOption): Promise<Instruction[]> {
    const instructions: Instruction[] = []
    const { amountIn, seller, minAmountOut, poolKeys } = params
    const { hasSolAta = false, sellAll = false } = option
    const { token0Mint: WSolMint, token1Mint: tokenMint } = poolKeys

    const [[outputTokenAccount], [inputTokenAccount], [authority]] = await Promise.all([
      findAssociatedTokenPda({
        mint: WSolMint,
        owner: seller.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      }),
      findAssociatedTokenPda({
        mint: tokenMint,
        owner: seller.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      }),
      getProgramDerivedAddress({
        programAddress: RAYDIUM_CP_SWAP_PROGRAM_ADDRESS,
        seeds: [getBytesEncoder().encode(AUTHORITY_SEED)],
      }),
    ])

    if (!hasSolAta) {
      const mint = WSolMint
      const createBaseAta = getCreateAssociatedTokenInstruction({
        ata: outputTokenAccount,
        mint,
        owner: seller.address,
        payer: seller,
      })
      instructions.push(createBaseAta)
    }

    const sellInstruction = getSwapBaseInputInstruction({
      ammConfig: poolKeys.ammConfig,
      inputTokenAccount,
      outputTokenAccount,
      amountIn,
      inputTokenMint: poolKeys.token1Mint,
      outputTokenMint: poolKeys.token0Mint,
      inputTokenProgram: poolKeys.token1Program,
      outputTokenProgram: poolKeys.token0Program,
      inputVault: poolKeys.token1Vault,
      outputVault: poolKeys.token0Vault,
      payer: seller,
      observationState: poolKeys.observationKey,
      minimumAmountOut: minAmountOut,
      poolState: poolKeys.poolId,
      authority,
    })

    instructions.push(sellInstruction)

    if (!hasSolAta) {
      const closeQuoteAta = getCloseAccountInstruction({
        account: outputTokenAccount,
        destination: seller.address,
        owner: seller.address,
      })
      instructions.push(closeQuoteAta)
    }

    if (sellAll) {
      const closeQuoteAta = getCloseAccountInstruction({
        account: inputTokenAccount,
        destination: seller.address,
        owner: seller.address,
      })
      instructions.push(closeQuoteAta)
    }

    return instructions
  }

  async createAtomicInstructions(
    params: AtomicSwapParams,
    option: AtomicSwapOption
  ): Promise<{ buyInstructions: Instruction[]; sellInstructions: Instruction[] }> {
    const { minOutIsZero = true, hasSolAta = false, hasTokenAta = true } = option
    const { amountBuy, amountSell, payer, poolKeys } = params
    const { token0Mint: WSolMint, token1Mint: tokenMint } = poolKeys

    const [[inputTokenAccount], [outputTokenAccount], [authority]] = await Promise.all([
      findAssociatedTokenPda({
        mint: WSolMint,
        owner: payer.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      }),
      findAssociatedTokenPda({
        mint: tokenMint,
        owner: payer.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      }),
      getProgramDerivedAddress({
        programAddress: RAYDIUM_CP_SWAP_PROGRAM_ADDRESS,
        seeds: [getBytesEncoder().encode(AUTHORITY_SEED)],
      }),
      ,
    ])

    const buyInstructions: Instruction[] = []
    const sellInstructions: Instruction[] = []
    if (!hasSolAta) {
      const mint = WSolMint
      const createBaseAta = getCreateAssociatedTokenInstruction({
        ata: inputTokenAccount,
        mint,
        owner: payer.address,
        payer: payer,
      })
      buyInstructions.push(createBaseAta)
    }

    if (!hasTokenAta) {
      const mint = tokenMint
      const createBaseAta = getCreateAssociatedTokenInstruction({
        ata: outputTokenAccount,
        mint,
        owner: payer.address,
        payer: payer,
      })
      buyInstructions.push(createBaseAta)
    }
    const transferInstruction = getTransferSolInstruction({
      source: payer,
      destination: inputTokenAccount,
      amount: amountBuy,
    })
    buyInstructions.push(
      transferInstruction,
      getSyncNativeInstruction({ account: inputTokenAccount })
    )

    const buyInstruction = getSwapBaseInputInstruction({
      ammConfig: poolKeys.ammConfig,
      inputTokenAccount,
      outputTokenAccount,
      amountIn: amountBuy,
      inputTokenMint: poolKeys.token0Mint,
      outputTokenMint: poolKeys.token1Mint,
      inputTokenProgram: poolKeys.token0Program,
      outputTokenProgram: poolKeys.token1Program,
      inputVault: poolKeys.token0Vault,
      outputVault: poolKeys.token1Vault,
      payer,
      observationState: poolKeys.observationKey,
      minimumAmountOut: minOutIsZero ? 0n : amountSell,
      poolState: poolKeys.poolId,
      authority,
    })

    buyInstructions.push(buyInstruction)

    const sellInstruction = getSwapBaseInputInstruction({
      ammConfig: poolKeys.ammConfig,
      inputTokenAccount: outputTokenAccount,
      outputTokenAccount: inputTokenAccount,
      amountIn: amountSell,
      inputTokenMint: poolKeys.token1Mint,
      outputTokenMint: poolKeys.token0Mint,
      inputTokenProgram: poolKeys.token1Program,
      outputTokenProgram: poolKeys.token0Program,
      inputVault: poolKeys.token1Vault,
      outputVault: poolKeys.token0Vault,
      payer,
      observationState: poolKeys.observationKey,
      minimumAmountOut: 0n,
      poolState: poolKeys.poolId,
      authority,
    })
    sellInstructions.push(sellInstruction)

    if (!hasSolAta) {
      sellInstructions.push(
        getCloseAccountInstruction({
          account: inputTokenAccount,
          destination: payer.address,
          owner: payer.address,
        })
      )
    }

    if (!hasTokenAta && !minOutIsZero) {
      sellInstructions.push(
        getCloseAccountInstruction({
          account: outputTokenAccount,
          destination: payer.address,
          owner: payer.address,
        })
      )
    }

    return { buyInstructions, sellInstructions }
  }
}

export const createRaydiumCpmmClient = (rpc: Rpc<GetAccountInfoApi>): RaydiumCpmmClient => {
  return new RaydiumCpmmClientImpl(rpc)
}
