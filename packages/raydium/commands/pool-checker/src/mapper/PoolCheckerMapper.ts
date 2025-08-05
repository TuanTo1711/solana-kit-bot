import type { Config } from '~/database/client'
import type { PoolCheckerConfig } from '~/validator/pool-checker-validator'

export class PoolCheckerMapper {
  toEntity(config: PoolCheckerConfig) {
    return {
      target: config.target.toString(),
      mustBoost: config.mustBoost,
      hasImage: config.hasImage,
      expiredTime: Number(config.expiredTime),
      amount: config.amount.toString(),
      profitAutoSell: config.profitAutoSell,
      totalBoost: config.totalBoost ?? null,
      jitoTip: config.jitoTip,
    }
  }

  toDomain(entity: Config): PoolCheckerConfig {
    return {
      id: entity.id,
      target: BigInt(entity.target),
      mustBoost: entity.mustBoost,
      hasImage: entity.hasImage,
      expiredTime: entity.expiredTime,
      amount: BigInt(entity.amount),
      profitAutoSell: entity.profitAutoSell,
      jitoTip: entity.jitoTip,
    }
  }
}
