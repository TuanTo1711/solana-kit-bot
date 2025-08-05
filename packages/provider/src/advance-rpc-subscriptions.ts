import { getTokenCodec, type Token } from '@solana-program/token'
import {
  type Address,
  type Codec,
  type Decoder,
  type GetAccountInfoApi,
  type Rpc,
  type RpcSubscriptions,
  type SolanaRpcSubscriptionsApi,
} from '@solana/kit'
import { Observable, retry, Subscriber } from 'rxjs'

/**
 * Configuration options for advanced account notifications
 */
type AdvanceNotificationsConfig = {
  /** Whether to fetch initial account data before starting subscription */
  initial: boolean
  /** Number of retry attempts on subscription failure */
  retry: number
  /** Delay between retry attempts in milliseconds */
  delay: number
}

/**
 * Creates advanced RPC subscription utilities for Solana programs
 *
 * @param rpc - RPC client for account info requests
 * @param rpcSubscriptions - RPC subscriptions client for real-time updates
 * @returns Object containing advanced subscription methods
 */
export const createAdvanceRpcSubscriptions = (
  rpc: Rpc<GetAccountInfoApi>,
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>
) => {
  const tokenDecoder = getTokenCodec()
  const PROGRAM_LOG = 'Program log: '
  const PROGRAM_DATA = 'Program data: '
  const PROGRAM_LOG_START_INDEX = PROGRAM_LOG.length
  const PROGRAM_DATA_START_INDEX = PROGRAM_DATA.length

  /**
   * Processes token account data stream and emits decoded Token objects
   *
   * @param asyncIterable - Stream of raw account data
   * @param subscriber - RxJS subscriber to emit decoded tokens to
   */
  const processTokenStream = async (
    asyncIterable: AsyncIterable<any>,
    subscriber: Subscriber<Token>
  ) => {
    try {
      for await (const { value } of asyncIterable) {
        if (subscriber.closed) {
          return
        }

        const [encodedData, encoding] = value.data
        const buffer = Buffer.from(encodedData, encoding)
        const decodedData = tokenDecoder.decode(buffer)

        subscriber.next(decodedData)
      }
    } catch (error) {
      if (!subscriber.closed) {
        subscriber.error(error)
      }
    }
  }

  /**
   * Parses program events from transaction logs
   *
   * @param logs - Array of transaction log strings
   * @param programIdStr - Program ID to filter logs for
   * @param discriminator - 8-byte discriminator to identify event type
   * @param decoder - Decoder for the event data type
   * @returns Decoded event data or undefined if not found
   */
  function parseEvent<T>(
    logs: readonly string[],
    programIdStr: string,
    discriminator: Uint8Array,
    decoder: Decoder<T>
  ): T | undefined {
    const stack: string[] = []

    for (const log of logs) {
      const trimmed = log.trim()

      if (trimmed.startsWith(`Program ${programIdStr} invoke`)) {
        stack.push(programIdStr)
        continue
      }

      if (
        trimmed.startsWith(`Program ${programIdStr} success`) ||
        trimmed.startsWith(`Program ${programIdStr} failed`)
      ) {
        stack.pop()
        continue
      }

      if (stack.length === 0 || stack[stack.length - 1] !== programIdStr) {
        continue
      }

      if (trimmed.startsWith(PROGRAM_DATA) || trimmed.startsWith(PROGRAM_LOG)) {
        const base64 = trimmed.startsWith(PROGRAM_DATA)
          ? trimmed.slice(PROGRAM_DATA_START_INDEX)
          : trimmed.slice(PROGRAM_LOG_START_INDEX)

        const buf = Buffer.from(base64, 'base64')
        if (buf.length >= 8 && buf.subarray(0, 8).equals(discriminator)) {
          return decoder.decode(buf.subarray(8))
        }
      }
    }

    return undefined
  }

  /**
   * Creates an Observable for token account notifications with advanced features
   *
   * @param address - Token account address to monitor
   * @param config - Configuration for subscription behavior
   * @returns Observable stream of decoded Token objects
   */
  const accountNotifications = (address: Address, config: AdvanceNotificationsConfig) => {
    return new Observable<Token>(subscriber => {
      const abortController = new AbortController()
      let subscription: AsyncIterable<any> | null = null

      /**
       * Fetches and emits initial account data if configured
       */
      const fetchInitialData = async () => {
        try {
          const { value: accountInfo } = await rpc
            .getAccountInfo(address, { encoding: 'base64' })
            .send()

          if (accountInfo) {
            const [encodedData, encoding] = accountInfo.data
            const buffer = Buffer.from(encodedData, encoding)
            const decodedData = tokenDecoder.decode(buffer)
            subscriber.next(decodedData)
          }
        } catch (error) {
          // Initial fetch error is not critical
        }
      }

      const startSubscription = async () => {
        try {
          if (abortController.signal.aborted) return

          subscription = await rpcSubscriptions
            .accountNotifications(address, {
              commitment: 'confirmed',
              encoding: 'base64',
            })
            .subscribe({ abortSignal: abortController.signal })

          await processTokenStream(subscription, subscriber)
        } catch (error) {
          if (!abortController.signal.aborted) {
            subscriber.error(error)
          }
        }
      }

      if (config.initial) {
        void Promise.all([fetchInitialData(), startSubscription()])
      } else {
        void startSubscription()
      }

      return () => {
        abortController.abort()
        subscription = null
      }
    }).pipe(
      retry({
        count: config.retry,
        delay: config.delay,
        resetOnSuccess: true,
      })
    )
  }

  const eventNotifications = <T>(address: Address, discriminator: Uint8Array, codec: Codec<T>) => {
    return new Observable<T>(subscriber => {
      let abortController = new AbortController()

      let subscription: AsyncIterable<any> | null = null

      const connect = async () => {
        if (abortController.signal.aborted) return
        try {
          subscription = await rpcSubscriptions
            .logsNotifications({ mentions: [address] }, { commitment: 'confirmed' })
            .subscribe({ abortSignal: abortController.signal })

          for await (const { value } of subscription) {
            if (subscriber.closed) {
              return
            }

            const decodedData = parseEvent(value.logs, address, discriminator, codec)

            if (decodedData) {
              subscriber.next(decodedData)
            }
          }
        } catch (error) {
          if (!abortController.signal.aborted) {
            subscriber.error(error)
          }
        }
      }

      void connect()

      return () => {
        abortController.abort()
        subscription = null
      }
    })
  }

  const programNotifications = <T>(
    programAddress: Address,
    accountSize: number,
    codec: Codec<T>,
    config: AdvanceNotificationsConfig
  ) => {
    return new Observable<T>(subscriber => {
      let abortController = new AbortController()

      let subscription: AsyncIterable<any> | null = null

      const connect = async () => {
        if (abortController.signal.aborted) return

        try {
          subscription = await rpcSubscriptions
            .programNotifications(programAddress, {
              commitment: 'confirmed',
              encoding: 'base64',
              filters: [{ dataSize: BigInt(accountSize) }],
            })
            .subscribe({ abortSignal: abortController.signal })

          for await (const { value } of subscription) {
            if (subscriber.closed) {
              return
            }

            if (value) {
              const [encodedData, encoding] = value.account.data
              const buffer = Buffer.from(encodedData, encoding)
              const decodedData = codec.decode(buffer)

              subscriber.next(decodedData)
            }
          }
        } catch (error) {
          if (!abortController.signal.aborted) {
            subscriber.error(error)
          }
        }
      }

      void connect()
    }).pipe(
      retry({
        count: config.retry,
        delay: config.delay,
        resetOnSuccess: true,
      })
    )
  }

  return { accountNotifications, eventNotifications, programNotifications }
}
