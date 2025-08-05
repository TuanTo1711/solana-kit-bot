import { PrismaClient, type Pool } from '../database/client'
import type { PoolCreateInput } from '../database/models/Pool'
import { PoolRepository } from '../repository/PoolRepository'

/**
 * Service class for managing pool business logic
 *
 * Handles pool operations including validation, transformation, and business rules
 */
export class PoolService {
  private poolRepository: PoolRepository

  constructor(prisma: PrismaClient) {
    this.poolRepository = new PoolRepository(prisma)
  }

  /**
   * Add a new pool to the database from Telegram bot
   *
   * @param poolAddress - Pool address from Telegram command
   * @param poolKeys - Pool keys from Raydium client
   * @returns Created pool entity
   */
  async addPoolFromTelegram(poolAddress: string, poolKeys: any): Promise<Pool> {
    try {
      // Validate pool address
      if (!this.isValidPoolAddress(poolAddress)) {
        throw new Error('Invalid pool address format')
      }

      // Check if pool already exists
      const existingPool = await this.poolRepository.findByAddress(poolAddress)
      if (existingPool) {
        throw new Error(`Pool with address ${poolAddress} already exists`)
      }

      // Transform pool keys to database format
      const poolData = this.transformPoolKeysToData(poolAddress, poolKeys)

      // Create pool in database
      const createdPool = await this.poolRepository.create(poolData)

      return createdPool
    } catch (error) {
      throw new Error(
        `Failed to add pool from Telegram: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get pool by address
   *
   * @param poolAddress - Pool address to find
   * @returns Pool entity or null if not found
   */
  async getPoolByAddress(poolAddress: string): Promise<Pool | null> {
    try {
      return await this.poolRepository.findByAddress(poolAddress)
    } catch (error) {
      throw new Error(
        `Failed to get pool by address: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get all active pools
   *
   * @param limit - Maximum number of pools to return
   * @returns Array of active pool entities
   */
  async getActivePools(limit?: number): Promise<Pool[]> {
    try {
      const queryOptions: any = {
        orderBy: { address: 'asc' },
      }

      if (limit !== undefined) {
        queryOptions.take = limit
      }

      return await this.poolRepository.findAll(queryOptions)
    } catch (error) {
      throw new Error(
        `Failed to get active pools: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get all pools with pagination
   *
   * @param page - Page number (1-based)
   * @param pageSize - Number of pools per page
   * @returns Array of pool entities
   */
  async getPoolsWithPagination(page: number = 1, pageSize: number = 10): Promise<Pool[]> {
    try {
      const skip = (page - 1) * pageSize
      return await this.poolRepository.findAll({
        orderBy: { address: 'asc' },
        take: pageSize,
        skip,
      })
    } catch (error) {
      throw new Error(
        `Failed to get pools with pagination: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Delete pool by address
   *
   * @param poolAddress - Pool address to delete
   * @returns Deleted pool entity
   */
  async deletePool(poolAddress: string): Promise<Pool> {
    try {
      const existingPool = await this.poolRepository.findByAddress(poolAddress)
      if (!existingPool) {
        throw new Error(`Pool with address ${poolAddress} not found`)
      }

      return await this.poolRepository.deleteByAddress(poolAddress)
    } catch (error) {
      throw new Error(
        `Failed to delete pool: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get pool statistics
   *
   * @returns Object containing pool statistics
   */
  async getPoolStatistics(): Promise<{
    total: number
  }> {
    try {
      const [total] = await Promise.all([this.poolRepository.count()])

      return { total }
    } catch (error) {
      throw new Error(
        `Failed to get pool statistics: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Search pools by address (partial match)
   *
   * @param searchTerm - Search term for pool address
   * @param limit - Maximum number of results
   * @returns Array of matching pool entities
   */
  async searchPools(searchTerm: string, limit: number = 10): Promise<Pool[]> {
    try {
      // For now, we'll get all pools and filter in memory
      // In a production environment, you might want to use database-level search
      const allPools = await this.poolRepository.findAll({
        orderBy: { address: 'asc' },
      })

      return allPools
        .filter(pool => pool.address.toLowerCase().includes(searchTerm.toLowerCase()))
        .slice(0, limit)
    } catch (error) {
      throw new Error(
        `Failed to search pools: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Validate pool address format
   *
   * @param address - Pool address to validate
   * @returns True if valid, false otherwise
   */
  private isValidPoolAddress(address: string): boolean {
    // Basic validation for Solana address format
    // Solana addresses are base58 encoded and typically 32-44 characters long
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    return base58Regex.test(address)
  }

  /**
   * Transform pool keys from Raydium client to database format
   *
   * @param poolAddress - Pool address
   * @param poolKeys - Pool keys from Raydium client
   * @returns Pool data for database
   */
  private transformPoolKeysToData(poolAddress: string, poolKeys: any): PoolCreateInput {
    return {
      address: poolAddress,
      token0Vault: poolKeys.token0Vault?.toString() || '',
      token1Vault: poolKeys.token1Vault?.toString() || '',
      token0Mint: poolKeys.token0Mint?.toString() || '',
      token1Mint: poolKeys.token1Mint?.toString() || '',
      lpMint: poolKeys.lpMint?.toString() || '',
      ammConfig: poolKeys.ammConfig?.toString() || '',
      observationKey: poolKeys.observationKey?.toString() || '',
    }
  }
}
