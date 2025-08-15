import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system'
import { type Address } from '@solana/addresses'

import {
  COIN_CREATOR_FEE_BASIS_POINTS,
  LP_FEE_BASIS_POINTS,
  PROTOCOL_FEE_BASIS_POINTS,
} from '~/constant'
import { ceilDiv, calculateFee } from './math'

/**
 * Result of computing a buy operation with base tokens as desired output
 */
interface BuyBaseInResult {
  /** Quote amount before any fee deductions */
  internalQuoteAmount: bigint
  /** Final quote amount after all fees are deducted */
  uiQuote: bigint
  /** Maximum quote amount with slippage protection */
  maxQuote: bigint
}

/**
 * Result of computing a buy operation with quote tokens as input
 */
interface BuyQuoteInResult {
  /** Amount of base tokens that can be bought */
  base: bigint
  /** Effective quote amount after fee deduction */
  internalQuoteWithoutFees: bigint
  /** Maximum quote amount with slippage protection */
  maxQuote: bigint
}

/**
 * Computes the quote amount required to buy a specific amount of base tokens.
 * Uses the constant product formula (x * y = k) and applies fees.
 *
 * @param params - Parameters for the buy calculation
 * @param params.base - Amount of base tokens to buy
 * @param params.slippage - Slippage tolerance as percentage (e.g., 1 for 1%)
 * @param params.baseReserve - Current base token reserve in pool
 * @param params.quoteReserve - Current quote token reserve in pool
 * @param params.coinCreator - Address of coin creator (determines if creator fee applies)
 * @param params.coinCreatorFeeBps - Coin creator fee in basis points
 * @param params.lpFeeBps - LP fee in basis points
 * @param params.protocolFeeBps - Protocol fee in basis points
 *
 * @returns BuyBaseInResult containing quote amounts before/after fees and slippage
 * @throws Error if inputs are invalid or would result in negative output
 *
 * @example
 * ```typescript
 * const result = computeBuyBaseIn({
 *   base: 1000000n,      // Buy 1M base tokens
 *   slippage: 1,         // 1% slippage
 *   baseReserve: 10000000n, // 10M base reserve
 *   quoteReserve: 5000000n, // 5M quote reserve
 *   coinCreator: creatorAddress
 * })
 * ```
 */
export function computeBuyBaseIn({
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
}): BuyBaseInResult {
  // Validate inputs
  if (base === 0n) throw new Error("Invalid input: 'base' cannot be zero")
  if (baseReserve === 0n || quoteReserve === 0n) {
    throw new Error('Invalid input: reserves cannot be zero')
  }
  if (base > baseReserve) {
    throw new Error('Cannot buy more base tokens than pool reserves')
  }

  // Calculate quote amount using constant product formula
  const numerator = quoteReserve * base
  const denominator = baseReserve - base
  if (denominator === 0n) throw new Error('Pool would be depleted')

  const quoteAmountIn = ceilDiv(numerator, denominator)

  // Calculate and apply fees
  const lpFee = calculateFee(quoteAmountIn, lpFeeBps)
  const protocolFee = calculateFee(quoteAmountIn, protocolFeeBps)
  const coinCreatorFee =
    coinCreator === SYSTEM_PROGRAM_ADDRESS ? 0n : calculateFee(quoteAmountIn, coinCreatorFeeBps)

  const totalQuote = quoteAmountIn + lpFee + protocolFee + coinCreatorFee

  // Apply slippage protection
  const slippageFactor = Math.floor((1 + slippage / 100) * 1_000_000_000)
  const maxQuote = (totalQuote * BigInt(slippageFactor)) / 1_000_000_000n

  return { internalQuoteAmount: quoteAmountIn, uiQuote: totalQuote, maxQuote }
}

/**
 * Computes the base amount that can be bought with a specific quote amount.
 * Reverses fee calculation to determine effective quote amount for swap.
 *
 * @param params - Parameters for the buy calculation
 * @param params.quote - Amount of quote tokens to spend
 * @param params.slippage - Slippage tolerance as percentage (e.g., 1 for 1%)
 * @param params.baseReserve - Current base token reserve in pool
 * @param params.quoteReserve - Current quote token reserve in pool
 * @param params.coinCreator - Address of coin creator (determines if creator fee applies)
 * @param params.coinCreatorFeeBps - Coin creator fee in basis points
 * @param params.lpFeeBps - LP fee in basis points
 * @param params.protocolFeeBps - Protocol fee in basis points
 *
 * @returns BuyQuoteInResult containing base amount and quote details
 * @throws Error if inputs are invalid or would result in negative output
 *
 * @example
 * ```typescript
 * const result = computeBuyQuoteIn({
 *   quote: 1000000n,     // Spend 1M quote tokens
 *   slippage: 1,         // 1% slippage
 *   baseReserve: 10000000n, // 10M base reserve
 *   quoteReserve: 5000000n, // 5M quote reserve
 *   coinCreator: creatorAddress
 * })
 * ```
 */
export function computeBuyQuoteIn({
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
}): BuyQuoteInResult {
  // Validate inputs
  if (quote === 0n) throw new Error("Invalid input: 'quote' cannot be zero")
  if (baseReserve === 0n || quoteReserve === 0n) {
    throw new Error('Invalid input: reserves cannot be zero')
  }

  // Calculate effective quote after fees
  const coinCreatorFee = coinCreator === SYSTEM_PROGRAM_ADDRESS ? 0n : coinCreatorFeeBps
  const totalFeeBps = lpFeeBps + protocolFeeBps + coinCreatorFee
  const effectiveQuote = (quote * 10_000n) / (10_000n + totalFeeBps)

  // Calculate base amount using constant product formula
  const numerator = baseReserve * effectiveQuote
  const denominator = quoteReserve + effectiveQuote
  if (denominator === 0n) throw new Error('Pool would be depleted')

  const baseAmountOut = numerator / denominator

  // Apply slippage protection
  const slippageFactor = Math.floor((1 + slippage / 100) * 1_000_000_000)
  const maxQuote = (quote * BigInt(slippageFactor)) / 1_000_000_000n

  return {
    base: baseAmountOut,
    internalQuoteWithoutFees: effectiveQuote,
    maxQuote,
  }
}
