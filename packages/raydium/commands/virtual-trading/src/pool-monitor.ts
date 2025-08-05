/**
 * @fileoverview Pool monitoring utilities for tracking token reserves
 */

import { getTokenDecoder, type Token } from '@solana-program/token'
import type { Address } from '@solana/kit'
import {
  BehaviorSubject,
  combineLatest,
  firstValueFrom,
  Observable,
  Subject,
  Subscriber,
  takeUntil,
  timeout,
} from 'rxjs'

import type { SolanaBotContext } from '@solana-kit-bot/core'
import type { PoolKeys } from '@solana-kit-bot/raydium-cpmm'

import {
  POOL_DATA_TIMEOUT,
  RPC_COMMITMENT,
  ACCOUNT_DATA_ENCODING,
  MAX_POOL_SUBSCRIPTIONS,
} from './constants'

/**
 * Monitors pool token reserves using real-time subscriptions
 */
export class PoolMonitor {
  private readonly base$ = new BehaviorSubject<bigint>(0n)
  private readonly quote$ = new BehaviorSubject<bigint>(0n)
  private readonly stop$ = new Subject<void>()
  private readonly tokenDecoder = getTokenDecoder()
  private activeSubscriptions = 0
  private lastUpdateTimestamp = 0

  /**
   * Get the current base token reserve amount
   */
  get baseReserve(): bigint {
    return this.base$.value
  }

  /**
   * Get the current quote token reserve amount
   */
  get quoteReserve(): bigint {
    return this.quote$.value
  }

  /**
   * Subscribe to real-time pool updates
   * @param context - The Solana bot context
   * @param poolKeys - Pool keys containing token vault addresses
   */
  async subscribeToPoolUpdates(context: SolanaBotContext, poolKeys: PoolKeys): Promise<void> {
    if (this.activeSubscriptions >= MAX_POOL_SUBSCRIPTIONS) {
      throw new Error(`Maximum pool subscriptions (${MAX_POOL_SUBSCRIPTIONS}) exceeded`)
    }

    const [baseObservable, quoteObservable] = await Promise.all([
      this.createTokenObservable(context, poolKeys.token0Vault),
      this.createTokenObservable(context, poolKeys.token1Vault),
    ])

    baseObservable.pipe(takeUntil(this.stop$)).subscribe({
      next: event => {
        this.base$.next(event.amount)
        this.lastUpdateTimestamp = Date.now()
      },
      error: error => this.base$.error(error),
    })

    quoteObservable.pipe(takeUntil(this.stop$)).subscribe({
      next: event => {
        this.quote$.next(event.amount)
        this.lastUpdateTimestamp = Date.now()
      },
      error: error => this.quote$.error(error),
    })

    this.activeSubscriptions = 2
    await this.waitForPoolDataInitialization()
  }

  /**
   * Stop monitoring and cleanup resources
   */
  cleanup(): void {
    this.stop$.next()
    this.stop$.complete()
    this.base$.complete()
    this.quote$.complete()
    this.activeSubscriptions = 0
    this.lastUpdateTimestamp = 0
  }

  /**
   * Get performance metrics for monitoring
   */
  getMetrics() {
    return {
      activeSubscriptions: this.activeSubscriptions,
      lastUpdateTimestamp: this.lastUpdateTimestamp,
      baseReserve: this.baseReserve,
      quoteReserve: this.quoteReserve,
      timeSinceLastUpdate: Date.now() - this.lastUpdateTimestamp,
    }
  }

  /**
   * Creates an observable for monitoring a single token account
   * @param context - The Solana bot context
   * @param tokenAccount - Token account address to monitor
   * @returns Observable stream of token data
   */
  private createTokenObservable(
    context: SolanaBotContext,
    tokenAccount: Address
  ): Observable<Token> {
    return new Observable<Token>(subscriber => {
      const abortController = new AbortController()
      let subscription: any = null

      const fetchInitialData = async () => {
        try {
          const { value: accountInfo } = await context.provider.rpc
            .getAccountInfo(tokenAccount, { encoding: ACCOUNT_DATA_ENCODING })
            .send()

          if (accountInfo) {
            const [encodedData, encoding] = accountInfo.data
            const buffer = Buffer.from(encodedData, encoding)
            const decodedData = this.tokenDecoder.decode(buffer)
            subscriber.next(decodedData)
          }
        } catch (error) {
          // Initial fetch error is not critical
        }
      }

      const startSubscription = async () => {
        try {
          if (abortController.signal.aborted) return

          subscription = await context.provider.rpcSubscriptions
            .accountNotifications(tokenAccount, {
              commitment: RPC_COMMITMENT,
              encoding: ACCOUNT_DATA_ENCODING,
            })
            .subscribe({ abortSignal: abortController.signal })

          await this.processTokenStream(subscription, subscriber)
        } catch (error) {
          if (!abortController.signal.aborted) {
            subscriber.error(error)
          }
        }
      }

      void Promise.all([fetchInitialData(), startSubscription()])

      return () => {
        abortController.abort()
        subscription = null
      }
    })
  }

  /**
   * Processes the token stream and decodes account data
   * @param asyncIterable - Async iterable stream from RPC subscription
   * @param subscriber - RxJS subscriber to emit decoded data to
   */
  private async processTokenStream(
    asyncIterable: AsyncIterable<any>,
    subscriber: Subscriber<Token>
  ): Promise<void> {
    try {
      for await (const { value } of asyncIterable) {
        if (subscriber.closed) return

        const [encodedData, encoding] = value.data
        const buffer = Buffer.from(encodedData, encoding)
        const decodedData = this.tokenDecoder.decode(buffer)

        subscriber.next(decodedData)
      }
    } catch (error) {
      if (!subscriber.closed) {
        subscriber.error(error)
      }
    }
  }

  /**
   * Wait until both base and quote pool reserves are initialized with non-zero values
   */
  private async waitForPoolDataInitialization(): Promise<void> {
    try {
      await firstValueFrom(
        combineLatest([this.base$, this.quote$]).pipe(
          takeUntil(this.stop$),
          timeout(POOL_DATA_TIMEOUT)
        ),
        {
          defaultValue: [0n, 0n],
        }
      )
    } catch (error) {
      throw new Error('Hết thời gian chờ khởi tạo dữ liệu pool')
    }
  }
}
