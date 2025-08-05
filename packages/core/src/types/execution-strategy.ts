/**
 * @fileoverview Execution strategy interfaces and types
 */

import type { RunnerResult, ExecutionContext } from './runner'

export interface ExecutionStrategy {
  shouldContinue(context: ExecutionContext): boolean
  onIterationComplete(context: ExecutionContext, result: RunnerResult): void
  onError(context: ExecutionContext, error: Error): boolean
  getProgress(context: ExecutionContext): number
}
