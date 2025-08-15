export interface PerformanceMetrics {
  poolsProcessed: number
  tokensValidated: number
  successfulPurchases: number
  failedPurchases: number
  averageValidationTime: number
  averagePurchaseTime: number
  cacheHitRate: number
  databaseMetrics: {
    totalQueries: number
    averageQueryTime: number
    failedQueries: number
  }
  memoryUsage: {
    heapUsed: number
    heapTotal: number
    external: number
    rss: number
  }
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: PerformanceMetrics = {
    poolsProcessed: 0,
    tokensValidated: 0,
    successfulPurchases: 0,
    failedPurchases: 0,
    averageValidationTime: 0,
    averagePurchaseTime: 0,
    cacheHitRate: 0,
    databaseMetrics: {
      totalQueries: 0,
      averageQueryTime: 0,
      failedQueries: 0
    },
    memoryUsage: {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      rss: 0
    }
  }

  private startTime = Date.now()
  private metricsHistory: Array<{ timestamp: number; metrics: PerformanceMetrics }> = []
  private maxHistorySize = 100

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  recordPoolProcessed() {
    this.metrics.poolsProcessed++
  }

  recordTokenValidation(validationTime: number) {
    this.metrics.tokensValidated++
    this.updateAverage('averageValidationTime', validationTime, this.metrics.tokensValidated)
  }

  recordPurchaseAttempt(success: boolean, purchaseTime: number) {
    if (success) {
      this.metrics.successfulPurchases++
    } else {
      this.metrics.failedPurchases++
    }
    
    const totalPurchases = this.metrics.successfulPurchases + this.metrics.failedPurchases
    this.updateAverage('averagePurchaseTime', purchaseTime, totalPurchases)
  }

  recordCacheHit(isHit: boolean) {
    const totalCacheRequests = this.metrics.tokensValidated
    if (totalCacheRequests > 0) {
      const currentHits = this.metrics.cacheHitRate * (totalCacheRequests - 1)
      const newHits = currentHits + (isHit ? 1 : 0)
      this.metrics.cacheHitRate = newHits / totalCacheRequests
    }
  }

  recordDatabaseQuery(queryTime: number, success: boolean) {
    this.metrics.databaseMetrics.totalQueries++
    if (!success) {
      this.metrics.databaseMetrics.failedQueries++
    }
    
    this.updateAverage(
      'databaseMetrics.averageQueryTime',
      queryTime,
      this.metrics.databaseMetrics.totalQueries,
      this.metrics.databaseMetrics
    )
  }

  private updateAverage(field: string, newValue: number, count: number, target: any = this.metrics) {
    const keys = field.split('.')
    let current = target
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]]
    }
    
    const lastKey = keys[keys.length - 1]
    const currentAverage = current[lastKey]
    current[lastKey] = (currentAverage * (count - 1) + newValue) / count
  }

  updateMemoryUsage() {
    const memoryUsage = process.memoryUsage()
    this.metrics.memoryUsage = {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memoryUsage.external / 1024 / 1024), // MB
      rss: Math.round(memoryUsage.rss / 1024 / 1024) // MB
    }
  }

  getMetrics(): PerformanceMetrics & { uptime: number } {
    this.updateMemoryUsage()
    return {
      ...this.metrics,
      uptime: Math.round((Date.now() - this.startTime) / 1000) // seconds
    }
  }

  getDetailedReport(): string {
    const metrics = this.getMetrics()
    const uptimeHours = Math.round(metrics.uptime / 3600 * 100) / 100
    
    return `
📊 Pumpswap Pool Checker Performance Report
═══════════════════════════════════════════

⏱️  Uptime: ${uptimeHours} hours
🔍 Pools Processed: ${metrics.poolsProcessed}
🏷️  Tokens Validated: ${metrics.tokensValidated}
✅ Successful Purchases: ${metrics.successfulPurchases}
❌ Failed Purchases: ${metrics.failedPurchases}

⚡ Performance Metrics:
   • Average Validation Time: ${Math.round(metrics.averageValidationTime)}ms
   • Average Purchase Time: ${Math.round(metrics.averagePurchaseTime)}ms
   • Cache Hit Rate: ${Math.round(metrics.cacheHitRate * 100)}%
   • Success Rate: ${Math.round(metrics.successfulPurchases / (metrics.successfulPurchases + metrics.failedPurchases) * 100) || 0}%

🗄️  Database Metrics:
   • Total Queries: ${metrics.databaseMetrics.totalQueries}
   • Average Query Time: ${Math.round(metrics.databaseMetrics.averageQueryTime)}ms
   • Failed Queries: ${metrics.databaseMetrics.failedQueries}

💾 Memory Usage:
   • Heap Used: ${metrics.memoryUsage.heapUsed}MB
   • Heap Total: ${metrics.memoryUsage.heapTotal}MB
   • External: ${metrics.memoryUsage.external}MB
   • RSS: ${metrics.memoryUsage.rss}MB
    `
  }

  saveSnapshot() {
    const snapshot = {
      timestamp: Date.now(),
      metrics: { ...this.metrics }
    }
    
    this.metricsHistory.push(snapshot)
    
    // Keep only last N snapshots
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift()
    }
  }

  getHistoricalData(hours = 1) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000)
    return this.metricsHistory.filter(snapshot => snapshot.timestamp >= cutoff)
  }

  reset() {
    this.metrics = {
      poolsProcessed: 0,
      tokensValidated: 0,
      successfulPurchases: 0,
      failedPurchases: 0,
      averageValidationTime: 0,
      averagePurchaseTime: 0,
      cacheHitRate: 0,
      databaseMetrics: {
        totalQueries: 0,
        averageQueryTime: 0,
        failedQueries: 0
      },
      memoryUsage: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0
      }
    }
    this.startTime = Date.now()
    console.log('📊 Performance metrics reset')
  }

  // Auto-save snapshots every 5 minutes
  startAutoSnapshot() {
    setInterval(() => {
      this.saveSnapshot()
    }, 5 * 60 * 1000) // 5 minutes
  }

  // Memory usage alert
  checkMemoryUsage() {
    this.updateMemoryUsage()
    const { heapUsed, rss } = this.metrics.memoryUsage
    
    if (heapUsed > 500) { // 500MB
      console.warn(`⚠️ High heap usage: ${heapUsed}MB`)
    }
    
    if (rss > 1000) { // 1GB
      console.warn(`⚠️ High RSS usage: ${rss}MB`)
    }
  }
}

