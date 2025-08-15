import type { PoolKeys } from '@solana-kit-bot/pumpswap'
import type { PrismaClient, PumpSwapPool } from '~/database/client'
import { DatabaseOptimizer } from '~/utils/database-optimizer'

export class PoolService {
  private dbOptimizer = DatabaseOptimizer.getInstance()

  constructor(private readonly db: PrismaClient) {
    this.db = this.dbOptimizer.getOptimizedClient(this.db)
  }

  async addPoolKeys(poolKeys: PoolKeys & { timestamp: bigint }) {
    try {
      return await this.db.pumpSwapPool.create({
        data: this.mapToEntity(poolKeys, poolKeys.timestamp),
      })
    } catch (error: any) {
      // Handle duplicate key errors gracefully
      if (error.code === 'P2002') {
        console.warn(`Pool already exists: ${poolKeys.pool.toString()}`)
        return null
      }
      throw error
    }
  }

  async addPoolKeysBatch(poolKeysList: (PoolKeys & { timestamp: bigint })[]) {
    if (poolKeysList.length === 0) return { count: 0, batches: 0 }

    const entities = poolKeysList.map(poolKeys => 
      this.mapToEntity(poolKeys, poolKeys.timestamp)
    )

    return this.dbOptimizer.batchInsert(this.db, 'pumpSwapPool', entities, 50)
  }

  async getPoolStats() {
    return this.dbOptimizer.executeOptimizedQuery(
      this.db,
      'pool_stats',
      async () => {
        const [total, last24h] = await Promise.all([
          this.db.pumpSwapPool.count(),
          this.db.pumpSwapPool.count({
            where: {
              timestamp: {
                gte: BigInt(Date.now() - 24 * 60 * 60 * 1000),
              },
            },
          }),
        ])

        return { total, last24h }
      },
      60000 // 1 minute cache
    )
  }

  getMetrics() {
    return this.dbOptimizer.getMetrics()
  }

  async healthCheck() {
    return this.dbOptimizer.healthCheck(this.db)
  }

  mapToEntity(poolKeys: PoolKeys, timestamp: bigint): PumpSwapPool {
    return {
      pool: poolKeys.pool.toString(),
      poolBump: poolKeys.poolBump,
      baseMint: poolKeys.baseMint.toString(),
      quoteMint: poolKeys.quoteMint.toString(),
      coinCreator: poolKeys.coinCreator.toString(),
      creator: poolKeys.creator.toString(),
      index: poolKeys.index,
      lpMint: poolKeys.lpMint.toString(),
      poolBaseTokenAccount: poolKeys.poolBaseTokenAccount.toString(),
      poolQuoteTokenAccount: poolKeys.poolQuoteTokenAccount.toString(),
      lpSupply: BigInt(poolKeys.lpSupply),
      timestamp: timestamp,
    }
  }
}
