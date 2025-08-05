import { PrismaClient, type Pool } from '../database/client'
import type { PoolCreateInput, PoolUpdateInput } from '../database/models/Pool'

/**
 * Repository class for managing Pool entities in the database
 *
 * Provides CRUD operations and business logic for pool management
 */
export class PoolRepository {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Create a new pool in the database
   *
   * @param data - Pool data to create
   * @returns Created pool entity
   */
  async create(data: PoolCreateInput): Promise<Pool> {
    try {
      return await this.prisma.pool.create({
        data,
      })
    } catch (error) {
      throw new Error(
        `Failed to create pool: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Find a pool by its address
   *
   * @param address - Pool address to search for
   * @returns Pool entity or null if not found
   */
  async findByAddress(address: string): Promise<Pool | null> {
    try {
      return await this.prisma.pool.findUnique({
        where: { address },
      })
    } catch (error) {
      throw new Error(
        `Failed to find pool by address: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Find a pool by its ID
   *
   * @param id - Pool ID to search for
   * @returns Pool entity or null if not found
   */
  async findById(id: string): Promise<Pool | null> {
    try {
      return await this.prisma.pool.findUnique({
        where: { id },
      })
    } catch (error) {
      throw new Error(
        `Failed to find pool by ID: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get all pools with optional filtering
   *
   * @param options - Query options including where, orderBy, take, skip
   * @returns Array of pool entities
   */
  async findAll(options?: {
    where?: { isActive?: boolean }
    orderBy?: { address?: 'asc' | 'desc' }
    take?: number
    skip?: number
  }): Promise<Pool[]> {
    try {
      const queryOptions: any = {}

      if (options?.where) {
        queryOptions.where = options.where
      }
      if (options?.orderBy) {
        queryOptions.orderBy = options.orderBy
      }
      if (options?.take !== undefined) {
        queryOptions.take = options.take
      }
      if (options?.skip !== undefined) {
        queryOptions.skip = options.skip
      }

      return await this.prisma.pool.findMany(queryOptions)
    } catch (error) {
      throw new Error(
        `Failed to find pools: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Update a pool by its address
   *
   * @param address - Pool address to update
   * @param data - Data to update
   * @returns Updated pool entity
   */
  async updateByAddress(address: string, data: PoolUpdateInput): Promise<Pool> {
    try {
      return await this.prisma.pool.update({
        where: { address },
        data,
      })
    } catch (error) {
      throw new Error(
        `Failed to update pool: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Update a pool by its ID
   *
   * @param id - Pool ID to update
   * @param data - Data to update
   * @returns Updated pool entity
   */
  async updateById(id: string, data: PoolUpdateInput): Promise<Pool> {
    try {
      return await this.prisma.pool.update({
        where: { id },
        data,
      })
    } catch (error) {
      throw new Error(
        `Failed to update pool: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Delete a pool by its address
   *
   * @param address - Pool address to delete
   * @returns Deleted pool entity
   */
  async deleteByAddress(address: string): Promise<Pool> {
    try {
      return await this.prisma.pool.delete({
        where: { address },
      })
    } catch (error) {
      throw new Error(
        `Failed to delete pool: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Delete a pool by its ID
   *
   * @param id - Pool ID to delete
   * @returns Deleted pool entity
   */
  async deleteById(id: string): Promise<Pool> {
    try {
      return await this.prisma.pool.delete({
        where: { id },
      })
    } catch (error) {
      throw new Error(
        `Failed to delete pool: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Count total pools with optional filtering
   *
   * @param where - Filter conditions
   * @returns Total count of pools
   */
  async count(where?: { isActive?: boolean }): Promise<number> {
    try {
      const queryOptions: any = {}

      if (where) {
        queryOptions.where = where
      }

      return await this.prisma.pool.count(queryOptions)
    } catch (error) {
      throw new Error(
        `Failed to count pools: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Check if a pool exists by address
   *
   * @param address - Pool address to check
   * @returns True if pool exists, false otherwise
   */
  async existsByAddress(address: string): Promise<boolean> {
    try {
      const pool = await this.prisma.pool.findUnique({
        where: { address },
        select: { id: true },
      })
      return pool !== null
    } catch (error) {
      throw new Error(
        `Failed to check pool existence: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Create or update a pool (upsert operation)
   *
   * @param address - Pool address
   * @param data - Pool data
   * @returns Created or updated pool entity
   */
  async upsert(address: string, data: PoolCreateInput): Promise<Pool> {
    try {
      return await this.prisma.pool.upsert({
        where: { address },
        update: data,
        create: data,
      })
    } catch (error) {
      throw new Error(
        `Failed to upsert pool: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}
