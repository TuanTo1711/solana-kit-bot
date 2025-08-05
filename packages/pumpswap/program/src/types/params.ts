import type { Address, TransactionSigner } from '@solana/kit'

export type PoolKeys = {
  pool: Address
  poolBump: number
  index: number
  creator: Address
  baseMint: Address
  quoteMint: Address
  lpMint: Address
  poolBaseTokenAccount: Address
  poolQuoteTokenAccount: Address
  lpSupply: number | bigint
  coinCreator: Address
}

export type BuyParams = {
  poolKeys: PoolKeys
  buyer: TransactionSigner<string>
  maxAmountIn: number | bigint
  amountOut: number | bigint
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
