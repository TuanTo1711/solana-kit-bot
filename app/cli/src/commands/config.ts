/**
 * @fileoverview Configuration management command for Solana Bot CLI
 *
 * This module provides interactive configuration management for the Solana bot,
 * allowing users to set, view, and update bot settings using the 'conf' library.
 * Supports both interactive prompts and direct value setting for automation.
 */

import chalk from 'chalk'
import { Command } from 'clipanion'
import Conf from 'conf'
import figlet from 'figlet'
import gradient from 'gradient-string'
import inquirer from 'inquirer'

import type { SolanaBotConfig } from '@solana-kit-bot/core'

/**
 * Configuration management command for Solana Bot CLI
 *
 * Provides interactive interface for managing bot configuration settings
 * including RPC endpoints, wallet keys, and database connections.
 */
export class ConfigCommand extends Command {
  static override paths = [['config']]

  /** Configuration instance using 'conf' library */
  private config: Conf<SolanaBotConfig>

  constructor() {
    super()
    this.config = new Conf<SolanaBotConfig>({
      projectName: '.solana-bot-cli',
      configName: 'config',
      schema: {
        rpc: {
          type: 'string',
          default: 'https://api.mainnet-beta.solana.com',
        },
        wsUrl: {
          type: 'string',
          default: 'wss://api.mainnet-beta.solana.com',
        },
        privateKey: {
          type: 'string',
        },
        dbUrl: {
          type: 'string',
          default: '',
        },
      },
    })
  }

  /**
   * Main execution method for the config command
   *
   * Provides interactive menu for configuration management operations
   */
  async execute(): Promise<number | void> {
    // Clear screen and display beautiful banner
    console.clear()

    const configBanner = figlet.textSync('CONFIG', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default',
    })
    console.log('\n' + gradient(['#4F46E5', '#7C3AED'])(configBanner))
    console.log(gradient(['#4F46E5', '#7C3AED'])('═'.repeat(100)))

    const now = new Date()
    const timeString = now.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    console.log(
      chalk.hex('#4F46E5')('⚙️ ') +
        chalk.white.bold('Solana Bot - Configuration Management System') +
        chalk.hex('#4F46E5')(' ⚙️')
    )
    console.log(
      chalk.gray('⏰ ') +
        chalk.white(`${timeString}`) +
        chalk.gray('  │  🟢 ') +
        chalk.hex('#4F46E5')('Active') +
        chalk.gray('  │  🔧 ') +
        chalk.hex('#7C3AED')('Ready')
    )
    console.log(gradient(['#4F46E5', '#7C3AED'])('═'.repeat(100)))

    const { action } = await inquirer.prompt<{ action: string }>({
      type: 'list',
      name: 'action',
      message: chalk.bold('🎯 Chọn hành động:'),
      choices: [
        { name: '📋 Xem cấu hình hiện tại', value: 'view' },
        { name: '✏️ Chỉnh sửa cấu hình', value: 'edit' },
        { name: '🔑 Thiết lập private key', value: 'set-key' },
        { name: '🌐 Thiết lập RPC endpoints', value: 'set-rpc' },
        { name: '🗄️ Thiết lập database', value: 'set-db' },
        { name: '🔄 Reset về mặc định', value: 'reset' },
        { name: '📁 Xem đường dẫn config file', value: 'path' },
        new inquirer.Separator(chalk.hex('#7C3AED')('─'.repeat(100))),
        { name: '❌ Thoát', value: 'exit' },
      ],
      theme: {
        style: {
          answer: (text: string) => chalk.hex('#4F46E5')(text),
          message: (text: string, status: string) =>
            status === 'done' ? chalk.hex('#4F46E5')(text) : chalk.hex('#7C3AED')(text),
          error: (text: string) => chalk.red(text),
          defaultAnswer: (text: string) => chalk.dim(text),
          help: (text: string) => chalk.dim(text),
          highlight: (text: string) => chalk.hex('#4F46E5').bold(text),
          key: (text: string) => chalk.hex('#7C3AED').bold(text),
        },
      },
    })

