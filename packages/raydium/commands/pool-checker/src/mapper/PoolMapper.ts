import type { Pool as PoolEntity } from '../database/client'
import type { Pool, CreatePoolData, UpdatePoolData } from '../types/pool'

export class PoolMapper {
  toEntity(data: CreatePoolData | UpdatePoolData): Partial<PoolEntity> {
    return {
      id: 'id' in data ? data.id : undefined,
      address: data.address,
      token0Vault: data.token0Vault,
      token1Vault: data.token1Vault,
      token0Mint: data.token0Mint,
      token1Mint: data.token1Mint,
      lpMint: data.lpMint,
      configAddress: data.configAddress,
      observationKey: data.observationKey,
      isActive: data.isActive,
    }
  }

  toDomain(entity: PoolEntity): Pool {
    return {
      id: entity.id,
      address: entity.address,
      token0Vault: entity.token0Vault,
      token1Vault: entity.token1Vault,
      token0Mint: entity.token0Mint,
      token1Mint: entity.token1Mint,
      lpMint: entity.lpMint,
      configAddress: entity.configAddress,
      observationKey: entity.observationKey,
      isActive: entity.isActive,
      transactions: entity.transactions?.map(tx => ({
        id: tx.id,
        poolId: tx.poolId,
        signature: tx.signature,
        type: tx.type,
        amountIn: tx.amountIn,
        amountOut: tx.amountOut,
        priceImpact: tx.priceImpact,
        fee: tx.fee,
        tip: tx.tip,
        timestamp: tx.timestamp,
        buyer: tx.buyer,
        status: tx.status,
      })) || [],
    }
  }
} 