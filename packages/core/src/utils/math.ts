/**
 * @fileoverview Mathematical utility functions for BigInt and precision calculations
 *
 * This module provides essential mathematical operations for Solana applications,
 * particularly for handling token amounts, price calculations, and precision-safe
 * arithmetic operations using BigInt.
 */

/**
 * Performs ceiling division on two BigInt values
 *
 * Calculates the ceiling of a/b, useful for determining minimum token amounts
 * or ensuring adequate buffer calculations.
 *
 * @param a - Dividend (numerator)
 * @param b - Divisor (denominator), must be non-zero
 * @returns Ceiling of a/b
 *
 * @throws Error if b is zero
 *
 * @example
 * ```typescript
 * const result = ceilDiv(100n, 30n) // Returns 4n (ceiling of 3.33...)
 * const tokens = ceilDiv(1000000n, 999999n) // Returns 2n for minimum tokens needed
 * ```
 */
export function ceilDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) {
    throw new Error('Division by zero')
  }
  return (a + b - 1n) / b
}

/**
 * Performs floor division on two BigInt values
 *
 * Calculates the floor of a/b, equivalent to regular BigInt division
 * but explicitly named for clarity in calculations.
 *
 * @param a - Dividend (numerator)
 * @param b - Divisor (denominator), must be non-zero
 * @returns Floor of a/b
 *
 * @throws Error if b is zero
 *
 * @example
 * ```typescript
 * const result = floorDiv(100n, 30n) // Returns 3n (floor of 3.33...)
 * const maxTokens = floorDiv(balance, tokenPrice) // Maximum tokens affordable
 * ```
 */
export function floorDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) {
    throw new Error('Division by zero')
  }
  return a / b
}

/**
 * Converts a regular number to BigInt with specified decimal places
 *
 * Useful for converting SOL amounts to lamports or token amounts to their
 * smallest unit representation.
 *
 * @param value - The decimal number to convert
 * @param decimals - Number of decimal places (default: 9 for SOL)
 * @returns BigInt representation with decimal places
 *
 * @example
 * ```typescript
 * const lamports = toBigInt(0.5, 9) // Returns 500000000n (0.5 SOL in lamports)
 * const usdcAmount = toBigInt(100.50, 6) // Returns 100500000n (100.50 USDC)
 * ```
 */
export function toBigInt(value: number, decimals = 9): bigint {
  const multiplier = 10 ** decimals
  return BigInt(Math.floor(value * multiplier))
}

/**
 * Converts BigInt to a decimal number with specified decimal places
 *
 * Useful for displaying token amounts in human-readable format.
 * Note: May lose precision for very large numbers due to JavaScript number limitations.
 *
 * @param value - BigInt value to convert
 * @param decimals - Number of decimal places (default: 9 for SOL)
 * @returns Decimal number representation
 *
 * @example
 * ```typescript
 * const sol = fromBigInt(500000000n, 9) // Returns 0.5 (0.5 SOL)
 * const usdc = fromBigInt(100500000n, 6) // Returns 100.5 (100.50 USDC)
 * ```
 */
export function fromBigInt(value: bigint, decimals = 9): number {
  const divisor = 10 ** decimals
  return Number(value) / divisor
}

/**
 * Calculates percentage of a BigInt value
 *
 * @param value - Base value
 * @param percentage - Percentage as a number (e.g., 10 for 10%)
 * @returns Calculated percentage as BigInt
 *
 * @example
 * ```typescript
 * const fee = percentageOf(1000000n, 0.5) // Returns 5000n (0.5% fee)
 * const slippage = percentageOf(tokenAmount, 2) // Returns 2% slippage amount
 * ```
 */
export function percentageOf(value: bigint, percentage: number): bigint {
  return (value * BigInt(Math.floor(percentage * 10000))) / 1000000n
}

/**
 * Adds percentage to a BigInt value
 *
 * @param value - Base value
 * @param percentage - Percentage to add (e.g., 5 for 5% increase)
 * @returns Value increased by percentage
 *
 * @example
 * ```typescript
 * const withSlippage = addPercentage(tokenAmount, 1) // Add 1% slippage
 * const withTip = addPercentage(baseAmount, 0.1) // Add 0.1% tip
 * ```
 */
export function addPercentage(value: bigint, percentage: number): bigint {
  return value + percentageOf(value, percentage)
}

/**
 * Subtracts percentage from a BigInt value
 *
 * @param value - Base value
 * @param percentage - Percentage to subtract (e.g., 5 for 5% decrease)
 * @returns Value decreased by percentage
 *
 * @example
 * ```typescript
 * const afterFee = subtractPercentage(amount, 0.25) // Subtract 0.25% fee
 * const minAmount = subtractPercentage(tokenAmount, 2) // Subtract 2% slippage
 * ```
 */
