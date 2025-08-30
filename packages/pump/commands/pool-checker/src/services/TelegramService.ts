import { Telegraf } from 'telegraf'

/**
 * Configuration interface for TelegramService
 */
export interface TelegramConfig {
  /** Bot token from @BotFather */
  botToken: string
  /** Array of chat IDs that should receive notifications */
  chatIds: string[]
  /** Enable/disable notifications */
  enabled: boolean
}

/**
 * Interface for pool notification data
 */
export interface PoolNotification {
  poolAddress: string
  baseMint: string
  quoteMint: string
  baseAmount?: bigint
  quoteAmount?: bigint
  action: 'NEW_POOL' | 'BUY_SUCCESS' | 'TARGET_REACHED' | 'ERROR'
  message?: string
  timestamp?: Date
}

/**
 * TelegramService - Chuyên dùng để gửi thông báo đến bot Telegram
 *
 * Tính năng:
 * - Gửi thông báo pool mới
 * - Thông báo giao dịch mua thành công
 * - Cảnh báo lỗi
 * - Quản lý danh sách chat ID
 * - Hỗ trợ gửi tin nhắn broadcast
 */
export class TelegramService {
  private bot: Telegraf | null = null
  private config: TelegramConfig
  private isInitialized = false

  constructor(config: TelegramConfig) {
    this.config = config
    this.initialize()
  }

  /**
   * Khởi tạo bot Telegram
   */
  private initialize(): void {
    if (!this.config.enabled || !this.config.botToken) {
      console.log('🤖 Telegram service is disabled or no bot token provided')
      return
    }

    try {
      this.bot = new Telegraf(this.config.botToken)
      this.isInitialized = true
      console.log('✅ Telegram service initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize Telegram service:', error)
      this.isInitialized = false
    }
  }

  /**
   * Kiểm tra xem service có được khởi tạo thành công không
   */
  public isReady(): boolean {
    return this.isInitialized && this.bot !== null && this.config.enabled
  }

  /**
   * Cập nhật cấu hình Telegram
   */
  public updateConfig(newConfig: Partial<TelegramConfig>): void {
    this.config = { ...this.config, ...newConfig }

    // Khởi tạo lại nếu bot token thay đổi
    if (newConfig.botToken && newConfig.botToken !== this.config.botToken) {
      this.initialize()
    }
  }

  /**
   * Thêm chat ID vào danh sách nhận thông báo
   */
  public addChatId(chatId: string): void {
    if (!this.config.chatIds.includes(chatId)) {
      this.config.chatIds.push(chatId)
      console.log(`✅ Added chat ID: ${chatId}`)
    }
  }

  /**
   * Xóa chat ID khỏi danh sách nhận thông báo
   */
  public removeChatId(chatId: string): void {
    const index = this.config.chatIds.indexOf(chatId)
    if (index > -1) {
      this.config.chatIds.splice(index, 1)
      console.log(`✅ Removed chat ID: ${chatId}`)
    }
  }

  /**
   * Lấy danh sách chat ID hiện tại
   */
  public getChatIds(): string[] {
    return [...this.config.chatIds]
  }

