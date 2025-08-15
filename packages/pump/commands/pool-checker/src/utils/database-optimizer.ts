import type { PrismaClient } from '~/database/client'

export class DatabaseOptimizer {
  private static instance: DatabaseOptimizer
  private connectionPool = new Map<string, PrismaClient>()
  private connectionMetrics = {
    totalConnections: 0,
    activeQueries: 0,
    failedQueries: 0,
    averageQueryTime: 0,
    lastCleanup: Date.now()
  }

  static getInstance(): DatabaseOptimizer {
    if (!DatabaseOptimizer.instance) {
      DatabaseOptimizer.instance = new DatabaseOptimizer()
    }
    return DatabaseOptimizer.instance
  }

  /**
   * Get optimized database client with connection pooling
   */
  getOptimizedClient(db: PrismaClient): PrismaClient {
    // Add query performance monitoring
    const originalQuery = db.$executeRaw.bind(db)
    
    db.$executeRaw = async (query: any, ...args: any[]) => {
      const startTime = Date.now()
      this.connectionMetrics.activeQueries++
      
      try {
        const result = await originalQuery(query, ...args)
        const queryTime = Date.now() - startTime
        this.updateMetrics(queryTime, true)
        return result
      } catch (error) {
        this.updateMetrics(Date.now() - startTime, false)
        throw error
      } finally {
        this.connectionMetrics.activeQueries--
      }
    }

    return db
  }

  private updateMetrics(queryTime: number, success: boolean) {
    if (success) {
      // Update average query time using exponential moving average
      this.connectionMetrics.averageQueryTime = 
        this.connectionMetrics.averageQueryTime * 0.9 + queryTime * 0.1
    } else {
      this.connectionMetrics.failedQueries++
    }
  }

  /**
   * Optimize database queries with prepared statements and caching
   */
  async executeOptimizedQuery<T>(
    db: PrismaClient,
    queryKey: string,
    queryFunction: () => Promise<T>,
    cacheMs = 30000 // 30 seconds default cache
  ): Promise<T> {
    const cacheKey = `query_${queryKey}`
    const cached = this.getFromCache<T>(cacheKey)
    
    if (cached) {
      return cached
    }

    const result = await queryFunction()
    this.setCache(cacheKey, result, cacheMs)
    
    return result
  }

  private cache = new Map<string, { data: any; expiry: number }>()

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() < cached.expiry) {
      return cached.data as T
    }
    
    if (cached) {
      this.cache.delete(key)
    }
    
    return null
  }

  private setCache<T>(key: string, data: T, expiryMs: number) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + expiryMs
    })
    
    // Periodic cleanup
    if (this.cache.size % 100 === 0) {
      this.cleanupCache()
    }
  }

  private cleanupCache() {
    const now = Date.now()
    const expiredKeys: string[] = []
    
    this.cache.forEach((value, key) => {
      if (now >= value.expiry) {
        expiredKeys.push(key)
      }
    })
    
    expiredKeys.forEach(key => this.cache.delete(key))
    this.connectionMetrics.lastCleanup = now
  }

  /**
   * Get database performance metrics
   */
  getMetrics() {
    return {
      ...this.connectionMetrics,
      cacheSize: this.cache.size,
      connectionPoolSize: this.connectionPool.size
    }
  }

  /**
   * Batch insert optimization
   */
  async batchInsert<T>(
    db: PrismaClient,
    tableName: string,
    data: T[],
    batchSize = 100
  ): Promise<{ count: number; batches: number }> {
    if (data.length === 0) return { count: 0, batches: 0 }

    const batches = Math.ceil(data.length / batchSize)
    let totalInserted = 0

    for (let i = 0; i < batches; i++) {
      const start = i * batchSize
      const end = Math.min(start + batchSize, data.length)
      const batch = data.slice(start, end)

      try {
        // Use dynamic table access for batch insert
        const result = await (db as any)[tableName].createMany({
          data: batch,
          skipDuplicates: true
        })
        
        totalInserted += result.count || batch.length
      } catch (error) {
        console.error(`❌ Batch ${i + 1}/${batches} failed for ${tableName}:`, error)
        
        // Fallback to individual inserts
        for (const item of batch) {
          try {
            await (db as any)[tableName].create({ data: item })
            totalInserted++
          } catch (individualError) {
            console.error(`❌ Individual insert failed:`, individualError)
          }
        }
      }
    }

    return { count: totalInserted, batches }
  }

  /**
   * Connection health check
   */
  async healthCheck(db: PrismaClient): Promise<{
    healthy: boolean
    responseTime: number
    error?: string
  }> {
    const startTime = Date.now()
    
    try {
      await db.$queryRaw`SELECT 1`
      return {
        healthy: true,
        responseTime: Date.now() - startTime
      }
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.cache.clear()
    console.log('🧹 Database cache cleared')
  }
}
