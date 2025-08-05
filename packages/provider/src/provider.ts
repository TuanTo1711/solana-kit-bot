import {
  createDefaultRpcTransport,
  createJsonRpcApi,
  createRpc,
  createSolanaRpcApi,
  createSolanaRpcSubscriptions,
  mainnet,
  type Commitment,
  type Rpc,
  type RpcResponseData,
  type RpcSubscriptions,
  type SolanaRpcApiMainnet,
  type SolanaRpcSubscriptionsApi,
} from '@solana/kit'

import {
  randomSenderEndpoint,
  type GetTipFloorApi,
  type JitoApi,
  type PriorityFeeApi,
  type SenderApi,
  type SenderEndpoint,
  type SendShakingBundle,
  type TipStream,
} from '~/types'

import { createAdvanceRpcSubscriptions } from './advance-rpc-subscriptions'
import { createJitoRpc } from './jito'

/**
 * Configuration options for creating a Solana provider.
 */
export type ProviderConfig = Readonly<{
  /** Helius API key for accessing RPC services */
  apiKey: string
  /** Default commitment level for transactions */
  commitment: Commitment
  senderUrl?: SenderEndpoint
  /** Optional Jito configuration for MEV protection */
  jito?: {
    /** Jito block engine URL */
    url?: string
    /** Optional Jito UUID for tracking */
    uuid?: string
  }
}>

/**
 * Complete Solana provider with RPC, subscriptions, sender, and Jito capabilities.
 */
export type Provider = {
  /** Main RPC client for Solana network operations */
  rpc: Rpc<SolanaRpcApiMainnet & PriorityFeeApi>
  /** WebSocket subscriptions for real-time updates */
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>
  advanceSubscriptions: ReturnType<typeof createAdvanceRpcSubscriptions>
  /** Fast transaction sender service */
  sender: Rpc<SenderApi>
  /** Jito MEV protection service */
  jito: Rpc<JitoApi> & GetTipFloorApi & TipStream & SendShakingBundle
}

/**
 * Creates a comprehensive Solana provider with optimized RPC, sender, and Jito services.
 *
 * @param config - Provider configuration including API key and options
 * @returns Complete provider instance with all necessary services
 *
 * @example
 * ```typescript
 * const provider = createProvider({
 *   apiKey: 'your-helius-api-key',
 *   commitment: 'confirmed',
 *   jito: {
 *     url: 'https://singapore.jito.wtf',
 *     uuid: 'optional-tracking-uuid'
 *   }
 * })
 *
 * // Use the provider
 * const balance = await provider.rpc.getBalance(address).send()
 * const signature = await provider.sender.sendTransaction(params).send()
 * ```
 */
export const createProvider = (config: ProviderConfig): Provider => {
  /**
   * Creates the main RPC client with Helius API and priority fee support.
   * Uses the provided API key and commitment level for all requests.
   */
  function getRpc(): Rpc<SolanaRpcApiMainnet & PriorityFeeApi> {
    const api = createSolanaRpcApi<SolanaRpcApiMainnet & PriorityFeeApi>({
      defaultCommitment: config.commitment,
    })
    const transport = createDefaultRpcTransport({
      url: mainnet(`https://mainnet.helius-rpc.com/?api-key=${config.apiKey}`),
    })

    return createRpc({ api, transport })
  }

  /**
   * Creates the sender RPC client using a randomly selected endpoint for optimal performance.
   * The sender service provides fast transaction submission without retries.
   */
  function getSender(): Rpc<SenderApi> {
    const api = createJsonRpcApi<SenderApi>({
      responseTransformer: res => {
        const response = res as RpcResponseData<string>
        if ('error' in response) {
          return response.error
        }

        return response.result
      },
    })
    const transport = createDefaultRpcTransport({
      url: mainnet(config.senderUrl ?? randomSenderEndpoint()),
    })

    return createRpc({ api, transport })
  }

  // Create all service instances
  const rpc = getRpc()
  const rpcSubscriptions = createSolanaRpcSubscriptions(
    mainnet(`wss://mainnet.helius-rpc.com/?api-key=${config.apiKey}`)
  )
  const sender = getSender()
  const jito = createJitoRpc(config.jito?.url, config.jito?.uuid)
  const advanceSubscriptions = createAdvanceRpcSubscriptions(rpc, rpcSubscriptions)

  return { rpc, rpcSubscriptions, sender, jito, advanceSubscriptions }
}
