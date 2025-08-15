/**
 * @fileoverview Performance monitoring utilities for virtual trading
 */

import { PERFORMANCE_LOG_INTERVAL_MS } from './constants'

export interface PerformanceMetrics {
  tradingMetrics: {
    totalIterations: number
    successfulIterations: number
    failedIterations: number
    averageIterationTime: number
    totalTradesExecuted: number
    totalBundlesSent: number
  }
  poolMetrics: {
    baseReserve: bigint
    quoteReserve: bigint
    lastUpdateTimestamp: number
    timeSinceLastUpdate: number
    activeSubscriptions: number
  }
  systemMetrics: {
    memoryUsage: NodeJS.MemoryUsage
    uptime: number
    averageResponseTime: number
  }
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics['tradingMetrics'] = {
    totalIterations: 0,
    successfulIterations: 0,
    failedIterations: 0,
    averageIterationTime: 0,
    totalTradesExecuted: 0,
    totalBundlesSent: 0,
  }

  private iterationTimes: number[] = []
  private startTime = Date.now()
  private isLogging = false
  private logInterval: NodeJS.Timeout | null = null

  /**
   * Start performance logging
   */
  startLogging(): void {
    if (this.isLogging) return

    this.isLogging = true
    this.logInterval = setInterval(() => {
      this.logPerformanceMetrics()
    }, PERFORMANCE_LOG_INTERVAL_MS)
  }

  /**
   * Stop performance logging
   */
  stopLogging(): void {
    if (!this.isLogging) return

    this.isLogging = false
    if (this.logInterval) {
      clearInterval(this.logInterval)
      this.logInterval = null
    }
  }

  /**
   * Record iteration metrics
   */
  recordIteration(duration: number, success: boolean, tradesCount: number = 0): void {
    this.metrics.totalIterations++

    if (success) {
      this.metrics.successfulIterations++
      this.metrics.totalTradesExecuted += tradesCount
    } else {
      this.metrics.failedIterations++
    }

    this.iterationTimes.push(duration)

    // Keep only last 100 iterations for average calculation
    if (this.iterationTimes.length > 100) {
      this.iterationTimes.shift()
    }

    this.metrics.averageIterationTime =
      this.iterationTimes.reduce((a, b) => a + b, 0) / this.iterationTimes.length
  }

  /**
   * Record bundle sent
   */
  recordBundleSent(): void {
    this.metrics.totalBundlesSent++
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics['tradingMetrics'] {
    return { ...this.metrics }
  }

  /**
   * Get full performance snapshot including system and pool metrics
   */
  getFullMetrics(poolMetrics?: PerformanceMetrics['poolMetrics']): PerformanceMetrics {
    return {
      tradingMetrics: this.getMetrics(),
      poolMetrics: poolMetrics || {
        baseReserve: 0n,
        quoteReserve: 0n,
        lastUpdateTimestamp: 0,
        timeSinceLastUpdate: 0,
        activeSubscriptions: 0,
      },
      systemMetrics: {
        memoryUsage: process.memoryUsage(),
        uptime: Date.now() - this.startTime,
        averageResponseTime: this.metrics.averageIterationTime,
      },
    }
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = {
      totalIterations: 0,
      successfulIterations: 0,
      failedIterations: 0,
      averageIterationTime: 0,
      totalTradesExecuted: 0,
      totalBundlesSent: 0,
    }
    this.iterationTimes = []
    this.startTime = Date.now()
  }

  /**
   * Log performance metrics to console
   */
  private logPerformanceMetrics(): void {
    const metrics = this.getFullMetrics()

    console.log('\n📊 Performance Metrics:')
    console.log(
      `   Iterations: ${metrics.tradingMetrics.successfulIterations}/${metrics.tradingMetrics.totalIterations} successful`
    )
    console.log(`   Avg time: ${metrics.tradingMetrics.averageIterationTime.toFixed(2)}ms`)
    console.log(`   Total trades: ${metrics.tradingMetrics.totalTradesExecuted}`)
    console.log(`   Bundles sent: ${metrics.tradingMetrics.totalBundlesSent}`)
    console.log(
      `   Memory: ${(metrics.systemMetrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`
    )
    console.log(`   Uptime: ${(metrics.systemMetrics.uptime / 1000 / 60).toFixed(1)}min\n`)
  }
}
