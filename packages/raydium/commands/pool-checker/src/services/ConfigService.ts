import type { PrismaClient } from '~/database/client'
import { PoolCheckerMapper } from '~/mapper'
import { ConfigRepository } from '~/repository'
import { type PoolCheckerConfig } from '~/validator/pool-checker-validator'

export class ConfigService {
  private configRepository: ConfigRepository

  constructor(prisma: PrismaClient) {
    this.configRepository = new ConfigRepository(prisma, new PoolCheckerMapper())
  }

  async getAllConfig(): Promise<PoolCheckerConfig[]> {
    return this.configRepository.findAll()
  }

  async createNewConfig(config: PoolCheckerConfig) {
    await this.configRepository.save(config)
  }

  async deleteConfig(id: string) {
    await this.configRepository.deleteById(id)
  }

  async updateConfig(id: string, config: PoolCheckerConfig) {
    await this.configRepository.updateById(id, config)
  }

  async getConfigById(id: string) {
    return this.configRepository.findById(id)
  }
}
