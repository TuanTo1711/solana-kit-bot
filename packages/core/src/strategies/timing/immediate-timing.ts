import type { ExecutionContext, TimingStrategy } from '~/types'

export class ImmediateTiming implements TimingStrategy {
  getNextExecutionDelay(_: ExecutionContext): number {
    return 0
  }

  shouldExecuteNow(_: ExecutionContext): boolean {
    return true
  }
}
