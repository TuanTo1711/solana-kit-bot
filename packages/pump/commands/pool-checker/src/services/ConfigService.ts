import type { PrismaClient } from '~/database/client'

export class ConfigService {
  constructor(private readonly db: PrismaClient) {}

  async getConfigs() {
    return this.db.config.findMany()
  }
}
