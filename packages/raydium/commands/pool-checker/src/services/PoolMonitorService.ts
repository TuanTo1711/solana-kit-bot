import type { PoolKeys } from '@solana-kit-bot/raydium-cpmm'
import { ReplaySubject } from 'rxjs'

type MonitorType = 'add' | 'remove' | 'expire'

export class PoolMonitor {
  private cachePoolKeys = new Map<string, PoolKeys>()
  private poolKeys$ = new ReplaySubject<{ type: MonitorType; poolKeys: PoolKeys }>()

  watchPool(value: PoolKeys) {
    if (this.cachePoolKeys.has(value.poolId)) {
      return
    }

    this.cachePoolKeys.set(value.poolId, value)
    this.poolKeys$.next({ type: 'add', poolKeys: value })
  }

  get stream$() {
    return this.poolKeys$.asObservable()
  }
}
