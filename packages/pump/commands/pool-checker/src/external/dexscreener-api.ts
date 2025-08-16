/**
 * @fileoverview DexScreener API client for querying token and pair data
 *
 * Based on official DexScreener API documentation:
 * https://docs.dexscreener.com/api/reference
 */

/**
 * DexScreener API response types
 */
export interface DexScreenerPair {
  chainId: string
  dexId: string
  url: string
  pairAddress: string
  labels: string[]
  baseToken: {
    address: string
    name: string
    symbol: string
  }
  quoteToken: {
    address: string
    name: string
    symbol: string
  }
  priceNative: string
  priceUsd: string
  txns: Record<string, { buys: number; sells: number }>
  volume: Record<string, number>
  priceChange: Record<string, number>
  liquidity: {
    usd: number
    base: number
    quote: number
  }
  fdv: number
  marketCap: number
  pairCreatedAt: number
  info?: {
    imageUrl?: string
    websites?: Array<{ url: string }>
    socials?: Array<{ platform: string; handle: string }>
  }
  boosts?: {
    active: number
  }
}

export interface DexScreenerResponse {
  schemaVersion: string
  pairs: DexScreenerPair[]
}

export interface TokenProfile {
  url: string
  chainId: string
  tokenAddress: string
  icon?: string
  header?: string
  description?: string
  links?: Array<{
    type: string
    label: string
    url: string
  }>
}

export interface TokenBoost {
  url: string
  chainId: string
  tokenAddress: string
  amount: number
  totalAmount: number
  icon?: string
  header?: string
  description?: string
  links?: Array<{
    type: string
    label: string
    url: string
  }>
}

export interface OrderStatus {
  type: string
  status: string
  paymentTimestamp: number
}

/**
 * DexScreener API client with rate limiting, caching, and request deduplication
 */
export class DexScreenerAPI {
  private readonly baseUrl = 'https://api.dexscreener.com'
  private readonly rateLimits = {
    tokenProfiles: { limit: 60, window: 60000 }, // 60 requests per minute
    pairs: { limit: 300, window: 60000 }, // 300 requests per minute
  }
  private requestCounts = {
    tokenProfiles: 0,
    pairs: 0,
  }
  private lastReset = {
    tokenProfiles: Date.now(),
    pairs: Date.now(),
  }
  
  // Enhanced caching system
  private cache = new Map<string, { data: any; timestamp: number; expiry: number }>()
  private pendingRequests = new Map<string, Promise<any>>()
  
  // Cache expiry times in milliseconds
  private readonly cacheExpiry = {
    tokenInfo: 5 * 60 * 1000,      // 5 minutes for token info
    tokenPairs: 2 * 60 * 1000,     // 2 minutes for pairs
    tokenPrice: 30 * 1000,         // 30 seconds for price data
    tokenBoosts: 10 * 60 * 1000,   // 10 minutes for boost data
    search: 60 * 1000,             // 1 minute for search results
  }

  /**
   * Check rate limit and wait if necessary
   */
  private async checkRateLimit(type: 'tokenProfiles' | 'pairs'): Promise<void> {
    const now = Date.now()
    const limit = this.rateLimits[type]
    const lastReset = this.lastReset[type]

    // Reset counter if window has passed
    if (now - lastReset > limit.window) {
      this.requestCounts[type] = 0
      this.lastReset[type] = now
    }

    // Check if we're at the limit
    if (this.requestCounts[type] >= limit.limit) {
      const waitTime = limit.window - (now - lastReset)
      console.log(`⚠️ Rate limit reached for ${type}, waiting ${waitTime}ms`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      this.requestCounts[type] = 0
      this.lastReset[type] = now
    }

    this.requestCounts[type]++
  }

  /**
   * Get data from cache if valid
   */
  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() < cached.expiry) {
      return cached.data as T
    }
    
    // Clean up expired cache entry
    if (cached) {
      this.cache.delete(key)
    }
    
