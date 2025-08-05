import {
  address,
  type Address,
  type Base64EncodedWireTransaction,
  type Signature,
} from '@solana/kit'

/**
 * Pre-configured tip accounts for the Sender service.
 * These accounts are used to distribute tips across the network.
 */
export const SENDER_TIP_ACCOUNTS = [
  address('4ACfpUFoaSD9bfPdeu6DBt89gB6ENTeHBXCAi87NhDEE'),
  address('D2L6yPZ2FmmmTKPgzaMKdhu6EWZcTpLy1Vhx8uvZe7NZ'),
  address('9bnz4RShgq1hAnLnZbP8kbgBg1kEmcJBYQq3gQbmnSta'),
  address('5VY91ws6B2hMmBFRsXkoAAdsPHBJwRfBht4DXox3xkwn'),
  address('2nyhqdwKcJZR2vcqCyrYsaPVdAnFoJjiksCXJ7hfEYgD'),
  address('2q5pghRs6arqVjRvT5gfgWfWcHWmw1ZuCzphgd5KfWGJ'),
  address('wyvPkWjVZz1M8fHQnMMCDTQDbkManefNNhweYk5WkcF'),
  address('3KCKozbAaF75qEU33jtzozcJ29yJuaLJTy2jFdzUY8bT'),
  address('4vieeGHPYPG2MmyPRcYjdiDmmhN3ww7hsFNap8pVN3Ey'),
  address('4TQLFNWK8AovT1gFvda5jfw2oJeRMKEmw7aH6MGBJ3or'),
] as const satisfies Address[]

/**
 * Type representing any of the available sender tip accounts.
 */
export type SenderTipAccount = (typeof SENDER_TIP_ACCOUNTS)[number]

/**
 * Returns a randomly selected tip account from the available sender tip accounts.
 * @returns A random sender tip account address
 */
export const randomSenderAccount = (): SenderTipAccount =>
  SENDER_TIP_ACCOUNTS[Math.floor(Math.random() * SENDER_TIP_ACCOUNTS.length)]!

/**
 * Available Sender service endpoints organized by geographic region.
 * Each endpoint provides fast transaction submission for its respective region.
 */
export const SENDER_ENPOINTS = {
  SaltLakeCity: 'http://slc-sender.helius-rpc.com/fast',
  Newark: 'http://ewr-sender.helius-rpc.com/fast',
  London: 'http://lon-sender.helius-rpc.com/fast',
  Frankfurt: 'http://fra-sender.helius-rpc.com/fast',
  Amsterdam: 'http://ams-sender.helius-rpc.com/fast',
  Singapore: 'http://sg-sender.helius-rpc.com/fast',
  Tokyo: 'http://tyo-sender.helius-rpc.com/fast',
} as const

/**
 * Type representing the available sender regions.
 */
export type SenderRegion = keyof typeof SENDER_ENPOINTS

/**
 * Type representing any of the available sender endpoint URLs.
 */
export type SenderEndpoint = (typeof SENDER_ENPOINTS)[SenderRegion]

/**
 * Returns a randomly selected sender endpoint from the available regions.
 * @returns A random sender endpoint URL
 */
export const randomSenderEndpoint = (): SenderEndpoint =>
  Object.values(SENDER_ENPOINTS)[
    Math.floor(Math.random() * Object.values(SENDER_ENPOINTS).length)
  ] as SenderEndpoint

/**
 * Configuration options for sender transaction submission.
 * These options are optimized for fast transaction processing.
 */
export type SenderTransactionOptions = {
  /** Encoding format for the transaction data */
  encoding: 'base64'
  /** Skip preflight checks to speed up submission */
  skipPreflight: true
  /** Number of retry attempts (disabled for speed) */
  maxRetries: 0
}

/**
 * API interface for the Sender transaction submission service.
 */
export type SenderTransactionApi = {
  /**
   * Submits a transaction to the Solana network via the Sender service.
   * @param params - Transaction parameters including the encoded transaction
   * @param options - Optional configuration for transaction submission
   * @returns The transaction signature upon successful submission
   */
  sendTransaction(
    transaction: Base64EncodedWireTransaction,
    options?: Readonly<SenderTransactionOptions>
  ): Signature
}

export type SenderApi = SenderTransactionApi
