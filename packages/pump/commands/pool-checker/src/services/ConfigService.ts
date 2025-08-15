import type { PrismaClient } from '~/database/client'
import { DatabaseOptimizer } from '~/utils/database-optimizer'

export class ConfigService {
  private dbOptimizer = DatabaseOptimizer.getInstance()

  constructor(private readonly db: PrismaClient) {
    this.db = this.dbOptimizer.getOptimizedClient(this.db)
  }

  async getConfigs() {
    return this.dbOptimizer.executeOptimizedQuery(
      this.db,
      'configs_all',
      () => this.db.config.findMany(),
      60000 // Cache for 1 minute
    )
  }

  async getConfigById(id: string) {
    return this.dbOptimizer.executeOptimizedQuery(
      this.db,
      `config_${id}`,
      () => this.db.config.findUnique({ where: { id } }),
      300000 // Cache for 5 minutes
    )
  }

  async createConfig(data: any) {
    // Invalidate cache when creating new config
    this.dbOptimizer.clearCaches()
    return this.db.config.create({ data })
  }

  async updateConfig(id: string, data: any) {
    // Invalidate cache when updating config
    this.dbOptimizer.clearCaches()
    return this.db.config.update({ where: { id }, data })
  }

  async deleteConfig(id: string) {
    // Invalidate cache when deleting config
    this.dbOptimizer.clearCaches()
    return this.db.config.delete({ where: { id } })
  }

  async getActiveConfigs() {
    return this.dbOptimizer.executeOptimizedQuery(
      this.db,
      'configs_active',
      () => this.db.config.findMany({
        where: {
          // Add any active conditions here if needed
        },
        orderBy: { id: 'desc' }
      }),
      30000 // Cache for 30 seconds
    )
  }

  getMetrics() {
    return this.dbOptimizer.getMetrics()
  }

  async healthCheck() {
    return this.dbOptimizer.healthCheck(this.db)
  }
}
