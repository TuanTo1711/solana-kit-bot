import type { ExecutionContext } from './runner'

export interface TimingStrategy {
  getNextExecutionDelay(context: ExecutionContext): number
  shouldExecuteNow(context: ExecutionContext): boolean
}
