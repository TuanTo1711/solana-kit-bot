import type { PoolKeys } from '@solana-kit-bot/pumpswap'
import type { PrismaClient, PumpSwapPool } from '~/database/client'

export class PoolService {
  constructor(private readonly db: PrismaClient) {}

  async addPoolKeys(poolKeys: PoolKeys & { timestamp: bigint }) {
    return await this.db.pumpSwapPool.create({
      data: this.mapToEntity(poolKeys, poolKeys.timestamp),
    })
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
