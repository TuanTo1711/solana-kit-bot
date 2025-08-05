/**
 * @fileoverview CPMM (Constant Product Market Maker) calculation utilities for Raydium
 *
 * This module provides calculation functions for token swaps on Raydium CPMM pools,
 * including buy/sell operations with proper fee calculations and slippage protection.
 */

import { ceilDiv, floorDiv, subtractPercentage } from '@solana-kit-bot/core'
import { FEE_DENOMINATOR, FUND_FEE_RATE, PROTOCOL_FEE_RATE, TRADE_FEE_RATE } from '~/constants'

/**
 * Result interface for swap calculations
 */
export interface SwapResult {
  /** Amount of tokens received after swap */
  amountOut: bigint
  /** Minimum amount out with slippage protection */
  minimumAmountOut: bigint
  /** Trading fee charged */
  tradeFee: bigint
  /** Protocol fee charged */
  protocolFee: bigint
  /** Fund fee charged */
  fundFee: bigint
  /** Total fees charged */
  totalFees: bigint
  /** New reserve amount for input token */
  newReserveIn: bigint
  /** New reserve amount for output token */
  newReserveOut: bigint
  /** Price impact percentage (0-100) */
  priceImpact: number
  /** Effective price per unit */
  effectivePrice: bigint
}

/**
 * Computes base token input swap (selling base tokens for quote tokens)
 *
 * Calculates the output amount when swapping base tokens into the pool.
 * Uses constant product formula (x * y = k) with proper fee calculations and slippage protection.
 *
 * @param amountIn - Amount of base tokens to swap in
 * @param reserveIn - Current reserve of base tokens in pool
 * @param reserveOut - Current reserve of quote tokens in pool
 * @param slippageTolerance - Slippage tolerance percentage (default: 1.0 = 1%)
 * @param tradeFeeRate - Trading fee rate (default: TRADE_FEE_RATE)
 * @param protocolFeeRate - Protocol fee rate (default: PROTOCOL_FEE_RATE)
 * @param fundFeeRate - Fund fee rate (default: FUND_FEE_RATE)
 * @returns SwapResult containing output amount, slippage protection and comprehensive metrics
 *
 * @example
 * ```typescript
 * const result = computeBaseInSwap(
 *   1000000n, // 1 base token
 *   50000000000n, // 50k base tokens in reserve
 *   25000000000n, // 25k quote tokens in reserve
 *   1.0 // 1% slippage tolerance
 * )
 * console.log(`Receiving ${result.amountOut} quote tokens`)
 * console.log(`Minimum guaranteed: ${result.minimumAmountOut}`)
 * console.log(`Price impact: ${result.priceImpact}%`)
 * ```
 */
export function computeBaseInSwap(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  slippageTolerance: number = 1.0,
  tradeFeeRate: bigint = TRADE_FEE_RATE,
  protocolFeeRate: bigint = PROTOCOL_FEE_RATE,
  fundFeeRate: bigint = FUND_FEE_RATE
): SwapResult {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) {
    throw new Error('Invalid input: amounts and reserves must be positive')
  }

  // Calculate fees on input amount
  const tradeFee = ceilDiv(amountIn * tradeFeeRate, FEE_DENOMINATOR)
  const protocolFee = floorDiv(amountIn * protocolFeeRate, FEE_DENOMINATOR)
  const fundFee = floorDiv(amountIn * fundFeeRate, FEE_DENOMINATOR)
  const totalFees = tradeFee + protocolFee + fundFee

  // Amount after deducting trading fee (protocol and fund fees are separate)
  const amountInAfterTradeFee = amountIn - tradeFee

  // Apply constant product formula: (x + Δx) * (y - Δy) = x * y
  const invariant = reserveIn * reserveOut
  const newReserveIn = reserveIn + amountInAfterTradeFee
  const newReserveOut = floorDiv(invariant, newReserveIn)

  if (newReserveOut >= reserveOut) {
    throw new Error('Invalid swap: insufficient liquidity')
  }

  const amountOut = reserveOut - newReserveOut

  // Calculate price impact
  const currentPrice = floorDiv(reserveOut * 1000000n, reserveIn) // Price with 6 decimal precision
  const newPrice = floorDiv(newReserveOut * 1000000n, newReserveIn)
  const priceImpact = Number(((currentPrice - newPrice) * 10000n) / currentPrice) / 100

  // Calculate effective price (how much output per unit input)
  const effectivePrice = amountIn > 0n ? floorDiv(amountOut * 1000000n, amountIn) : 0n

  // Apply slippage protection
  const minimumAmountOut = subtractPercentage(amountOut, slippageTolerance)

  return {
    amountOut,
    minimumAmountOut,
    tradeFee,
    protocolFee,
    fundFee,
    totalFees,
    newReserveIn,
    newReserveOut,
    priceImpact,
    effectivePrice,
  }
}

