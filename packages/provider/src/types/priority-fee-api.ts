/**
 * Priority levels for Solana transaction fees, ranging from minimum to unsafe maximum.
 */
export type PriorityLevel = 'Min' | 'Low' | 'Medium' | 'High' | 'VeryHigh' | 'UnsafeMax'

/**
 * Parameters for priority fee estimation using a transaction.
 */
export type PriorityFeeParamsWithTransaction = {
  /** The transaction string to analyze */
  transaction: string
}

/**
 * Parameters for priority fee estimation using account keys.
 */
export type PriorityFeeParamsWithAccountKeys = {
  /** Array of account keys to analyze */
  accountKeys: string[]
}

/**
 * Common options for priority fee estimation.
 */
export type CommonPriorityFeeOptions = {
  /** Encoding format for the transaction. Defaults to base58. */
  transactionEncoding?: 'base58' | 'base64'
  /** Whether to treat empty slots as zero priority fee. Defaults to false. */
  evaluateEmptySlotAsZero?: boolean
}

/**
 * Advanced options for priority fee estimation.
 */
export type AdvancedPriorityFeeOptions = {
  /** Specific priority level to target for fee estimation */
  priorityLevel?: PriorityLevel
  /** Number of recent slots to analyze for fee estimation */
  lookbackSlots?: number
  /** Whether to include vote transactions in the analysis */
  includeVote?: boolean
}

/**
 * Response containing a single priority fee estimate.
 */
export type SingleEstimateResponse = {
  /** The estimated priority fee in lamports */
  priorityFeeEstimate: bigint
}

/**
 * Response containing priority fee estimates for all levels.
 */
export type AllLevelsEstimateResponse = {
  /** Minimum priority fee estimate in lamports */
  min: number
  /** Low priority fee estimate in lamports */
  low: number
  /** Medium priority fee estimate in lamports */
  medium: number
  /** High priority fee estimate in lamports */
  high: number
  /** Very high priority fee estimate in lamports */
  veryHigh: number
  /** Unsafe maximum priority fee estimate in lamports */
  unsafeMax: number
}

/**
 * API interface for getting priority fee estimates for Solana transactions.
 */
export type PriorityFeeApi = {
  /**
   * Get a recommended priority fee estimate for a transaction.
   * @param params - Parameters containing the transaction and options
   * @returns Single priority fee estimate
   */
  getPriorityFeeEstimate(
    params: PriorityFeeParamsWithTransaction & {
      options?: { recommended: true } & CommonPriorityFeeOptions
    }
  ): SingleEstimateResponse

  /**
   * Get a single priority fee estimate for a transaction with custom options.
   * @param params - Parameters containing the transaction and options
   * @returns Single priority fee estimate
   */
  getPriorityFeeEstimate(
    params: PriorityFeeParamsWithTransaction & {
      options?: { includeAllPriorityFeeLevels: false } & CommonPriorityFeeOptions &
        AdvancedPriorityFeeOptions
    }
  ): SingleEstimateResponse

  /**
   * Get priority fee estimates for all levels for a transaction.
   * @param params - Parameters containing the transaction and options
   * @returns Priority fee estimates for all levels
   */
  getPriorityFeeEstimate(
    params: PriorityFeeParamsWithTransaction & {
      options?: { includeAllPriorityFeeLevels: true } & CommonPriorityFeeOptions &
        AdvancedPriorityFeeOptions
    }
  ): AllLevelsEstimateResponse

  /**
   * Get a recommended priority fee estimate for account keys.
   * @param params - Parameters containing the account keys and options
   * @returns Single priority fee estimate
   */
  getPriorityFeeEstimate(
    params: PriorityFeeParamsWithAccountKeys & {
      options?: { recommended: true } & CommonPriorityFeeOptions
    }
  ): SingleEstimateResponse

  /**
   * Get a single priority fee estimate for account keys with custom options.
   * @param params - Parameters containing the account keys and options
   * @returns Single priority fee estimate
   */
  getPriorityFeeEstimate(
    params: PriorityFeeParamsWithAccountKeys & {
      options?: { includeAllPriorityFeeLevels: false } & CommonPriorityFeeOptions &
        AdvancedPriorityFeeOptions
    }
  ): SingleEstimateResponse

  /**
   * Get priority fee estimates for all levels for account keys.
   * @param params - Parameters containing the account keys and options
   * @returns Priority fee estimates for all levels
   */
  getPriorityFeeEstimate(
    params: PriorityFeeParamsWithAccountKeys & {
      options?: { includeAllPriorityFeeLevels: true } & CommonPriorityFeeOptions &
        AdvancedPriorityFeeOptions
    }
  ): AllLevelsEstimateResponse
}
