import { AbstractPriceStrategy } from '~/abstract'
import type { PriceContext, PriceResult, PriceStrategyConfig } from '~/types'

/**
 * Represents a single price step with its condition and corresponding price
 */
export interface PriceStep {
  /**
   * Condition that must be met for this step to apply
   */
  condition: {
    /** Type of condition to evaluate */
    type: 'iteration' | 'time' | 'performance' | 'custom'
    /** Value to compare against */
    value: number
    /** Comparison operator */
    operator: 'gte' | 'lte' | 'eq' | 'gt' | 'lt'
  }
  /** Price to apply when condition is met */
  price: number
  /** Optional description for this step */
  description?: string
}

/**
 * Configuration for the stepped price strategy
 */
export interface SteppedPriceConfig extends PriceStrategyConfig {
  /** Array of price steps to evaluate */
  steps: PriceStep[]
  /** Default price when no steps match */
  defaultPrice: number
  /** Whether to use the last matching step (true) or first matching step (false) */
  useLastMatch?: boolean
}

/**
 * Stepped Price Strategy
 *
 * Changes price in discrete steps based on various conditions such as iteration count,
 * elapsed time, performance metrics, or custom values. Steps are evaluated in order
 * and the first (or last, depending on configuration) matching step determines the price.
 *
 * @example
 * ```typescript
 * // Create iteration-based pricing
 * const strategy = SteppedPriceStrategy.createIterationBased({
 *   iterationSteps: [
 *     { iteration: 0, price: 10 },
 *     { iteration: 5, price: 15 },
 *     { iteration: 10, price: 20 }
 *   ],
 *   defaultPrice: 10
 * });
 *
 * // Create custom stepped strategy
 * const customStrategy = new SteppedPriceStrategy({
 *   steps: [
 *     {
 *       condition: { type: 'performance', value: 0.8, operator: 'gte' },
 *       price: 25,
 *       description: 'High performance bonus'
 *     }
 *   ],
 *   defaultPrice: 15,
 *   useLastMatch: true
 * });
 * ```
 */
export class SteppedPriceStrategy extends AbstractPriceStrategy {
  private steps: PriceStep[]
  private defaultPrice: number
  private useLastMatch: boolean
  private currentStepIndex: number = -1

  /**
   * Creates a new stepped price strategy
   *
   * @param config Configuration object containing steps and settings
   */
  constructor(config: SteppedPriceConfig) {
    super('SteppedPrice', config)
    this.steps = [...config.steps].sort(this.sortSteps.bind(this))
    this.defaultPrice = config.defaultPrice
    this.useLastMatch = config.useLastMatch || false
  }

  /**
   * Calculates price based on the first or last matching step
   *
   * @param context Current pricing context
   * @returns Price result with step information
   */
  calculatePrice(context: PriceContext): PriceResult {
    let matchingStep: PriceStep | null = null
    let stepIndex = -1

    if (this.useLastMatch) {
      for (let i = this.steps.length - 1; i >= 0; i--) {
        const step = this.steps[i]
        if (step && this.evaluateCondition(step.condition, context)) {
          matchingStep = step
          stepIndex = i
          break
        }
      }
    } else {
      for (let i = 0; i < this.steps.length; i++) {
        const step = this.steps[i]
        if (step && this.evaluateCondition(step.condition, context)) {
          matchingStep = step
          stepIndex = i
          break
        }
      }
    }

    this.currentStepIndex = stepIndex

    if (matchingStep) {
      return this.createResult(
        matchingStep.price,
        0.9,
        matchingStep.description ||
          `Step ${stepIndex + 1}: ${this.formatCondition(matchingStep.condition)}`,
        {
          strategy: 'stepped',
          stepIndex,
          condition: matchingStep.condition,
          totalSteps: this.steps.length,
          iteration: context.iteration,
        }
      )
    } else {
      return this.createResult(
        this.defaultPrice,
        0.5,
        'No matching step found, using default price',
        {
          strategy: 'stepped',
          stepIndex: -1,
          usedDefault: true,
          totalSteps: this.steps.length,
          iteration: context.iteration,
        }
      )
    }
  }

  /**
   * Evaluates whether a condition is met for the given context
   *
   * @param condition Condition to evaluate
   * @param context Current pricing context
   * @returns True if condition is met
   */
  private evaluateCondition(condition: PriceStep['condition'], context: PriceContext): boolean {
    let contextValue: number

    switch (condition.type) {
      case 'iteration':
        contextValue = context.iteration
        break
      case 'time':
        contextValue = Date.now() - context.timestamp
        break
      case 'performance':
        contextValue = context.metadata?.['successRate'] || 0
        break
      case 'custom':
        contextValue = context.metadata?.['customValue'] || 0
        break
      default:
        return false
    }

    switch (condition.operator) {
      case 'gte':
        return contextValue >= condition.value
      case 'lte':
        return contextValue <= condition.value
      case 'eq':
        return contextValue === condition.value
      case 'gt':
        return contextValue > condition.value
      case 'lt':
        return contextValue < condition.value
      default:
        return false
    }
  }

  /**
   * Formats a condition for display purposes
   *
   * @param condition Condition to format
   * @returns Human-readable condition string
   */
  private formatCondition(condition: PriceStep['condition']): string {
    const operatorMap = {
      gte: '>=',
      lte: '<=',
      eq: '==',
      gt: '>',
      lt: '<',
    }

    return `${condition.type} ${operatorMap[condition.operator]} ${condition.value}`
  }