/**
 * Computes buy amount when purchasing base tokens with quote tokens
 *
 * Calculates how many base tokens can be received when providing quote tokens.
 * This function swaps quote tokens (input) for base tokens (output) with slippage protection.
 *
 * @param quoteAmountIn - Amount of quote tokens to spend
 * @param baseReserve - Current reserve of base tokens in pool
 * @param quoteReserve - Current reserve of quote tokens in pool
 * @param slippageTolerance - Slippage tolerance percentage (default: 1.0 = 1%)
 * @param tradeFeeRate - Trading fee rate (default: TRADE_FEE_RATE)
 * @param protocolFeeRate - Protocol fee rate (default: PROTOCOL_FEE_RATE)
 * @param fundFeeRate - Fund fee rate (default: FUND_FEE_RATE)
 * @returns SwapResult containing base tokens received with slippage protection
 *
 * @example
 * ```typescript
 * const buyResult = computeBuyAmount(
 *   1000000n, // 1 USDC to spend
 *   50000000000n, // 50k base tokens in reserve
 *   25000000000n, // 25k USDC in reserve
 *   1.5 // 1.5% slippage tolerance
 * )
 * console.log(`Buying ${buyResult.amountOut} base tokens`)
 * console.log(`Guaranteed minimum: ${buyResult.minimumAmountOut}`)
 * console.log(`Price impact: ${buyResult.priceImpact}%`)
 * ```
 */
export function computeBuyAmount(
  quoteAmountIn: bigint,
  baseReserve: bigint,
  quoteReserve: bigint,
  slippageTolerance: number = 1.0,
  tradeFeeRate: bigint = TRADE_FEE_RATE,
  protocolFeeRate: bigint = PROTOCOL_FEE_RATE,
  fundFeeRate: bigint = FUND_FEE_RATE
): SwapResult {
  // When buying base tokens, we input quote tokens and output base tokens
  return computeBaseInSwap(
    quoteAmountIn,
    quoteReserve, // reserveIn = quote reserve
    baseReserve, // reserveOut = base reserve
    slippageTolerance,
    tradeFeeRate,
    protocolFeeRate,
    fundFeeRate
  )
}

/**
 * Computes sell amount when selling base tokens for quote tokens
 *
 * Calculates how many quote tokens can be received when providing base tokens.
 * This function provides slippage protection and comprehensive metrics for selling operations.
 *
 * @param baseAmountIn - Amount of base tokens to sell
 * @param baseReserve - Current reserve of base tokens in pool
 * @param quoteReserve - Current reserve of quote tokens in pool
 * @param slippageTolerance - Slippage tolerance percentage (default: 1.0 = 1%)
 * @param tradeFeeRate - Trading fee rate (default: TRADE_FEE_RATE)
 * @param protocolFeeRate - Protocol fee rate (default: PROTOCOL_FEE_RATE)
 * @param fundFeeRate - Fund fee rate (default: FUND_FEE_RATE)
 * @returns SwapResult containing quote tokens received with slippage protection
 *
 * @example
 * ```typescript
 * const sellResult = computeSellAmount(
 *   1000000n, // 1 base token to sell
 *   50000000000n, // 50k base tokens in reserve
 *   25000000000n, // 25k USDC in reserve
 *   2.0 // 2% slippage tolerance
 * )
 * console.log(`Selling for ${sellResult.amountOut} USDC`)
 * console.log(`Guaranteed minimum: ${sellResult.minimumAmountOut}`)
 * console.log(`Total fees: ${sellResult.totalFees}`)
 * console.log(`Price impact: ${sellResult.priceImpact}%`)
 * ```
 */
