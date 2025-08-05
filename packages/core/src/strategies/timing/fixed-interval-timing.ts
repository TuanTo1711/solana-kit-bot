import type { ExecutionContext, TimingStrategy } from '~/types'

export class FixedIntervalTiming implements TimingStrategy {
  private interval: number
  private lastExecution = 0

  constructor(interval: number) {
    this.interval = interval
  }

  getNextExecutionDelay(_: ExecutionContext): number {
    return this.interval
  }

  shouldExecuteNow(_: ExecutionContext): boolean {
    const now = Date.now()
    if (now - this.lastExecution >= this.interval) {
      this.lastExecution = now
      return true
    }
    return false
  }
}