export function subtractPercentage(value: bigint, percentage: number): bigint {
  return value - percentageOf(value, percentage)
}

/**
 * Returns the minimum of two BigInt values
 *
 * @param a - First value
 * @param b - Second value
 * @returns Smaller of the two values
 *
 * @example
 * ```typescript
 * const maxAffordable = minBigInt(balance, maxTokens)
 * const safeAmount = minBigInt(requestedAmount, availableLiquidity)
 * ```
 */
export function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b
}

/**
 * Returns the maximum of two BigInt values
 *
 * @param a - First value
 * @param b - Second value
 * @returns Larger of the two values
 *
 * @example
 * ```typescript
 * const minimumFee = maxBigInt(calculatedFee, minimumFeeRequired)
 * const betterPrice = maxBigInt(currentPrice, reservePrice)
 * ```
 */
export function maxBigInt(a: bigint, b: bigint): bigint {
  return a > b ? a : b
}

/**
 * Clamps a BigInt value between minimum and maximum bounds
 *
 * @param value - Value to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Clamped value
 *
 * @throws Error if min > max
 *
 * @example
 * ```typescript
 * const safeAmount = clampBigInt(userInput, 1000n, 1000000n)
 * const validSlippage = clampBigInt(slippage, 0n, 10000n) // 0-100%
 * ```
 */
export function clampBigInt(value: bigint, min: bigint, max: bigint): bigint {
  if (min > max) {
    throw new Error('Minimum value cannot be greater than maximum value')
  }
  return maxBigInt(min, minBigInt(value, max))
}

/**
 * Calculates the absolute difference between two BigInt values
 *
 * @param a - First value
 * @param b - Second value
 * @returns Absolute difference |a - b|
 *
 * @example
 * ```typescript
 * const priceGap = absDiff(bidPrice, askPrice)
 * const slippageAmount = absDiff(expectedPrice, actualPrice)
 * ```
 */
export function absDiff(a: bigint, b: bigint): bigint {
  return a > b ? a - b : b - a
}

/**
 * Calculates square root of a BigInt using Newton's method
 *
 * @param value - Value to calculate square root for
 * @returns Integer square root (floor)
 *
 * @throws Error if value is negative
 *
 * @example
 * ```typescript
 * const root = sqrtBigInt(1000000n) // Returns 1000n
 * const geometricMean = sqrtBigInt(a * b) // Geometric mean of two values
 * ```
 */
export function sqrtBigInt(value: bigint): bigint {
  if (value < 0n) {
    throw new Error('Cannot calculate square root of negative number')
  }

  if (value === 0n) return 0n
  if (value === 1n) return 1n

  let x = value
  let y = (x + 1n) / 2n

  while (y < x) {
    x = y
    y = (x + value / x) / 2n
  }

  return x
}

/**
 * Formats a BigInt value as a string with decimal places for display
 *
 * @param value - BigInt value to format
 * @param decimals - Number of decimal places
 * @param precision - Number of decimal places to display (default: 6)
 * @returns Formatted string representation
 *
 * @example
 * ```typescript
 * const formatted = formatBigInt(1500000000n, 9, 4) // "1.5000 SOL"
 * const price = formatBigInt(123456789n, 6, 2) // "123.46 USDC"
 * ```
 */
export function formatBigInt(value: bigint, decimals: number, precision = 6): string {
  const divisor = BigInt(10 ** decimals)
  const wholePart = value / divisor
  const fractionalPart = value % divisor

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0')
  const trimmedFractional = fractionalStr.slice(0, precision).replace(/0+$/, '') || '0'

  return `${wholePart}.${trimmedFractional}`
}

/**
 * Interpolates between two BigInt values
 *
 * @param start - Starting value
 * @param end - Ending value
 * @param factor - Interpolation factor (0.0 to 1.0)
 * @returns Interpolated value
 *
 * @example
 * ```typescript
 * const midPrice = interpolate(minPrice, maxPrice, 0.5) // 50% between min and max
 * const gradualIncrease = interpolate(currentAmount, targetAmount, 0.1) // 10% towards target
 * ```
 */
export function interpolate(start: bigint, end: bigint, factor: number): bigint {
  const clampedFactor = Math.max(0, Math.min(1, factor))
  const diff = end - start
  const adjustment = toBigInt(Number(diff) * clampedFactor, 0)
  return start + adjustment
}
