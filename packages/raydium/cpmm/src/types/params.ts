import type { Address } from '@solana/addresses'
import type { TransactionSigner } from '@solana/kit'
import type { PoolState } from '~/generated'

export type PoolKeys = PoolState & {
  poolId: Address
}

export type BuyParams = {
  poolKeys: PoolKeys
  buyer: TransactionSigner<string>
  amountIn: number | bigint
  minAmountOut: number | bigint
}

export type SellParams = {
  poolKeys: PoolKeys
  seller: TransactionSigner<string>
  amountIn: number | bigint
  minAmountOut: number | bigint
}

export type AtomicSwapParams = {
  poolKeys: PoolKeys
  payer: TransactionSigner<string>
  amountBuy: number | bigint
  baseAmountBuy?: number | bigint
  amountSell: number | bigint
}
