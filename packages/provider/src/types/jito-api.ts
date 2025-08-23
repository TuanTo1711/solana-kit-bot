import {
  createJsonRpcApi,
  type Base64EncodedWireTransaction,
  type Commitment,
  type RpcApi,
  type RpcResponseData,
  type SendTransactionApi,
  type Signature,
  type Slot,
  type SolanaRpcResponse,
} from '@solana/kit'
import type { Observable } from 'rxjs'

/**
 * Represents the status of a bundle that is currently in-flight or being processed.
 */
export enum InflightBundleStatus {
  /** Bundle ID not in the system (5 minute look back) */
  Invalid,
  /** Not failed, not landed, not invalid */
  Pending,
  /** All regions that received the bundle marked it as failed and it hasn't been forwarded */
  Failed,
  /** Landed on-chain (determined using RPC or bundles_landed table) */
  Landed,
}

/**
 * Available Jito block engine endpoints by region.
 * These endpoints provide different geographic locations to optimize latency.
 */
export const BLOCK_ENGINE_URL = {
  Mainnet: 'https://mainnet.block-engine.jito.wtf',
  Amsterdam: 'https://amsterdam.mainnet.block-engine.jito.wtf',
  Frankfurt: 'https://frankfurt.mainnet.block-engine.jito.wtf',
  London: 'https://london.mainnet.block-engine.jito.wtf',
  NewYork: 'https://ny.mainnet.block-engine.jito.wtf',
  SaltLakeCity: 'https://slc.mainnet.block-engine.jito.wtf',
  Singapore: 'https://singapore.mainnet.block-engine.jito.wtf',
  Tokyo: 'https://tokyo.mainnet.block-engine.jito.wtf',
} as const

/**
 * Union type of available Jito region names.
 */
export type JitoRegion = keyof typeof BLOCK_ENGINE_URL

/**
 * Union type of available Jito block engine endpoint URLs.
 */
export type JitoEndpoint = (typeof BLOCK_ENGINE_URL)[JitoRegion]

/**
 * Represents the status of a bundle that has been processed or is being processed.
 */
export type BundleStatus = {
  /** Unique bundle identifier */
  bundle_id: string
  /** A list of base-58 encoded signatures applied by the bundle. The list will not be empty. */
  transactions?: string[]
  /** The slot this bundle was processed in. */
  slot: Slot
  /** The bundle transaction's cluster confirmation status; either processed, confirmed, or finalized.
   *
   * @see Commitment for more on optimistic confirmation.
   */
  confirmation_status?: Commitment
  /**
   * This will show any retryable or non-retryable error encountered when getting the bundle status.
   * If retryable, please query again.
   */
  err?: object
}

/**
 * Represents a valid in-flight bundle status with a defined status and slot information.
 */
export type ValidInflightBundleStatus = {
  /** Unique bundle identifier */
  bundle_id: string
  /**
   * Invalid: Bundle ID not in our system (5 minute look back).
   * Pending: Not failed, not landed, not invalid.
   * Failed: All regions that have received the bundle have marked it as failed and it hasn't been forwarded.
   * Landed: Landed on-chain (determined using RPC or bundles_landed table).
   */
  status: InflightBundleStatus
  /** The slot this bundle landed in, otherwise null if it is Invalid. */
  landed_slot: Slot
}

/**
 * Represents an invalid in-flight bundle status where the bundle ID is not found in the system.
 */
export type InvalidInflightBundleStatus = {
  /** Unique bundle identifier */
  bundle_id: string
  /**
   * Invalid: Bundle ID not in our system (5 minute look back).
   * Pending: Not failed, not landed, not invalid.
   * Failed: All regions that have received the bundle have marked it as failed and it hasn't been forwarded.
   * Landed: Landed on-chain (determined using RPC or bundles_landed table).
   */
  status: InflightBundleStatus.Invalid
  /** The slot this bundle landed in, otherwise null if it is Invalid. */
  landed_slot: null
}

/**
 * API interface for sending individual transactions through Jito.
 */
export type JitoSendTransactionApi = {
  /**
   * Sends a single transaction through the Jito block engine.
   *
   * @param transaction - Base64 encoded wire transaction
   * @param config - Optional configuration parameters
   * @returns Transaction signature
   */
  sendTransaction(
    transaction: Base64EncodedWireTransaction,
    config?: Parameters<SendTransactionApi['sendTransaction']>[1]
  ): Signature
}

/**
 * API interface for sending transaction bundles through Jito.
 */
