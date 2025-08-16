import type { PrismaClient } from '~/database/client'
import type { PoolCheckerConfig } from '~/types'

export class ConfigService {
  constructor(private readonly db: PrismaClient) {}

  async getConfigs() {
    return this.db.config.findMany()
  }

  async createConfig(data: Omit<PoolCheckerConfig, 'id'>) {
    return this.db.config.create({ data })
  }

  async updateConfig(data: PoolCheckerConfig) {
    return this.db.config.update({ data, where: { id: data.id! } })
  }

  async deleteConfig(id: string) {
    return this.db.config.delete({ where: { id } })
  }
}
