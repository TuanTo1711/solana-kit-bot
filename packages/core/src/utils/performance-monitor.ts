/**
 * @fileoverview Performance monitoring and metrics collection utilities
 *
 * Provides comprehensive performance monitoring capabilities for runners
 * including execution time tracking, memory usage monitoring, and metrics
 * aggregation with configurable collection intervals.
 *
 * @author Yuuta - To Hoang Tuan
 * @version 1.0.0
 * @since 2024
 */

/**
 * Configuration options for performance monitoring
 */
export interface PerformanceMonitorConfig {
  /** Enable/disable monitoring (default: true) */
  enabled?: boolean
  /** Metrics collection interval in milliseconds (default: 5000) */
  collectInterval?: number
  /** Maximum number of samples to keep in memory (default: 100) */
  maxSamples?: number
  /** Enable memory usage tracking (default: true) */
  trackMemory?: boolean
  /** Enable CPU usage tracking (default: false - requires additional deps) */
  trackCpu?: boolean
  /** Custom tags to attach to metrics */
  tags?: Record<string, string>
}

/**
 * Performance metrics snapshot
 */
export interface PerformanceMetrics {
  /** Timestamp when metrics were collected */
  timestamp: number
  /** Execution metrics */
  execution: {
    /** Total number of operations */
    totalOperations: number
    /** Successful operations */
    successfulOperations: number
    /** Failed operations */
    failedOperations: number
    /** Success rate percentage */
    successRate: number
    /** Average execution time in milliseconds */
    averageExecutionTime: number
    /** Minimum execution time in milliseconds */
    minExecutionTime: number
    /** Maximum execution time in milliseconds */
    maxExecutionTime: number
    /** Current operations per second */
    operationsPerSecond: number
  }
  /** System metrics */
  system: {
    /** Memory usage in MB */
    memoryUsage: number
    /** Memory usage percentage */
    memoryUsagePercent: number
    /** Uptime in milliseconds */
    uptime: number
    /** Current timestamp */
    timestamp: number
  }
  /** Custom tags */
  tags: Record<string, string>
}

/**
 * Performance data sample
 * @private
 */
interface PerformanceSample {
  timestamp: number
  executionTime: number
  success: boolean
  memoryUsage?: number
}

/**
 * Advanced performance monitoring system
 *
 * Tracks execution performance, system metrics, and provides
 * real-time analytics for runners and operations.
 *
 * @example
 * ```typescript
 * const monitor = new PerformanceMonitor({
 *   collectInterval: 5000,
 *   trackMemory: true,
 *   tags: { component: 'trading-runner' }
 * })
 *
 * monitor.start()
 *
 * // Record operations
 * monitor.recordOperation(125, true)
 * monitor.recordOperation(87, false)
 *
 * // Get current metrics
 * const metrics = monitor.getMetrics()
 * console.log(`Success rate: ${metrics.execution.successRate}%`)
 *
 * monitor.stop()
 * ```
 */
export class PerformanceMonitor {
  private readonly config: Required<PerformanceMonitorConfig>
  private readonly samples: PerformanceSample[] = []
  private readonly startTime = Date.now()

  private collectIntervalId: NodeJS.Timeout | undefined
  private isRunning = false
  private totalOperations = 0
  private successfulOperations = 0
  private executionTimes: number[] = []

  /**
   * Creates a new PerformanceMonitor instance
   *
   * @param config - Configuration options
   */
  constructor(config: PerformanceMonitorConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      collectInterval: config.collectInterval ?? 5000,
      maxSamples: config.maxSamples ?? 100,
      trackMemory: config.trackMemory ?? true,
      trackCpu: config.trackCpu ?? false,
      tags: config.tags ?? {},
    }
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    if (!this.config.enabled || this.isRunning) {
      return
    }

    this.isRunning = true

    // Start periodic metrics collection
    this.collectIntervalId = setInterval(() => {
      this.collectSample()
    }, this.config.collectInterval)

    console.log(`📊 Performance monitoring started (interval: ${this.config.collectInterval}ms)`)
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false

    if (this.collectIntervalId) {
      clearInterval(this.collectIntervalId)
      this.collectIntervalId = undefined
    }

