/**
 * Performs ceiling division on two BigInt values.
 *
 * Calculates the ceiling (round up) of the division a/b using BigInt arithmetic.
 *
 * @param a - Dividend (numerator)
 * @param b - Divisor (denominator), must be non-zero
 * @returns Ceiling of a/b
 * @throws {Error} When divisor b is zero
 */
export function ceilDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) {
    throw new Error('Division by zero')
  }
  return (a + b - 1n) / b
}

/**
 * Performs floor division on two BigInt values.
 *
 * Calculates the floor (round down) of the division a/b using BigInt arithmetic.
 *
 * @param a - Dividend (numerator)
 * @param b - Divisor (denominator), must be non-zero
 * @returns Floor of a/b
 * @throws {Error} When divisor b is zero
 */
export function floorDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) {
    throw new Error('Division by zero')
  }
  return a / b
}

/**
 * Converts a regular number to BigInt with specified decimal places.
 *
 * Multiplies the input value by 10^decimals to preserve decimal precision
 * in BigInt format. Commonly used for SOL amounts (9 decimals).
 *
 * @param value - The decimal number to convert
 * @param [decimals=9] - Number of decimal places (default: 9 for SOL)
 * @returns BigInt representation with decimal places preserved
 */
export function toBigInt(value: number, decimals = 9): bigint {
  const multiplier = 10 ** decimals
  return BigInt(Math.floor(value * multiplier))
}

/**
 * Converts BigInt to a decimal number with specified decimal places.
 *
 * Divides the BigInt value by 10^decimals to restore decimal representation.
 * Note: May lose precision for very large numbers due to JavaScript number limitations.
 *
 * @param value - BigInt value to convert
 * @param [decimals=9] - Number of decimal places (default: 9 for SOL)
 * @returns Decimal number representation
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
 * @throws Error if min > max
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
 */
export function absDiff(a: bigint, b: bigint): bigint {
  return a > b ? a - b : b - a
}

/**
 * Calculates square root of a BigInt using Newton's method
 *
 * @param value - Value to calculate square root for
 * @returns Integer square root (floor)
 * @throws Error if value is negative
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
 * Formats a number into abbreviated form (K, M, B, T, ...).
 *
 * Converts large numbers into human-readable format with appropriate suffixes.
 * Supports both number and bigint inputs with locale-specific formatting.
 *
 * @param value - Number to format (number or bigint)
 * @param [decimals=1] - Number of decimal places to display
 * @param [locale='en-US'] - Locale for formatting (e.g. 'en-US', 'vi-VN')
 * @returns Readable abbreviated string, e.g. 1.2K, 3.5M, 7B
 *
 * @example
 * ```typescript
 * abbreviateNumber(1234567) // '1.2M'
 * abbreviateNumber(1234567, 2, 'vi-VN') // '1,23M'
 * ```
 */
export function abbreviateNumber(
  value: number | bigint,
  decimals: number = 1,
  locale: string = 'en-US'
): string {
  const numb = Number(value)
  if (Number.isNaN(numb)) return String(value)

  const units: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ]

  for (const [threshold, suffix] of units) {
    if (Math.abs(numb) >= threshold) {
      const formatted = (numb / threshold).toLocaleString(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
      })
      return `${formatted}${suffix}`
    }
  }

  return numb.toLocaleString(locale)
}

/**
 * Interpolates between two BigInt values
 *
 * @param start - Starting value
 * @param end - Ending value
 * @param factor - Interpolation factor (0.0 to 1.0)
 * @returns Interpolated value
 */
export function interpolate(start: bigint, end: bigint, factor: number): bigint {
  const clampedFactor = Math.max(0, Math.min(1, factor))
  const diff = end - start
  const adjustment = toBigInt(Number(diff) * clampedFactor, 0)
  return start + adjustment
}
