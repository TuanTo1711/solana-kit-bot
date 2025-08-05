/**
 * @fileoverview Hybrid execution strategy combining time-based and count-based strategies
 */

import type { RunnerResult, ExecutionContext, ExecutionStrategy } from '~/types'
import { CountBasedExecutionStrategy } from './count-based-execution-strategy'
import { TimeBasedExecutionStrategy } from './time-based-execution-strategy'

export class HybridExecutionStrategy implements ExecutionStrategy {
  private timeStrategy: TimeBasedExecutionStrategy
  private countStrategy: CountBasedExecutionStrategy
  private mode: 'and' | 'or'

  constructor(
    duration: number,
    maxExecutions: number,
    mode: 'and' | 'or' = 'or',
    stopOnError = true
  ) {
    this.timeStrategy = new TimeBasedExecutionStrategy(duration, stopOnError)
    this.countStrategy = new CountBasedExecutionStrategy(maxExecutions, stopOnError)
    this.mode = mode
  }

  shouldContinue(context: ExecutionContext): boolean {
    const timeContinue = this.timeStrategy.shouldContinue(context)
    const countContinue = this.countStrategy.shouldContinue(context)

    return this.mode === 'and' ? timeContinue && countContinue : timeContinue || countContinue
  }

  onIterationComplete(context: ExecutionContext, result: RunnerResult): void {
    this.timeStrategy.onIterationComplete(context, result)
    this.countStrategy.onIterationComplete(context, result)
  }

  onError(context: ExecutionContext, error: Error): boolean {
    return this.timeStrategy.onError(context, error) && this.countStrategy.onError(context, error)
  }

  getProgress(context: ExecutionContext): number {
    const timeProgress = this.timeStrategy.getProgress(context)
    const countProgress = this.countStrategy.getProgress(context)

    return this.mode === 'and'
      ? Math.min(timeProgress, countProgress)
      : Math.max(timeProgress, countProgress)
  }
}
