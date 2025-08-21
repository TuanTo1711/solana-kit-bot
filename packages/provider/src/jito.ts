import {
  createDefaultRpcTransport,
  createRpc,
  mainnet,
  type MainnetUrl,
  type Rpc,
  type RpcTransport,
} from '@solana/kit'
import { randomUUID } from 'crypto'
import { catchError, map, of, shareReplay, startWith, type Observable } from 'rxjs'
import { WebSocketSubject } from 'rxjs/webSocket'

import {
  BLOCK_ENGINE_URL,
  JITO_API,
  type GetTipFloorApi,
  type JitoApi,
  type SendShakingBundle,
  type TipFloorResponse,
  type TipStream,
} from './types'

/**
 * Creates a Jito RPC client with optimized method-specific routing.
 *
 * This function sets up a Jito RPC client that efficiently manages connections by:
 * - Automatically routing requests to method-specific endpoints
 * - Supporting optional UUID for request tracking
 *
 * @param url - The base URL for the Jito RPC endpoints
 * @param uuid - Optional UUID for request tracking and identification
 * @returns A configured JitoRpc client with all available API methods
 *
 * @example
 * ```typescript
 * const jitoRpc = createJitoRpc('https://api.jito.wtf', 'my-uuid-123')
 *
 * // Send a bundle
 * const bundleResult = await jitoRpc.sendBundle({
 *   encodedTransactions: [...],
 * }).send()
 *
 * // Get tip accounts
 * const tipAccounts = await jitoRpc.getTipAccounts().send()
 * ```
 */
export const createJitoRpc = (
  url?: string,
  uuid?: string
): Rpc<JitoApi> & GetTipFloorApi & TipStream & SendShakingBundle => {
  const uuidParam = uuid ? `?uuid=${uuid}` : ''
  const values = Object.values(BLOCK_ENGINE_URL)

  const randomUrl = () => values[Math.floor(Math.random() * values.length)]!

  let cachedTipStream: Observable<TipFloorResponse> | null = null

  /**
   * Creates a transport for the specified RPC method.
   *
   * @param method - The RPC method name
   * @returns The RPC transport
   */
  function createTransport(method: string) {
    const jitoUrl = url ?? randomUrl()
    let endpoint: string

    switch (method) {
      case 'sendTransaction':
        endpoint = `${jitoUrl}/api/v1/transactions${uuidParam}`
        break
      case 'sendBundle':
        endpoint = `${jitoUrl}/api/v1/bundles${uuidParam}`
        break
      default:
        endpoint = `${jitoUrl}/api/v1/${method}${uuidParam}`
        break
    }
    return createDefaultRpcTransport<MainnetUrl>({ url: mainnet(endpoint) })
  }

  /**
   * Custom transport function that routes requests to method-specific endpoints.
   * Optimized for Jito's sharded architecture.
   *
   * @param args - RPC transport arguments
   * @returns Promise resolving to the RPC response
   */
  async function shardingTransport<TResponse>(
    ...args: Parameters<RpcTransport>
  ): Promise<TResponse> {
    const payload = args[0].payload as { method: string }
    const transport = createTransport(payload.method)
    return transport(...args) as Promise<TResponse>
  }

  const rpc = createRpc({
    api: JITO_API,
    transport: shardingTransport,
  })

  return {
    ...rpc,
    async getTipFloor() {
      const maxRetries = 3
      let lastError: Error | null = null

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout

        try {
          const response = await fetch('https://bundles.jito.wtf/api/v1/bundles/tip_floor', {
            signal: controller.signal,
            headers: {
              'User-Agent': 'solana-kit-bot/1.0.0',
            },
          })

          clearTimeout(timeoutId)

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const data = (await response.json()) as [TipFloorResponse]
          return data[0]
        } catch (error) {
          clearTimeout(timeoutId)
          lastError = error instanceof Error ? error : new Error(String(error))

          if (error instanceof Error && error.name === 'AbortError') {
            lastError = new Error(
              `Jito API request timeout (5s) - attempt ${attempt}/${maxRetries}`
            )
          }

          if (attempt === maxRetries) {
            break
          }

          await new Promise(resolve => setTimeout(resolve, attempt * 1000))
        }
      }

      throw new Error(`Failed to get tip floor after ${maxRetries} attempts: ${lastError?.message}`)
    },

    async tipStream() {
      // Nếu đã có cached stream, trả về ngay
      if (cachedTipStream) {
        return cachedTipStream
      }

      // Tạo stream mới và cache lại
      const initialTipFloor = await this.getTipFloor()
      const wsUrl = 'wss://bundles.jito.wtf/api/v1/bundles/tip_stream' as const
      const ws = new WebSocketSubject<[TipFloorResponse]>(wsUrl)

      cachedTipStream = ws.pipe(
        map(data => data[0]),
        startWith(initialTipFloor),
        catchError(() => of(initialTipFloor)),
        shareReplay(1)
      )

      return cachedTipStream
    },
    async sendShakingBundle(transaction, config) {
      const requests = values.map(async endpoint => {
        const response = await fetch(`${endpoint}/api/v1/bundles${uuidParam}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: randomUUID(),
            method: 'sendBundle',
            params: [
              transaction,
              {
                encoding: 'base64',
                skipPreflight: config?.skipPreflight ?? true,
                maxRetries: config?.maxRetries ?? 0,
                preflightCommitment: config?.preflightCommitment ?? 'confirmed',
              },
            ],
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = (await response.json()) as {
          result?: string
          error?: { message: string }
        }

        if (data.error) {
          throw new Error(`RPC Error: ${data.error.message}`)
        }

        return data.result as string
      })

      try {
        const bundleId = await Promise.any(requests)
        return bundleId
      } catch (error) {
        // Nếu tất cả requests đều fail
        throw new Error(`All Jito endpoints failed: ${error}`)
      }
    },
  }
}
