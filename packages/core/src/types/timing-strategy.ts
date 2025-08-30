import type { ExecutionContext } from './execution-strategy'

/**
 * Interface for defining timing strategies that control when and how often code should be executed.
 * Timing strategies determine the execution schedule and timing behavior for runners.
 */
export interface TimingStrategy {
  /**
   * Calculates the delay in milliseconds before the next execution should occur.
   * @param context - The current execution context containing timing and state information
   * @returns The delay in milliseconds until the next execution
   */
  getNextExecutionDelay(context: ExecutionContext): number

  /**
   * Determines whether the code should execute immediately based on the current context.
   * @param context - The current execution context containing timing and state information
   * @returns true if execution should happen now, false otherwise
   */
  shouldExecuteNow(context: ExecutionContext): boolean
}
