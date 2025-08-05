/**
 * @fileoverview Infinity execution strategy for unlimited execution with optional max iterations
 */

import type { RunnerResult, ExecutionContext, ExecutionStrategy } from '~/types'

export class IterationExecutionStrategy implements ExecutionStrategy {
  private maxIterations: number
  private stopOnError: boolean

  constructor(maxIterations = 0, stopOnError = true) {
    this.maxIterations = maxIterations // 0 = infinite
    this.stopOnError = stopOnError
  }

  shouldContinue(context: ExecutionContext): boolean {
    if (this.maxIterations > 0 && context.currentIteration >= this.maxIterations) {
      return false
    }
    return context.isRunning
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
    if (this.maxIterations === 0) {
      return -1
    }
    return Math.min((context.currentIteration / this.maxIterations) * 100, 100)
  }
}
