/**
 * @fileoverview Stepped price strategy - Changes price in discrete steps based on conditions
 */

import { AbstractPriceStrategy } from './price-strategy'
import type { PriceContext, PriceResult, PriceStrategyConfig } from '~/types'

export interface PriceStep {
  /** Condition for this step */
  condition: {
    type: 'iteration' | 'time' | 'performance' | 'custom'
    value: number
    operator: 'gte' | 'lte' | 'eq' | 'gt' | 'lt'
  }
  /** Price for this step */
  price: number
  /** Optional description */
  description?: string
}

export interface SteppedPriceConfig extends PriceStrategyConfig {
  /** Array of price steps */
  steps: PriceStep[]
  /** Default price if no steps match */
  defaultPrice: number
  /** Whether to use the last matching step or continue searching */
  useLastMatch?: boolean
}

/**
 * Stepped Price Strategy
 * Changes price in discrete steps based on various conditions
 */
export class SteppedPriceStrategy extends AbstractPriceStrategy {
  private steps: PriceStep[]
  private defaultPrice: number
  private useLastMatch: boolean
  private currentStepIndex: number = -1

  constructor(config: SteppedPriceConfig) {
    super('SteppedPrice', config)
    this.steps = [...config.steps].sort(this.sortSteps.bind(this))
    this.defaultPrice = config.defaultPrice
    this.useLastMatch = config.useLastMatch || false
  }

  calculatePrice(context: PriceContext): PriceResult {
    let matchingStep: PriceStep | null = null
    let stepIndex = -1

    // Find matching step
    if (this.useLastMatch) {
      // Find the last step that matches
      for (let i = this.steps.length - 1; i >= 0; i--) {
        const step = this.steps[i]
        if (step && this.evaluateCondition(step.condition, context)) {
          matchingStep = step
          stepIndex = i
          break
        }
      }
    } else {
      // Find the first step that matches
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
        0.9, // High confidence for stepped prices
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
        0.5, // Medium confidence for default price
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
        // Assume performance is passed in metadata
        contextValue = context.metadata?.['successRate'] || 0
        break
      case 'custom':
        // Assume custom value is passed in metadata
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

  private sortSteps(a: PriceStep, b: PriceStep): number {
    // Sort by condition value for consistent ordering
    return a.condition.value - b.condition.value
  }

  /**
   * Add a new price step
   */
  addStep(step: PriceStep): void {
    this.steps.push(step)
    this.steps.sort(this.sortSteps.bind(this))
  }

  /**
   * Remove a price step by index
   */
  removeStep(index: number): boolean {
    if (index >= 0 && index < this.steps.length) {
      this.steps.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * Update a price step
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
   * Get all price steps
   */
  getSteps(): PriceStep[] {
    return [...this.steps]
  }

  /**
   * Get current step index
   */
  getCurrentStepIndex(): number {
    return this.currentStepIndex
  }

  /**
   * Get current step
   */
  getCurrentStep(): PriceStep | null {
    if (this.currentStepIndex >= 0 && this.currentStepIndex < this.steps.length) {
      return this.steps[this.currentStepIndex] || null
    }
    return null
  }

  /**
   * Set default price
   */
  setDefaultPrice(price: number): void {
    this.defaultPrice = price
  }

  /**
   * Get default price
   */
  getDefaultPrice(): number {
    return this.defaultPrice
  }

  /**
   * Set use last match behavior
   */
  setUseLastMatch(useLastMatch: boolean): void {
    this.useLastMatch = useLastMatch
  }

  /**
   * Get use last match behavior
   */
  isUsingLastMatch(): boolean {
    return this.useLastMatch
  }

  /**
   * Clear all steps
   */
  clearSteps(): void {
    this.steps = []
    this.currentStepIndex = -1
  }

  /**
   * Reset current step tracking
   */
  override reset(): void {
    this.currentStepIndex = -1
  }

  /**
   * Create a simple iteration-based stepped strategy
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
   * Create a time-based stepped strategy
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