  /**
   * Sorts steps by condition value for consistent ordering
   *
   * @param a First step to compare
   * @param b Second step to compare
   * @returns Comparison result
   */
  private sortSteps(a: PriceStep, b: PriceStep): number {
    return a.condition.value - b.condition.value
  }

  /**
   * Adds a new price step and maintains sorted order
   *
   * @param step Step to add
   */
  addStep(step: PriceStep): void {
    this.steps.push(step)
    this.steps.sort(this.sortSteps.bind(this))
  }

  /**
   * Removes a price step by index
   *
   * @param index Index of step to remove
   * @returns True if step was removed successfully
   */
  removeStep(index: number): boolean {
    if (index >= 0 && index < this.steps.length) {
      this.steps.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * Updates an existing price step and maintains sorted order
   *
   * @param index Index of step to update
   * @param step Partial step data to merge
   * @returns True if step was updated successfully
   */
  updateStep(index: number, step: Partial<PriceStep>): boolean {
    if (index >= 0 && index < this.steps.length) {
      this.steps[index] = { ...this.steps[index], ...step } as PriceStep
      this.steps.sort(this.sortSteps.bind(this))
      return true
    }
    return false
  }

  /**
   * Gets a copy of all price steps
   *
   * @returns Array of all steps
   */
  getSteps(): PriceStep[] {
    return [...this.steps]
  }

  /**
   * Gets the index of the currently matched step
   *
   * @returns Current step index, or -1 if no step matched
   */
  getCurrentStepIndex(): number {
    return this.currentStepIndex
  }

  /**
   * Gets the currently matched step
   *
   * @returns Current step or null if no step matched
   */
  getCurrentStep(): PriceStep | null {
    if (this.currentStepIndex >= 0 && this.currentStepIndex < this.steps.length) {
      return this.steps[this.currentStepIndex] || null
    }
    return null
  }

  /**
   * Sets the default price used when no steps match
   *
   * @param price New default price
   */
  setDefaultPrice(price: number): void {
    this.defaultPrice = price
  }

  /**
   * Gets the current default price
   *
   * @returns Default price
   */
  getDefaultPrice(): number {
    return this.defaultPrice
  }

  /**
   * Sets whether to use last matching step or first matching step
   *
   * @param useLastMatch True to use last match, false for first match
   */
  setUseLastMatch(useLastMatch: boolean): void {
    this.useLastMatch = useLastMatch
  }

  /**
   * Gets the current last match behavior setting
   *
   * @returns True if using last match, false if using first match
   */
  isUsingLastMatch(): boolean {
    return this.useLastMatch
  }

  /**
   * Removes all price steps
   */
  clearSteps(): void {
    this.steps = []
    this.currentStepIndex = -1
  }

  /**
   * Resets the current step tracking
   */
  override reset(): void {
    this.currentStepIndex = -1
  }

  /**
   * Creates a stepped strategy based on iteration count
   *
   * @param config Configuration with iteration-based steps
   * @returns New stepped price strategy
   *
   * @example
   * ```typescript
   * const strategy = SteppedPriceStrategy.createIterationBased({
   *   iterationSteps: [
   *     { iteration: 0, price: 10, description: 'Starting price' },
   *     { iteration: 5, price: 15, description: 'After 5 iterations' },
   *     { iteration: 10, price: 20, description: 'After 10 iterations' }
   *   ],
   *   defaultPrice: 10
   * });
   * ```
   */
  static createIterationBased(config: {
    iterationSteps: { iteration: number; price: number; description?: string }[]
    defaultPrice: number
  }): SteppedPriceStrategy {
    const steps: PriceStep[] = config.iterationSteps.map(step => ({
      condition: {
        type: 'iteration',
        value: step.iteration,
        operator: 'gte' as const,
      },
      price: step.price,
      description: step.description || '',
    }))

    return new SteppedPriceStrategy({
      steps,
      defaultPrice: config.defaultPrice,
      useLastMatch: true,
    })
  }

  /**
   * Creates a stepped strategy based on elapsed time
   *
   * @param config Configuration with time-based steps
   * @returns New stepped price strategy
   *
   * @example
   * ```typescript
   * const strategy = SteppedPriceStrategy.createTimeBased({
   *   timeSteps: [
   *     { timeMs: 0, price: 10, description: 'Initial price' },
   *     { timeMs: 5000, price: 15, description: 'After 5 seconds' },
   *     { timeMs: 10000, price: 20, description: 'After 10 seconds' }
   *   ],
   *   defaultPrice: 10
   * });
   * ```
   */
  static createTimeBased(config: {
    timeSteps: { timeMs: number; price: number; description?: string }[]
    defaultPrice: number
  }): SteppedPriceStrategy {
    const steps: PriceStep[] = config.timeSteps.map(step => ({
      condition: {
        type: 'time',
        value: step.timeMs,
        operator: 'gte' as const,
      },
      price: step.price,
      description: step.description || '',
    }))

    return new SteppedPriceStrategy({
      steps,
      defaultPrice: config.defaultPrice,
      useLastMatch: true,
    })
  }
}
