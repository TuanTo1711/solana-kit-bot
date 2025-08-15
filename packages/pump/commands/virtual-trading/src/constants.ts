/**
 * @fileoverview Constants used throughout the virtual trading system
 */

/** Amount of SOL to transfer to each virtual wallet for trading */
export const TRANSFER_AMOUNT_SOL: number = 0.005 as const

/** Number of lamports per SOL */
export const LAMPORTS_PER_SOL: number = 10 ** 9

/** Estimated transaction fee in lamports */
export const TRANSACTION_FEE: number = 10000 as const

/** Timeout for pool data initialization in milliseconds */
export const POOL_DATA_TIMEOUT: number = 30000 as const

/** Default encoding for transaction bundles */
export const DEFAULT_BUNDLE_ENCODING = 'base64' as const

/** Maximum number of virtual wallets allowed */
export const MAX_VIRTUAL_WALLETS = 4 as const

/** Minimum number of virtual wallets required */
export const MIN_VIRTUAL_WALLETS = 1 as const

/** Default tip amount in SOL */
export const DEFAULT_TIP_SOL = 0.00001 as const

/** Minimum tip amount in lamports */
export const MIN_TIP_LAMPORTS = 1000n as const

/** RPC subscription commitment level */
export const RPC_COMMITMENT = 'confirmed' as const

/** Default account data encoding */
export const ACCOUNT_DATA_ENCODING = 'base64' as const

/** Memory optimization: max concurrent pool subscriptions */
export const MAX_POOL_SUBSCRIPTIONS = 2 as const

/** Performance: bundle processing timeout */
export const BUNDLE_TIMEOUT_MS = 10000 as const

/** Retry configuration */
export const MAX_RETRY_ATTEMPTS = 3 as const
export const RETRY_DELAY_MS = 1000 as const

/** Default performance monitoring interval */
export const PERFORMANCE_LOG_INTERVAL_MS = 30000 as const
