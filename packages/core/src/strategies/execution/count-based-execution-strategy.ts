/**
 * @fileoverview Count-based execution strategy for execution count-limited execution
 */

import type { ExecutionContext, ExecutionStrategy, RunnerResult } from '~/types'

export class CountBasedExecutionStrategy implements ExecutionStrategy {
  private maxExecutions: number
  private stopOnError: boolean

  constructor(maxExecutions: number, stopOnError = true) {
    this.maxExecutions = maxExecutions
    this.stopOnError = stopOnError
  }

  shouldContinue(context: ExecutionContext): boolean {
    return context.totalExecutions < this.maxExecutions && context.isRunning
  }

  onIterationComplete(context: ExecutionContext, result: RunnerResult): void {
    context.recentResults.push(result)
    if (context.recentResults.length > 10) {
      context.recentResults.shift() // Keep only last 10 results
    }
  }

  onError(context: ExecutionContext, _: Error): boolean {
    context.failedExecutions++
    return !this.stopOnError
  }

  getProgress(context: ExecutionContext): number {
    return Math.min((context.totalExecutions / this.maxExecutions) * 100, 100)
  }
}
