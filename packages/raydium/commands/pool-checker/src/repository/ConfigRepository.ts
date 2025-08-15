import type { Config, PrismaClient } from '~/database/client'
import { PoolCheckerMapper } from '~/mapper'
import type { PoolCheckerConfig } from '~/validator/pool-checker-validator'

export class ConfigRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly poolCheckerMapper: PoolCheckerMapper
  ) {}

  async findAll(): Promise<PoolCheckerConfig[]> {
    const data = await this.db.config.findMany()
    return data.map((item: Config) => this.poolCheckerMapper.toDomain(item))
  }

  async findById(id: string): Promise<PoolCheckerConfig | null> {
    const data = await this.db.config.findUnique({ where: { id } })
    return data ? this.poolCheckerMapper.toDomain(data) : null
  }

  async save(config: PoolCheckerConfig) {
    const data = this.poolCheckerMapper.toEntity(config)
    try {
      await this.db.config.create({ data })
    } catch (error) {
      console.error('Error saving config:', error)
      throw error
    }
  }

  async updateById(id: string, config: PoolCheckerConfig) {
    const data = this.poolCheckerMapper.toEntity(config)
    try {
      await this.db.config.update({
        where: { id },
        data: data,
      })
    } catch (error) {
      console.error('Error updating config:', error)
      throw error
    }
  }

  async deleteById(id: string) {
    try {
      await this.db.config.delete({ where: { id } })
    } catch (error) {
      console.error('Error deleting config:', error)
      throw error
    }
  }
}