    return null
  }

  /**
   * Set data in cache with expiry
   */
  private setCachedData(key: string, data: any, expiryMs: number): void {
    const now = Date.now()
    this.cache.set(key, {
      data,
      timestamp: now,
      expiry: now + expiryMs
    })
    
    // Periodic cache cleanup (every 100 entries)
    if (this.cache.size % 100 === 0) {
      this.cleanupCache()
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now()
    const expiredKeys: string[] = []
    
    this.cache.forEach((value, key) => {
      if (now >= value.expiry) {
        expiredKeys.push(key)
      }
    })
    
    expiredKeys.forEach(key => this.cache.delete(key))
    
    if (expiredKeys.length > 0) {
      console.log(`🧹 DexScreener cache: cleaned up ${expiredKeys.length} expired entries`)
    }
  }

  /**
   * Make API request with caching and deduplication
   */
  private async makeRequest<T>(
    endpoint: string, 
    type: 'tokenProfiles' | 'pairs',
    cacheKey?: string,
    cacheExpiryMs?: number
  ): Promise<T> {
    // Check cache first if key provided
    if (cacheKey) {
      const cached = this.getCachedData<T>(cacheKey)
      if (cached) {
        return cached
      }
      
      // Check for pending request to avoid duplicate calls
      const pendingRequest = this.pendingRequests.get(cacheKey)
      if (pendingRequest) {
        return pendingRequest as Promise<T>
      }
    }

    const requestPromise = this.executeRequest<T>(endpoint, type)
    
    // Store pending request to prevent duplicates
    if (cacheKey) {
      this.pendingRequests.set(cacheKey, requestPromise)
    }

    try {
      const result = await requestPromise
      
      // Cache the result if key and expiry provided
      if (cacheKey && cacheExpiryMs) {
        this.setCachedData(cacheKey, result, cacheExpiryMs)
      }
      
      return result
    } finally {
      // Clean up pending request
      if (cacheKey) {
        this.pendingRequests.delete(cacheKey)
      }
    }
  }

  /**
   * Execute the actual API request
   */
  private async executeRequest<T>(endpoint: string, type: 'tokenProfiles' | 'pairs'): Promise<T> {
    await this.checkRateLimit(type)

    try {
      // Create fetch with timeout using AbortController
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SolanaKitBot/1.0'
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status} ${response.statusText}`)
      }
      
      const json = await response.json()
      return json as T
    } catch (error) {
      console.error(`❌ DexScreener API request failed: ${endpoint}`, error)
      throw error
    }
  }

  /**
   * Get the latest token profiles (rate-limit 60 requests per minute)
   */
  async getLatestTokenProfiles(): Promise<TokenProfile[]> {
    return this.makeRequest<TokenProfile[]>(
      '/token-profiles/latest/v1', 
      'tokenProfiles',
      'latest_profiles',
      this.cacheExpiry.search
    )
  }

  /**
   * Get the latest boosted tokens (rate-limit 60 requests per minute)
   */
  async getLatestBoostedTokens(): Promise<TokenBoost[]> {
    return this.makeRequest<TokenBoost[]>('/token-boosts/latest/v1', 'tokenProfiles')
  }

  /**
   * Get the tokens with most active boosts (rate-limit 60 requests per minute)
   */
  async getTopBoostedTokens(): Promise<TokenBoost[]> {
    return this.makeRequest<TokenBoost[]>('/token-boosts/top/v1', 'tokenProfiles')
  }

  /**
   * Check orders paid for of token (rate-limit 60 requests per minute)
   */
  async checkTokenOrders(chainId: string, tokenAddress: string): Promise<OrderStatus[]> {
    return this.makeRequest<OrderStatus[]>(`/orders/v1/${chainId}/${tokenAddress}`, 'tokenProfiles')
  }

  /**
   * Get one or multiple pairs by chain and pair address (rate-limit 300 requests per minute)
   */
  async getPairsByAddress(chainId: string, pairId: string): Promise<DexScreenerResponse> {
    return this.makeRequest<DexScreenerResponse>(`/latest/dex/pairs/${chainId}/${pairId}`, 'pairs')
  }

  /**
   * Search for pairs matching query (rate-limit 300 requests per minute)
   */
  async searchPairs(query: string): Promise<DexScreenerResponse> {
    const encodedQuery = encodeURIComponent(query)
    return this.makeRequest<DexScreenerResponse>(`/latest/dex/search?q=${encodedQuery}`, 'pairs')
  }

  /**
   * Get the pools of a given token address (rate-limit 300 requests per minute)
   */
  async getTokenPairs(chainId: string, tokenAddress: string): Promise<DexScreenerPair[]> {
    return this.makeRequest<DexScreenerPair[]>(
      `/token-pairs/v1/${chainId}/${tokenAddress}`,
      'pairs'
    )
  }

  /**
   * Get one or multiple pairs by token address (rate-limit 300 requests per minute)
   * Supports up to 30 comma-separated addresses
   */
  async getPairsByTokenAddresses(
    chainId: string,
    tokenAddresses: string[]
  ): Promise<DexScreenerPair[]> {
    if (tokenAddresses.length > 30) {
      throw new Error('Maximum 30 token addresses allowed per request')
    }

    const addresses = tokenAddresses.join(',')
    return this.makeRequest<DexScreenerPair[]>(`/tokens/v1/${chainId}/${addresses}`, 'pairs')
  }

  /**
   * Get specific token pair information for Solana
   */
  async getSolanaPair(pairAddress: string): Promise<DexScreenerPair | null> {
    try {
      const response = await this.getPairsByAddress('solana', pairAddress)
      return response.pairs[0] || null
    } catch (error) {
      console.error(`❌ Failed to get Solana pair: ${pairAddress}`, error)
      return null
    }
  }

  /**
   * Get all pairs for a specific token on Solana
   */
  async getSolanaTokenPairs(tokenAddress: string): Promise<DexScreenerPair[]> {
    try {
      const cacheKey = `solana_pairs_${tokenAddress}`
      const res = await this.makeRequest<DexScreenerPair[]>(
        `/token-pairs/v1/solana/${tokenAddress}`,
        'pairs',
        cacheKey,
        this.cacheExpiry.tokenPairs
      )

      return res || []
    } catch (error) {
      console.error(`❌ Failed to get Solana token pairs: ${tokenAddress}`, error)
      return []
    }
  }

  /**
   * Search for Solana pairs
   */
  async searchSolanaPairs(query: string): Promise<DexScreenerPair[]> {
    try {
      const response = await this.searchPairs(query)
      return response.pairs.filter(pair => pair.chainId === 'solana')
    } catch (error) {
      console.error(`❌ Failed to search Solana pairs: ${query}`, error)
      return []
    }
  }

  /**
   * Get token price information
   */
  async getTokenPrice(tokenAddress: string): Promise<{
    priceUsd: string
    priceNative: string
    volume24h: number
    liquidityUsd: number
    priceChange24h: number
  } | null> {
    try {
      const pairs = await this.getSolanaTokenPairs(tokenAddress)

      if (pairs.length === 0) {
        return null
      }

      // Get the pair with highest liquidity
      const bestPair = pairs.reduce((best, current) =>
        current.liquidity.usd > best.liquidity.usd ? current : best
      )

      return {
        priceUsd: bestPair.priceUsd,
        priceNative: bestPair.priceNative,
        volume24h: bestPair.volume['h24'] || 0,
        liquidityUsd: bestPair.liquidity.usd,
        priceChange24h: bestPair.priceChange['h24'] || 0,
      }
    } catch (error) {
      console.error(`❌ Failed to get token price: ${tokenAddress}`, error)
      return null
    }
  }

  /**
   * Check if token has active boosts
   */
  async hasActiveBoosts(tokenAddress: string): Promise<boolean> {
    try {
      const pairs = await this.getSolanaTokenPairs(tokenAddress)
      return pairs.some(pair => pair.boosts?.active && pair.boosts.active > 0)
    } catch (error) {
      console.error(`❌ Failed to check boosts: ${tokenAddress}`, error)
      return false
    }
  }

  /**
   * Get total boost amount for a token
   */
  async getTotalBoostAmount(tokenAddress: string): Promise<number> {
    try {
      const pairs = await this.getSolanaTokenPairs(tokenAddress)
      const totalBoost = pairs.reduce((sum, pair) => {
        return sum + (pair.boosts?.active || 0)
      }, 0)
      return totalBoost
    } catch (error) {
      console.error(`❌ Failed to get total boost amount: ${tokenAddress}`, error)
      return 0
    }
  }

  /**
   * Get comprehensive token information including metadata, boosts, and total boost amount
   */
  async getTokenInfo(tokenAddress: string): Promise<{
    metadata: {
      name: string
      symbol: string
      imageUrl?: string
      websites?: string[]
      socials?: Array<{ platform: string; handle: string }>
    } | null
    hasActiveBoosts: boolean
    totalBoostAmount: number
  }> {
    try {
      const cacheKey = `token_info_${tokenAddress}`
      
      // Check cache first
      const cached = this.getCachedData<{
        metadata: any
        hasActiveBoosts: boolean
        totalBoostAmount: number
      }>(cacheKey)
      
      if (cached) {
        return cached
      }

      const pairs = await this.getSolanaTokenPairs(tokenAddress)

      if (pairs.length === 0) {
        const result = {
          metadata: null,
          hasActiveBoosts: false,
          totalBoostAmount: 0,
        }
        
        // Cache negative result for shorter time
        this.setCachedData(cacheKey, result, 30 * 1000) // 30 seconds
        return result
      }

      const pair = pairs[0]!
      const metadata: {
        name: string
        symbol: string
        imageUrl?: string
        websites?: string[]
        socials?: Array<{ platform: string; handle: string }>
      } = {
        name: pair.baseToken.name,
        symbol: pair.baseToken.symbol,
      }

      if (pair.info?.imageUrl) {
        metadata.imageUrl = pair.info.imageUrl
      }
      if (pair.info?.websites) {
        metadata.websites = pair.info.websites.map(w => w.url)
      }
      if (pair.info?.socials) {
        metadata.socials = pair.info.socials
      }

      // Get boost information from first pair (all pairs have same boost amount)
      const hasActiveBoosts = !!(pair.boosts?.active && pair.boosts.active > 0)
      const totalBoostAmount = pair.boosts?.active || 0

      const result = {
        metadata,
        hasActiveBoosts,
        totalBoostAmount,
      }
      
      // Cache result
      this.setCachedData(cacheKey, result, this.cacheExpiry.tokenInfo)
      
      return result
    } catch (error) {
      console.error(`❌ Failed to get token info: ${tokenAddress}`, error)
      return {
        metadata: null,
        hasActiveBoosts: false,
        totalBoostAmount: 0,
      }
    }
  }

  /**
   * Get token metadata (name, symbol, image, etc.)
   */
  async getTokenMetadata(tokenAddress: string): Promise<{
    name: string
    symbol: string
    imageUrl?: string
    websites?: string[]
    socials?: Array<{ platform: string; handle: string }>
  } | null> {
    try {
      const pairs = await this.getSolanaTokenPairs(tokenAddress)

      if (pairs.length === 0) {
        return null
      }

      const pair = pairs[0]!
      const result: {
        name: string
        symbol: string
        imageUrl?: string
        websites?: string[]
        socials?: Array<{ platform: string; handle: string }>
      } = {
        name: pair.baseToken.name,
        symbol: pair.baseToken.symbol,
      }

      if (pair.info?.imageUrl) {
        result.imageUrl = pair.info.imageUrl
      }
      if (pair.info?.websites) {
        result.websites = pair.info.websites.map(w => w.url)
      }
      if (pair.info?.socials) {
        result.socials = pair.info.socials
      }

      return result
    } catch (error) {
      console.error(`❌ Failed to get token metadata: ${tokenAddress}`, error)
      return null
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now()
    let validEntries = 0
    let expiredEntries = 0
    
    this.cache.forEach(value => {
      if (now < value.expiry) {
        validEntries++
      } else {
        expiredEntries++
      }
    })
    
    return {
      total: this.cache.size,
      valid: validEntries,
      expired: expiredEntries,
      pending: this.pendingRequests.size
    }
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear()
    this.pendingRequests.clear()
    console.log('🧹 DexScreener cache cleared')
  }

  /**
   * Force cleanup expired cache entries
   */
  forceCleanupCache() {
    const sizeBefore = this.cache.size
    this.cleanupCache()
    const sizeAfter = this.cache.size
    console.log(`🧹 DexScreener cache: removed ${sizeBefore - sizeAfter} expired entries`)
  }
}
