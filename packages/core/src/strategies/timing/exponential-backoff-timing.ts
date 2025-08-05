import type { ExecutionContext, TimingStrategy } from '~/types'

export class ExponentialBackoffTiming implements TimingStrategy {
  private baseInterval: number
  private maxInterval: number
  private multiplier: number

  constructor(baseInterval: number, maxInterval = 60000, multiplier = 2) {
    this.baseInterval = baseInterval
    this.maxInterval = maxInterval
    this.multiplier = multiplier
  }

  getNextExecutionDelay(context: ExecutionContext): number {
    const delay = Math.min(
      this.baseInterval * Math.pow(this.multiplier, context.failedExecutions),
      this.maxInterval
    )
    return delay
  }

  shouldExecuteNow(_: ExecutionContext): boolean {
    return true
  }
}