    console.log('📊 Performance monitoring stopped')
  }

  /**
   * Record an operation execution
   *
   * @param executionTime - Time taken in milliseconds
   * @param success - Whether the operation was successful
   */
  recordOperation(executionTime: number, success: boolean): void {
    if (!this.config.enabled) {
      return
    }

    this.totalOperations++
    if (success) {
      this.successfulOperations++
    }

    this.executionTimes.push(executionTime)

    // Keep execution times bounded
    if (this.executionTimes.length > this.config.maxSamples) {
      this.executionTimes.shift()
    }

    // Add to samples
    const sample: PerformanceSample = {
      timestamp: Date.now(),
      executionTime,
      success,
    }

    if (this.config.trackMemory) {
      sample.memoryUsage = this.getMemoryUsage()
    }

    this.samples.push(sample)

    // Keep samples bounded
    if (this.samples.length > this.config.maxSamples) {
      this.samples.shift()
    }
  }

  /**
   * Get current performance metrics
   *
   * @returns Current performance metrics snapshot
   */
  getMetrics(): PerformanceMetrics {
    const now = Date.now()
    const uptime = now - this.startTime

    // Calculate execution metrics
    const averageExecutionTime =
      this.executionTimes.length > 0
        ? this.executionTimes.reduce((sum, time) => sum + time, 0) / this.executionTimes.length
        : 0

    const minExecutionTime = this.executionTimes.length > 0 ? Math.min(...this.executionTimes) : 0

    const maxExecutionTime = this.executionTimes.length > 0 ? Math.max(...this.executionTimes) : 0

    const successRate =
      this.totalOperations > 0 ? (this.successfulOperations / this.totalOperations) * 100 : 0

    // Calculate operations per second (based on recent samples)
    const recentSamples = this.samples.filter(s => now - s.timestamp < 60000) // Last minute
    const operationsPerSecond = recentSamples.length > 0 ? recentSamples.length / 60 : 0

    // System metrics
    const memoryUsage = this.getMemoryUsage()
    const totalMemory = this.getTotalMemory()
    const memoryUsagePercent = totalMemory > 0 ? (memoryUsage / totalMemory) * 100 : 0

    return {
      timestamp: now,
      execution: {
        totalOperations: this.totalOperations,
        successfulOperations: this.successfulOperations,
        failedOperations: this.totalOperations - this.successfulOperations,
        successRate: Math.round(successRate * 100) / 100,
        averageExecutionTime: Math.round(averageExecutionTime * 100) / 100,
        minExecutionTime: Math.round(minExecutionTime * 100) / 100,
        maxExecutionTime: Math.round(maxExecutionTime * 100) / 100,
        operationsPerSecond: Math.round(operationsPerSecond * 100) / 100,
      },
      system: {
        memoryUsage: Math.round(memoryUsage * 100) / 100,
        memoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100,
        uptime,
        timestamp: now,
      },
      tags: { ...this.config.tags },
    }
  }

  /**
   * Get performance summary for logging
   *
   * @returns Formatted performance summary string
   */
  getSummary(): string {
    const metrics = this.getMetrics()
    const uptimeMinutes = Math.round((metrics.system.uptime / 60000) * 100) / 100

    return [
      `📊 Performance Summary:`,
      `   Operations: ${metrics.execution.totalOperations} (${metrics.execution.successRate}% success)`,
      `   Avg Time: ${metrics.execution.averageExecutionTime}ms`,
      `   Ops/sec: ${metrics.execution.operationsPerSecond}`,
      `   Memory: ${metrics.system.memoryUsage}MB (${metrics.system.memoryUsagePercent}%)`,
      `   Uptime: ${uptimeMinutes}min`,
    ].join('\n')
  }

  /**
   * Reset all metrics and samples
   */
  reset(): void {
    this.samples.length = 0
    this.executionTimes.length = 0
    this.totalOperations = 0
    this.successfulOperations = 0
  }

  /**
   * Check if monitoring is currently active
   */
  isActive(): boolean {
    return this.isRunning
  }

  /**
   * Collect a performance sample
   * @private
   */
  private collectSample(): void {
    if (!this.config.enabled) {
      return
    }

    const sample: PerformanceSample = {
      timestamp: Date.now(),
      executionTime: 0, // This is for periodic collection, not operation-specific
      success: true,
    }

    if (this.config.trackMemory) {
      sample.memoryUsage = this.getMemoryUsage()
    }

    this.samples.push(sample)

    // Keep samples bounded
    if (this.samples.length > this.config.maxSamples) {
      this.samples.shift()
    }
  }

  /**
   * Get current memory usage in MB
   * @private
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024
    }
    return 0
  }

  /**
   * Get total available memory in MB
   * @private
   */
  private getTotalMemory(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapTotal / 1024 / 1024
    }
    return 0
  }
}

/**
 * Global performance monitor instance
 *
 * Provides a singleton monitor for use across the application.
 * Configure once and use everywhere.
 */
export const globalPerformanceMonitor = new PerformanceMonitor({
  tags: { component: 'solana-kit-bot' },
})