export function computeSellAmount(
  baseAmountIn: bigint,
  baseReserve: bigint,
  quoteReserve: bigint,
  slippageTolerance: number = 1.0,
  tradeFeeRate: bigint = TRADE_FEE_RATE,
  protocolFeeRate: bigint = PROTOCOL_FEE_RATE,
  fundFeeRate: bigint = FUND_FEE_RATE
): SwapResult {
  // When selling base tokens, we input base tokens and output quote tokens
  return computeBaseInSwap(
    baseAmountIn,
    baseReserve, // reserveIn = base reserve
    quoteReserve, // reserveOut = quote reserve
    slippageTolerance,
    tradeFeeRate,
    protocolFeeRate,
    fundFeeRate
  )
}

/**
 * Calculates the maximum amount that can be swapped given current liquidity
 *
 * @param reserveIn - Input token reserve
 * @param reserveOut - Output token reserve
 * @param maxPriceImpact - Maximum acceptable price impact percentage (default: 10%)
 * @returns Maximum swap amount that keeps price impact under threshold
 *
 * @example
 * ```typescript
 * const maxAmount = calculateMaxSwapAmount(
 *   50000000000n, // 50k base tokens
 *   25000000000n, // 25k quote tokens
 *   5.0 // 5% max price impact
 * )
 * console.log(`Max swap amount: ${maxAmount}`)
 * ```
 */
export function calculateMaxSwapAmount(
  reserveIn: bigint,
  reserveOut: bigint,
  maxPriceImpact: number = 10.0
): bigint {
  if (reserveIn <= 0n || reserveOut <= 0n) {
    throw new Error('Invalid reserves: must be positive')
  }

  // Binary search to find max amount that keeps price impact under threshold
  let low = 0n
  let high = reserveIn / 10n // Start with 10% of reserve as upper bound
  let result = 0n

  while (low <= high) {
    const mid = (low + high) / 2n

    try {
      const swapResult = computeBaseInSwap(mid, reserveIn, reserveOut, 0)

      if (swapResult.priceImpact <= maxPriceImpact) {
        result = mid
        low = mid + 1n
      } else {
        high = mid - 1n
      }
    } catch {
      high = mid - 1n
    }
  }

  return result
}

/**
 * Calculates required input amount to get specific output amount
 *
 * @param amountOut - Desired output amount
 * @param reserveIn - Input token reserve
 * @param reserveOut - Output token reserve
 * @param tradeFeeRate - Trading fee rate (default: TRADE_FEE_RATE)
 * @returns Required input amount to achieve desired output
 *
 * @example
 * ```typescript
 * const requiredInput = calculateRequiredInput(
 *   1000000n, // Want 1 USDC out
 *   50000000000n, // 50k base tokens in reserve
 *   25000000000n  // 25k USDC in reserve
 * )
 * console.log(`Need to input: ${requiredInput} base tokens`)
 * ```
 */
export function calculateRequiredInput(
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  tradeFeeRate: bigint = TRADE_FEE_RATE
): bigint {
  if (amountOut <= 0n || amountOut >= reserveOut) {
    throw new Error('Invalid output amount: must be positive and less than reserve')
  }

  const invariant = reserveIn * reserveOut
  const newReserveOut = reserveOut - amountOut
  const newReserveIn = ceilDiv(invariant, newReserveOut)
  const amountInAfterFee = newReserveIn - reserveIn

  // Add back the trading fee
  const amountIn = ceilDiv(amountInAfterFee * FEE_DENOMINATOR, FEE_DENOMINATOR - tradeFeeRate)

  return amountIn
}
