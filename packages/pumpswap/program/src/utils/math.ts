import { MAX_FEE_BASIS_POINTS } from '~/constant'

/**
 * Performs ceiling division on two bigint values.
 *
 * @param a - The dividend
 * @param b - The divisor
 * @returns The ceiling of a divided by b
 * @throws Error if divisor is zero
 *
 * @example
 * ```typescript
 * ceilDiv(7n, 3n) // returns 3n
 * ceilDiv(10n, 2n) // returns 5n
 * ```
 */
export function ceilDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error('Cannot divide by zero')
  return (a + b - 1n) / b
}

/**
 * Calculates a fee amount based on a percentage specified in basis points.
 *
 * @param amount - The base amount to calculate fee from
 * @param basisPoints - Fee percentage in basis points (e.g., 100 = 1%)
 * @returns The fee amount rounded up to nearest whole unit
 *
 * @example
 * ```typescript
 * calculateFee(1000n, 100n) // returns 10n (1% of 1000)
 * calculateFee(1000n, 50n) // returns 5n (0.5% of 1000)
 * ```
 */
export function calculateFee(amount: bigint, basisPoints: bigint): bigint {
  return ceilDiv(amount * basisPoints, 10_000n)
}

/**
 * Calculates the raw quote amount needed before fees to achieve a desired output amount.
 *
 * This function reverses the fee calculation to determine how much quote tokens
 * are needed before fees to receive the desired amount after all fees are deducted.
 *
 * @param userQuoteAmountOut - Desired quote amount after all fees
 * @param lpFeeBasisPoints - LP fee in basis points
 * @param protocolFeeBasisPoints - Protocol fee in basis points
 * @param coinCreatorFeeBasisPoints - Coin creator fee in basis points
 * @returns The raw quote amount needed before fees
 *
 * @example
 * ```typescript
 * // To receive 1000 quote tokens after 1% total fees
 * calculateQuoteAmountOut(1000n, 50n, 30n, 20n) // returns ~1010n
 * ```
 */
export function calculateQuoteAmountOut(
  userQuoteAmountOut: bigint,
  lpFeeBasisPoints: bigint,
  protocolFeeBasisPoints: bigint,
  coinCreatorFeeBasisPoints: bigint
): bigint {
  const totalFeeBasisPoints = lpFeeBasisPoints + protocolFeeBasisPoints + coinCreatorFeeBasisPoints
  const denominator = MAX_FEE_BASIS_POINTS - totalFeeBasisPoints
  return ceilDiv(userQuoteAmountOut * MAX_FEE_BASIS_POINTS, denominator)
}
