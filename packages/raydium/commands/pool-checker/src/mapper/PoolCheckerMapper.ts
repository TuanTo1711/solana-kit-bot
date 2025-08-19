import type { Config } from '~/database/client'
import type { PoolCheckerConfig } from '~/validator/pool-checker-validator'

export class PoolCheckerMapper {
  toEntity(config: PoolCheckerConfig) {
    return {
      target: config.target,
      hasBoost: config.hasBoost,
      hasImage: config.hasImage,
      expiresHour: config.expiresHour,
      amount: config.amount,
      profitSell: config.profitSell,
      totalBoost: config.totalBoost ?? null,
      jitoTip: BigInt(config.jitoTip * 10 ** 9),
    }
  }

  toDomain(entity: Config): PoolCheckerConfig {
    return {
      id: entity.id,
      target: BigInt(entity.target),
      hasBoost: entity.hasBoost,
      hasImage: entity.hasImage,
      expiresHour: entity.expiresHour,
      amount: BigInt(entity.amount),
      profitSell: entity.profitSell,
      jitoTip: Number(entity.jitoTip) / 10 ** 9,
    }
  }
}
