import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system'
import { type Address } from '@solana/addresses'

import {
  COIN_CREATOR_FEE_BASIS_POINTS,
  LP_FEE_BASIS_POINTS,
  PROTOCOL_FEE_BASIS_POINTS,
} from '../constant/fee'
import { calculateQuoteAmountOut, ceilDiv, calculateFee } from './math'

/**
 * Result of computing a sell operation with base tokens as input
 */
interface SellBaseInResult {
  /** Quote amount before any fee deductions */
  internalQuoteBeforeFee: bigint
  /** Final quote amount after all fees are deducted */
  uiQuote: bigint
  /** Minimum quote amount with slippage protection applied */
  minQuote: bigint
}

/**
 * Result of computing a sell operation with quote tokens as desired output
 */
interface SellQuoteInResult {
  /** Raw quote amount needed before fees */
  internalRawQuote: bigint
  /** Base amount required to receive desired quote */
  base: bigint
  /** Maximum base amount with slippage protection */
  maxBase: bigint
}

/**
 * Computes the quote amount received when selling base tokens in a constant product AMM.
 *
 * Uses the formula: quoteOut = (quoteReserve * baseIn) / (baseReserve + baseIn)
 * Then applies fees and slippage protection.
 *
 * @param params - Parameters for the sell calculation
 * @param params.base - Amount of base tokens to sell
 * @param params.slippage - Slippage tolerance as percentage (e.g., 1 for 1%)
 * @param params.baseReserve - Current base token reserve in pool
 * @param params.quoteReserve - Current quote token reserve in pool
 * @param params.coinCreator - Address of coin creator (determines if creator fee applies)
 * @param params.coinCreatorFeeBps - Coin creator fee in basis points
 * @param params.lpFeeBps - LP fee in basis points
 * @param params.protocolFeeBps - Protocol fee in basis points
 *
 * @returns SellBaseInResult containing quote amounts before/after fees and slippage
 * @throws Error if inputs are invalid or would result in negative output
 *
 * @example
 * ```typescript
 * const result = computeSellBaseIn({
 *   base: 1000000n,      // Sell 1M base tokens
 *   slippage: 1,         // 1% slippage
 *   baseReserve: 10000000n, // 10M base reserve
 *   quoteReserve: 5000000n, // 5M quote reserve
 *   coinCreator: creatorAddress
 * })
 * ```
 */
export function computeSellBaseIn({
  base,
  slippage,
  baseReserve,
  quoteReserve,
  coinCreator,
  coinCreatorFeeBps = COIN_CREATOR_FEE_BASIS_POINTS,
  lpFeeBps = LP_FEE_BASIS_POINTS,
  protocolFeeBps = PROTOCOL_FEE_BASIS_POINTS,
}: {
  base: bigint
  slippage: number
  baseReserve: bigint
  quoteReserve: bigint
  coinCreator: Address
  coinCreatorFeeBps?: bigint
  lpFeeBps?: bigint
  protocolFeeBps?: bigint
}): SellBaseInResult {
  // Validate inputs
  if (base === 0n) throw new Error("Invalid input: 'base' cannot be zero")
  if (baseReserve === 0n || quoteReserve === 0n) {
    throw new Error('Invalid input: reserves cannot be zero')
  }

  // Calculate quote using constant product formula
  const quoteAmountOut = (quoteReserve * base) / (baseReserve + base)
  if (quoteAmountOut === 0n) {
    throw new Error('Pool would be depleted; output would be zero')
  }

  // Calculate and apply fees
  const creatorFee =
    coinCreator === SYSTEM_PROGRAM_ADDRESS ? 0n : calculateFee(quoteAmountOut, coinCreatorFeeBps)
  const lpFee = calculateFee(quoteAmountOut, lpFeeBps)
  const protocolFee = calculateFee(quoteAmountOut, protocolFeeBps)
  const finalQuote = quoteAmountOut - lpFee - protocolFee - creatorFee

  if (finalQuote < 0n) {
    throw new Error('After fees, quote received would be negative')
  }

  // Apply slippage protection
  const slippageFactor = Math.floor((1 - slippage / 100) * 1_000_000_000)
  const minQuote = (finalQuote * BigInt(slippageFactor)) / 1_000_000_000n

  return { internalQuoteBeforeFee: quoteAmountOut, uiQuote: finalQuote, minQuote }
}

/**
 * Computes the base amount needed to receive a desired quote amount when selling.
 *
 * Reverses the fee calculation to determine required raw quote amount,
 * then calculates needed base input using constant product formula.
 *
 * @param params - Parameters for the sell calculation
 * @param params.quote - Desired quote amount to receive
 * @param params.slippage - Slippage tolerance as percentage (e.g., 1 for 1%)
 * @param params.baseReserve - Current base token reserve in pool
 * @param params.quoteReserve - Current quote token reserve in pool
 * @param params.coinCreator - Address of coin creator (determines if creator fee applies)
 * @param params.coinCreatorFeeBps - Coin creator fee in basis points
 * @param params.lpFeeBps - LP fee in basis points
 * @param params.protocolFeeBps - Protocol fee in basis points
 *
 * @returns SellQuoteInResult containing required base amount and slippage protection
 * @throws Error if inputs are invalid or would deplete pool
 *
 * @example
 * ```typescript
 * const result = computeSellQuoteIn({
 *   quote: 1000000n,     // Want to receive 1M quote tokens
 *   slippage: 1,         // 1% slippage
 *   baseReserve: 10000000n, // 10M base reserve
 *   quoteReserve: 5000000n, // 5M quote reserve
 *   coinCreator: creatorAddress
 * })
 * ```
 */
export function computeSellQuoteIn({
  quote,
  slippage,
  baseReserve,
  quoteReserve,
  coinCreator,
  coinCreatorFeeBps = COIN_CREATOR_FEE_BASIS_POINTS,
  lpFeeBps = LP_FEE_BASIS_POINTS,
  protocolFeeBps = PROTOCOL_FEE_BASIS_POINTS,
}: {
  quote: bigint
  slippage: number
  baseReserve: bigint
  quoteReserve: bigint
  coinCreator: Address
  coinCreatorFeeBps?: bigint
  lpFeeBps?: bigint
  protocolFeeBps?: bigint
}): SellQuoteInResult {
  // Validate inputs
  if (quote === 0n) throw new Error("Invalid input: 'quote' cannot be zero")
  if (baseReserve === 0n || quoteReserve === 0n) {
    throw new Error('Invalid input: reserves cannot be zero')
  }

  // Calculate raw quote needed before fees
  const effectiveCoinCreatorFeeBps = coinCreator === SYSTEM_PROGRAM_ADDRESS ? 0n : coinCreatorFeeBps
  const rawQuote = calculateQuoteAmountOut(
    quote,
    lpFeeBps,
    protocolFeeBps,
    effectiveCoinCreatorFeeBps
  )

  if (rawQuote >= quoteReserve) {
    throw new Error('Desired quote amount exceeds pool reserve')
  }

  // Calculate required base input
  const baseAmountIn = ceilDiv(baseReserve * rawQuote, quoteReserve - rawQuote)
  if (baseAmountIn === 0n) {
    throw new Error('Invalid input: would deplete pool')
  }

  // Apply slippage protection
  const slippageFactor = Math.floor((1 + slippage / 100) * 1_000_000_000)
  const maxBase = (baseAmountIn * BigInt(slippageFactor)) / 1_000_000_000n

  return { internalRawQuote: rawQuote, base: baseAmountIn, maxBase }
}