  /**
   * Gửi tin nhắn đến một chat cụ thể
   */
  public async sendMessage(chatId: string, message: string): Promise<boolean> {
    if (!this.isReady()) {
      console.log('⚠️ Telegram service is not ready')
      return false
    }

    try {
      await this.bot!.telegram.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        link_preview_options: { is_disabled: true },
      })
      return true
    } catch (error) {
      console.error(`❌ Failed to send message to chat ${chatId}:`, error)
      return false
    }
  }

  /**
   * Gửi tin nhắn broadcast đến tất cả chat ID
   */
  public async sendBroadcastMessage(message: string): Promise<{ success: number; failed: number }> {
    if (!this.isReady()) {
      console.log('⚠️ Telegram service is not ready')
      return { success: 0, failed: 0 }
    }

    if (this.config.chatIds.length === 0) {
      console.log('📭 No chat IDs configured for notifications')
      return { success: 0, failed: 0 }
    }

    let successCount = 0
    let failedCount = 0

    console.log(`📤 Sending broadcast message to ${this.config.chatIds.length} chats...`)

    for (const chatId of this.config.chatIds) {
      const success = await this.sendMessage(chatId, message)
      if (success) {
        successCount++
      } else {
        failedCount++
      }

      // Delay để tránh rate limit
      await this.delay(100)
    }

    console.log(`✅ Broadcast completed: ${successCount} success, ${failedCount} failed`)
    return { success: successCount, failed: failedCount }
  }

  /**
   * Gửi thông báo về pool mới
   */
  public async notifyNewPool(poolData: {
    poolAddress: string
    baseMint: string
    quoteMint: string
    baseAmount?: bigint
    quoteAmount?: bigint
  }): Promise<void> {
    const message = this.formatNewPoolMessage(poolData)
    await this.sendBroadcastMessage(message)
  }

  /**
   * Gửi thông báo giao dịch mua thành công
   */
  public async notifyBuySuccess(buyData: {
    poolAddress: string
    baseMint: string
    payer: string
    txSignature?: string
  }): Promise<void> {
    const message = this.formatBuySuccessMessage(buyData)
    await this.sendBroadcastMessage(message)
  }

  /**
   * Gửi thông báo đạt target
   */
  public async notifyTargetReached(targetData: {
    poolAddress: string
    baseMint: string
    targetAmount: bigint
    currentAmount: bigint
  }): Promise<void> {
    const message = this.formatTargetReachedMessage(targetData)
    await this.sendBroadcastMessage(message)
  }

  /**
   * Gửi thông báo lỗi
   */
  public async notifyError(errorData: {
    poolAddress?: string
    error: string
    context?: string
  }): Promise<void> {
    const message = this.formatErrorMessage(errorData)
    await this.sendBroadcastMessage(message)
  }

  /**
   * Gửi thông báo tùy chỉnh với data pool
   */
  public async sendPoolNotification(notification: PoolNotification): Promise<void> {
    let message: string

    switch (notification.action) {
      case 'NEW_POOL':
        message = this.formatNewPoolMessage(notification)
        break
      case 'BUY_SUCCESS':
        message = this.formatBuySuccessMessage(notification)
        break
      case 'TARGET_REACHED':
        message = this.formatTargetReachedMessage(notification)
        break
      case 'ERROR':
        message = this.formatErrorMessage({
          poolAddress: notification.poolAddress,
          error: notification.message || 'Unknown error',
          context: notification.quoteMint,
        })
        break
      default:
        message = notification.message || 'Unknown notification type'
    }

    await this.sendBroadcastMessage(message)
  }

  /**
   * Format tin nhắn pool mới
   */
  private formatNewPoolMessage(data: {
    poolAddress: string
    baseMint: string
    quoteMint?: string
    baseAmount?: bigint
    quoteAmount?: bigint
  }): string {
    const timestamp = new Date().toLocaleString('vi-VN')

    return `🎯 **POOL MỚI PHÁT HIỆN**
    
📍 **Pool Address:** \`${data.poolAddress}\`
🪙 **Base Mint:** \`${data.baseMint}\`
${data.quoteMint ? `💰 **Quote Mint:** \`${data.quoteMint}\`` : ''}
${data.baseAmount ? `📊 **Base Amount:** ${this.formatAmount(data.baseAmount)}` : ''}
${data.quoteAmount ? `💵 **Quote Amount:** ${this.formatAmount(data.quoteAmount)}` : ''}

⏰ **Thời gian:** ${timestamp}

🔗 [Xem trên Solscan](https://solscan.io/account/${data.poolAddress})`
  }

  /**
   * Format tin nhắn mua thành công
   */
  private formatBuySuccessMessage(data: {
    poolAddress: string
    baseMint: string
    txSignature?: string
    payer?: string
  }): string {
    const timestamp = new Date().toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

    return `🟢 **ĐÃ MUA TOKEN MỚI**

+ ⏰ Thời gian: ${timestamp}
+ 🪙 Token: \`${data.baseMint}\`
+ 📍 Pool: \`${data.poolAddress}\`

🔍 Xem chi tiết:
  • 📊 [Xem giao dich trên Dexscreener](https://dexscreener.com/solana/${data.poolAddress}?maker=${data.payer})
  • 🔗 [Xem giao dịch Solscan](https://solscan.io/account/${data.poolAddress})
  • 📋 [Xem holders](https://solscan.io/token/${data.baseMint}#holders)
`
  }

  /**
   * Format tin nhắn đạt target
   */
  private formatTargetReachedMessage(data: {
    poolAddress: string
    baseMint: string
    targetAmount?: bigint
    currentAmount?: bigint
  }): string {
    const timestamp = new Date().toLocaleString('vi-VN')

    return `🎯 **ĐÃ ĐẠT TARGET**
    
📍 **Pool:** \`${data.poolAddress}\`
🪙 **Token:** \`${data.baseMint}\`
${data.targetAmount ? `🎯 **Target:** ${this.formatAmount(data.targetAmount)}` : ''}
${data.currentAmount ? `📊 **Current:** ${this.formatAmount(data.currentAmount)}` : ''}

⏰ **Thời gian:** ${timestamp}`
  }

  /**
   * Format tin nhắn lỗi
   */
  private formatErrorMessage(data: {
    poolAddress?: string
    error: string
    context?: string
    message?: string
  }): string {
    const timestamp = new Date().toLocaleString('vi-VN')

    return `❌ **LỖI**
    
${data.poolAddress ? `📍 **Pool:** \`${data.poolAddress}\`` : ''}
${data.context ? `📝 **Context:** ${data.context}` : ''}
🚨 **Error:** ${data.message || data.error}

⏰ **Thời gian:** ${timestamp}`
  }

  /**
   * Format số lượng token
   */
  private formatAmount(amount: bigint): string {
    const num = Number(amount)
    if (num >= 1_000_000_000) {
      return `${(num / 1_000_000_000).toFixed(2)}B`
    } else if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(2)}K`
    }
    return num.toLocaleString()
  }

  /**
   * Delay utility function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Đóng kết nối bot (cleanup)
   */
  public async close(): Promise<void> {
    if (this.bot) {
      try {
        await this.bot.stop()
        console.log('✅ Telegram bot stopped successfully')
      } catch (error) {
        console.error('❌ Error stopping Telegram bot:', error)
      }
      this.bot = null
      this.isInitialized = false
    }
  }
}