    switch (action) {
      case 'view':
        await this.viewConfig()
        break
      case 'edit':
        await this.editConfig()
        break
      case 'set-key':
        await this.setPrivateKey()
        break
      case 'set-rpc':
        await this.setRpcEndpoints()
        break
      case 'set-db':
        await this.setDatabase()
        break
      case 'reset':
        await this.resetConfig()
        break
      case 'path':
        this.showConfigPath()
        break
      case 'exit':
        console.log(chalk.yellow('👋 Tạm biệt!'))
        return 0
      default:
        console.log(chalk.red('❌ Hành động không hợp lệ'))
        return 1
    }
  }

  /**
   * Display current configuration settings
   *
   * Shows all current configuration values in a formatted table
   */
  private async viewConfig(): Promise<void> {
    // Clear screen and show banner
    console.log('\x1b[2J\x1b[0f')

    const viewBanner = figlet.textSync('VIEW CONFIG', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default',
    })
    console.log('\n' + gradient(['#4F46E5', '#7C3AED'])(viewBanner) + '\n')
    console.log(gradient(['#4F46E5', '#7C3AED'])('═'.repeat(100)) + '\n')

    const currentConfig = this.config.store
    const configItems = [
      { key: 'RPC Endpoint', value: currentConfig.rpc || 'Chưa thiết lập', icon: '🌐' },
      { key: 'WebSocket URL', value: currentConfig.wsUrl || 'Chưa thiết lập', icon: '🔌' },
      {
        key: 'Private Key',
        value: currentConfig.privateKey
          ? `${currentConfig.privateKey.substring(0, 8)}...${currentConfig.privateKey.substring(currentConfig.privateKey.length - 8)}`
          : 'Chưa thiết lập',
        icon: '🔑',
      },
      { key: 'Database URL', value: currentConfig.dbUrl || 'Chưa thiết lập', icon: '🗄️' },
    ]

    console.log(chalk.hex('#4F46E5').bold('\n📋 Cấu hình hiện tại:\n\n'))

    configItems.forEach(item => {
      const status = item.value === 'Chưa thiết lập' ? chalk.red('❌') : chalk.green('✅')
      console.log(
        `${status} ${chalk.hex('#4F46E5').bold(`${item.icon} ${item.key}`)}:\n` +
          `   ${chalk.white(item.value)}\n\n`
      )
    })

    console.log(chalk.gray('💡 Sử dụng "config --edit" để chỉnh sửa cấu hình\n'))
    console.log(gradient(['#4F46E5', '#7C3AED'])('═'.repeat(100)) + '\n')

    await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continue',
        message: chalk.hex('#4F46E5').bold('Nhấn Enter để quay lại menu chính...'),
        default: true,
      },
    ])
  }

  /**
   * Interactive configuration editing
   *
   * Provides step-by-step prompts for editing all configuration values
   */
  private async editConfig(): Promise<void> {
    console.log(chalk.cyan.bold('\n✏️ Chỉnh sửa cấu hình:\n'))

    try {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'rpc',
          message: 'RPC Endpoint URL:',
          default: this.config.get('rpc') || 'https://api.mainnet-beta.solana.com',
        },
        {
          type: 'input',
          name: 'wsUrl',
          message: 'WebSocket URL:',
          default: this.config.get('wsUrl') || 'wss://api.mainnet-beta.solana.com',
        },
        {
          type: 'password',
          name: 'privateKey',
          message: 'Private Key (base58):',
          default: this.config.get('privateKey') || '',
        },
        {
          type: 'input',
          name: 'dbUrl',
          message: 'Database URL (tùy chọn):',
          default: this.config.get('dbUrl') || '',
        },
      ])

      // Save configuration
      Object.entries(answers).forEach(([key, value]) => {
        if (value !== undefined) {
          this.config.set(key as keyof SolanaBotConfig, value)
        }
      })

      console.log(chalk.green('✅ Cấu hình đã được cập nhật thành công!'))
    } catch (error) {
      console.log(chalk.red(`❌ Lỗi: ${error instanceof Error ? error.message : 'Unknown error'}`))
    }
  }

  /**
   * Set private key specifically
   *
   * Dedicated method for securely setting the wallet private key
   */
  private async setPrivateKey(): Promise<void> {
    console.log(chalk.cyan.bold('\n🔑 Thiết lập Private Key:\n'))

    const { privateKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'privateKey',
        message: 'Nhập private key (base58):',
        mask: '*',
      },
    ])

    this.config.set('privateKey', privateKey)
    console.log(chalk.green('✅ Private key đã được lưu thành công!'))
  }

  /**
   * Set RPC endpoints
   *
   * Configure RPC and WebSocket endpoints for Solana network connection
   */
  private async setRpcEndpoints(): Promise<void> {
    console.log(chalk.cyan.bold('\n🌐 Thiết lập RPC Endpoints:\n'))

    const { rpc, wsUrl } = await inquirer.prompt([
      {
        type: 'input',
        name: 'rpc',
        message: 'RPC Endpoint URL:',
        default: this.config.get('rpc') || 'https://api.mainnet-beta.solana.com',
      },
      {
        type: 'input',
        name: 'wsUrl',
        message: 'WebSocket URL:',
        default: this.config.get('wsUrl') || 'wss://api.mainnet-beta.solana.com',
      },
    ])

    this.config.set('rpc', rpc)
    this.config.set('wsUrl', wsUrl)
    console.log(chalk.green('✅ RPC endpoints đã được cập nhật thành công!'))
  }

  /**
   * Set database configuration
   *
   * Configure database URL for bot data storage
   */
  private async setDatabase(): Promise<void> {
    console.log(chalk.cyan.bold('\n🗄️ Thiết lập Database:\n'))

    const { dbUrl } = await inquirer.prompt([
      {
        type: 'input',
        name: 'dbUrl',
        message: 'Database URL (tùy chọn):',
        default: this.config.get('dbUrl') || '',
      },
    ])

    if (dbUrl.trim()) {
      this.config.set('dbUrl', dbUrl)
      console.log(chalk.green('✅ Database URL đã được cập nhật thành công!'))
    } else {
      this.config.delete('dbUrl')
      console.log(chalk.yellow('ℹ️ Database URL đã được xóa'))
    }
  }

  /**
   * Reset configuration to defaults
   *
   * Clears all custom configuration and resets to default values
   */
  private async resetConfig(): Promise<void> {
    console.log(chalk.cyan.bold('\n🔄 Reset cấu hình:\n'))

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Bạn có chắc chắn muốn reset tất cả cấu hình về mặc định?',
        default: false,
      },
    ])

    if (confirm) {
      this.config.clear()
      console.log(chalk.green('✅ Cấu hình đã được reset về mặc định!'))
    } else {
      console.log(chalk.yellow('ℹ️ Hủy bỏ reset cấu hình'))
    }
  }

  /**
   * Show configuration file path
   *
   * Displays the location of the configuration file
   */
  private showConfigPath(): void {
    console.log(chalk.cyan.bold('\n📁 Đường dẫn config file:\n'))
    console.log(chalk.white(this.config.path))
    console.log(chalk.gray('\n💡 Bạn có thể chỉnh sửa file này trực tiếp nếu cần'))
  }
}
