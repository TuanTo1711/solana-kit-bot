/**
 * @fileoverview Time-based execution strategy for duration-limited execution
 */

import type { ExecutorResult, ExecutionContext, ExecutionStrategy } from '~/types'

export class TimeBasedExecutionStrategy implements ExecutionStrategy {
  private duration: number
  private stopOnError: boolean

  constructor(duration: number, stopOnError = true) {
    this.duration = duration
    this.stopOnError = stopOnError
  }

  shouldContinue(context: ExecutionContext): boolean {
    const elapsed = Date.now() - context.startTime
    return elapsed < this.duration && context.isRunning
  }

  onIterationComplete(context: ExecutionContext, result: ExecutorResult): void {
    context.recentResults.push(result)
    if (context.recentResults.length > 10) {
      context.recentResults.shift()
    }
  }

  onError(context: ExecutionContext, _: Error): boolean {
    context.failedExecutions++
    return !this.stopOnError
  }

  getProgress(context: ExecutionContext): number {
    const elapsed = Date.now() - context.startTime
    return Math.min((elapsed / this.duration) * 100, 100)
  }
}
