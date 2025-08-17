import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system'
import { address } from '@solana/addresses'
import { filter, map, mergeAll, ReplaySubject, Subject, takeUntil } from 'rxjs'

import { type SolanaBotContext } from '@solana-kit-bot/core'
import {
  getCreatePoolEventCodec,
  PUMP_AMM_PROGRAM_ADDRESS,
  type PoolKeys,
} from '@solana-kit-bot/pumpswap'
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token'
import type { PoolService } from '~/services'

type PoolEvent = PoolKeys & { timestamp: bigint }

export class PoolMonitor {
  private createPoolEvents$: ReplaySubject<PoolEvent> = new ReplaySubject(Infinity)
  private createPoolEventStop$ = new Subject<void>()
  private isRunning = false

  constructor(
    private readonly context: SolanaBotContext,
    private readonly poolService: PoolService
  ) {}

  start() {
    if (this.isRunning) {
      return
    }

    const { advanceSubscriptions } = this.context.provider

    this.isRunning = true
    advanceSubscriptions
      .eventNotifications(
        PUMP_AMM_PROGRAM_ADDRESS,
        new Uint8Array([177, 49, 12, 210, 160, 118, 167, 116]),
        getCreatePoolEventCodec(),
        { delay: 1000, retry: Infinity }
      )
      .pipe(
        takeUntil(this.createPoolEventStop$),
        filter(
          e =>
            e != null &&
            e.coinCreator !== SYSTEM_PROGRAM_ADDRESS &&
            e.baseMint !== address('So11111111111111111111111111111111111111112')
        ),
        map(async event => {
          const { baseMint, quoteMint, pool } = event
          const [[poolBaseTokenAccount], [poolQuoteTokenAccount]] = await Promise.all([
            findAssociatedTokenPda({
              mint: baseMint,
              owner: pool,
              tokenProgram: TOKEN_PROGRAM_ADDRESS,
            }),
            findAssociatedTokenPda({
              mint: quoteMint,
              owner: pool,
              tokenProgram: TOKEN_PROGRAM_ADDRESS,
            }),
          ])

          return {
            baseMint: event.baseMint,
            coinCreator: event.coinCreator,
            creator: event.creator,
            index: event.index,
            lpMint: event.lpMint,
            lpSupply: event.initialLiquidity,
            pool: event.pool,
            poolBump: event.poolBump,
            quoteMint: event.quoteMint,
            poolBaseTokenAccount,
            poolQuoteTokenAccount,
            timestamp: event.timestamp,
          }
        }),
        mergeAll()
      )
      .subscribe({
        next: poolEvent => {
          this.createPoolEvents$.next(poolEvent)
          this.poolService.addPoolKeys(poolEvent)
        },
      })
  }

  stop() {
    if (this.createPoolEvents$.closed) {
      return
    }

    this.createPoolEventStop$.next()
    this.createPoolEventStop$.complete()
    this.createPoolEvents$.complete()
    this.isRunning = false
  }

  asObservable() {
    return this.createPoolEvents$.asObservable()
  }

  get createPoolEvents() {
    return this.createPoolEvents$
  }
}