export type SendBundleApi = {
  /**
   * Sends a bundle of transactions to be processed atomically.
   *
   * @param transaction - Array of base64 encoded wire transactions
   * @param config - Configuration parameters for the bundle
   * @returns Bundle identifier string
   */
  sendBundle(
    transaction: Base64EncodedWireTransaction[],
    config: Parameters<SendTransactionApi['sendTransaction']>[1]
  ): string
}

/**
 * API interface for retrieving bundle status information.
 */
export type GetBundleStatusesApi = {
  /**
   * Retrieves the status of multiple bundles.
   *
   * @param bundleIds - Array of bundle identifiers to query
   * @returns RPC response containing bundle status information
   */
  getBundleStatuses(bundleIds: string[]): SolanaRpcResponse<BundleStatus> | null
}

/**
 * API interface for retrieving tip accounts that can be used for MEV payments.
 */
export type GetTipAccountsApi = {
  /**
   * Retrieves the list of tip accounts that can receive MEV payments.
   *
   * @returns Array of tip account addresses
   */
  getTipAccounts(): string[]
}

/**
 * API interface for retrieving in-flight bundle status information.
 */
export type GetInflightBundleStatusesApi = {
  /**
   * Retrieves the current status of bundles that are in-flight or being processed.
   *
   * @param bundleIds - Array of bundle identifiers to query
   * @returns RPC response containing in-flight bundle status information
   */
  getInflightBundleStatuses(
    bundleIds: string[]
  ): SolanaRpcResponse<ValidInflightBundleStatus | InvalidInflightBundleStatus>
}
/**
 * Response type for tip floor data containing historical and statistical information
 * about landed tips on the Jito network.
 */
export type TipFloorResponse = {
  /** Timestamp when the tip floor data was collected */
  time: string
  /** 25th percentile of landed tips in lamports */
  landed_tips_25th_percentile: number
  /** 50th percentile (median) of landed tips in lamports */
  landed_tips_50th_percentile: number
  /** 75th percentile of landed tips in lamports */
  landed_tips_75th_percentile: number
  /** 95th percentile of landed tips in lamports */
  landed_tips_95th_percentile: number
  /** 99th percentile of landed tips in lamports */
  landed_tips_99th_percentile: number
  /** Exponential moving average of the 50th percentile of landed tips in lamports */
  ema_landed_tips_50th_percentile: number
}

/**
 * API interface for retrieving tip floor information.
 * The tip floor represents statistical data about tips that have successfully landed,
 * helping users determine appropriate tip amounts for their transactions.
 */
export type GetTipFloorApi = {
  /**
   * Retrieves the current tip floor data containing percentile statistics
   * of recently landed tips.
   *
   * @returns Promise resolving to an array containing tip floor response data
   */
  getTipFloor(): Promise<TipFloorResponse>
}

/**
 * API interface for streaming real-time tip floor data.
 * Provides continuous updates on tip statistics through an observable stream.
 */
export type TipStream = {
  /**
   * Creates a stream of real-time tip floor data updates.
   * Returns an observable that emits tip floor responses as they become available.
   *
   * @returns Promise resolving to an Observable that emits TipFloorResponse data
   */
  tipStream(): Promise<Observable<TipFloorResponse>>
}

export type SendShakingBundle = {
  sendShakingBundle(
    transaction: Base64EncodedWireTransaction[],
    config: Parameters<SendTransactionApi['sendTransaction']>[1]
  ): Promise<string>
}

/**
 * Complete Jito API interface combining all available operations.
 * Provides access to transaction sending, bundle management, status queries, and tip account information.
 */
export type JitoApi = JitoSendTransactionApi &
  GetBundleStatusesApi &
  SendBundleApi &
  GetTipAccountsApi &
  GetInflightBundleStatusesApi

export type JitoRpc = RpcApi<JitoApi>

const responseTransformer = <T>(res: unknown) => {
  const response = res as RpcResponseData<T>
  if ('error' in response) {
    return response.error
  }

  return response.result
}

export const JITO_API: JitoRpc = {
  sendTransaction: createJsonRpcApi<JitoSendTransactionApi>().sendTransaction,
  sendBundle: createJsonRpcApi<SendBundleApi>().sendBundle,
  getBundleStatuses: createJsonRpcApi<GetBundleStatusesApi>({ responseTransformer })
    .getBundleStatuses,
  getTipAccounts: createJsonRpcApi<GetTipAccountsApi>({ responseTransformer }).getTipAccounts,
  getInflightBundleStatuses: createJsonRpcApi<GetInflightBundleStatusesApi>({ responseTransformer })
    .getInflightBundleStatuses,
}
