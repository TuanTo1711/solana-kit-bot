import { abbreviateNumber, wrapEscHandler, type SolanaBotContext } from '@solana-kit-bot/core'
import Table from 'cli-table3'
import { Command, type BaseContext } from 'clipanion'
import type { ConfigService } from '../services/ConfigService'
import { poolCheckerSchema, type PoolCheckerConfig } from '../validator/pool-checker-validator'

type PoolCheckerConfigContext = BaseContext &
  SolanaBotContext & {
    configService: ConfigService
  }

export class PoolCheckerConfigCommand extends Command<PoolCheckerConfigContext> {
  override async execute(): Promise<number | void> {
    const controller = new AbortController()
    const inquirer = (await import('inquirer')).default
    const prompt = inquirer.prompt

    while (!controller.signal.aborted) {
      const question = prompt<{ action: () => Promise<void> }>({
        type: 'select',
        name: 'action',
        message: 'Chọn một hành động: ',
        choices: [
          {
            name: '📋 Xem danh sách cấu hình',
            value: this.viewConfig.bind(this),
          },
          {
            name: '➕ Thêm cấu hình mới',
            value: this.addConfig.bind(this),
          },
          {
            name: '✏️ Sửa cấu hình',
            value: this.editConfig.bind(this),
          },
          {
            name: '🗑️ Xóa cấu hình',
            value: this.deleteConfig.bind(this),
          },
          new inquirer.Separator('-'.repeat(80)),
          {
            name: 'Quay lại menu',
            value: async () => controller.abort(),
          },
        ],
      })

      const { action } = await wrapEscHandler<typeof question>(question)

      await action()
    }
  }

  async viewConfig() {
    const { configService } = this.context
    const configs = await configService.getAllConfig()

    if (configs.length === 0) {
      console.log('📝 Không có cấu hình nào được tạo')
      return
    }

    const cliTable = new Table({
      head: [
        'ID',
        'Mục tiêu',
        'Boost',
        'Tổng boost',
        'Hình ảnh',
        'Hết hạn (giờ)',
        'Số tiền (SOL)',
        'Lợi nhuận (%)',
        'Tip (SOL)',
      ],
      colWidths: [5, 10, 7, 12, 10, 15, 15, 15, 10],
    })

    configs.forEach((config, index) => {
      cliTable.push([
        index + 1,
        abbreviateNumber(Number(config.target) / 10 ** 6),
        config.hasBoost ? '✅' : '❌',
        config.totalBoost ?? 'N/A',
        config.hasImage ? '✅' : '❌',
        (config.expiresHour / 3600).toFixed(0),
        Number(config.amount) / 10 ** 9,
        config.profitSell.toFixed(1),
        config.jitoTip.toFixed(3),
      ])
    })

    console.log('\n📋 Danh sách cấu hình Pool Checker: ')
    console.log(cliTable.toString())
    console.log(`\nTổng cộng: ${configs.length} cấu hình`)
  }

  async addConfig() {
    const inquirer = await import('inquirer')
    const prompt = inquirer.default.prompt

    const question = prompt<PoolCheckerConfig>([
      {
        type: 'input',
        name: 'target',
        message: 'Mức pool mục tiêu để kiểm tra: ',
        required: true,
        transformer: (value: string) => value.trim(),
        validate: (value: string) =>
          isNaN(Number(value)) || parseFloat(value) <= 0
            ? 'Mức pool mục tiêu phải là số lớn hơn 0'
            : true,
      },
      {
        type: 'confirm',
        name: 'hasBoost',
        message: 'Có cần kiểm tra boost không? ',
        default: false,
      },
      {
        type: 'input',
        name: 'totalBoost',
        message: 'Tổng boost muốn kiểm tra: ',
        required: true,
        when: ({ hasBoost: hasBoost }) => hasBoost,
        transformer: (value: string) => value.trim(),
        validate: (value: string) =>
          isNaN(Number(value)) || Number(value) <= 0 ? 'Tổng boost phải là số lớn hơn 0' : true,
      },
      {
        type: 'confirm',
        name: 'hasImage',
        message: 'Có cần kiểm tra ảnh không? ',
        default: false,
      },
      {
        type: 'input',
        name: 'expiresHour',
        message: 'Thời gian hết hạn (giờ): ',
        default: '15',
        required: true,
        transformer: (value: string) => value.trim(),
        validate: (value: string) =>
          isNaN(Number(value)) || Number(value) <= 0
            ? 'Thời gian hết hạn phải là số lớn hơn 0'
            : true,
      },
      {
        type: 'input',
        name: 'amount',
        message: 'Số tiền mua (SOL): ',
        required: true,
        transformer: (value: string) => value.trim(),
        validate: (value: string) =>
          isNaN(Number(value)) || parseFloat(value) <= 0
            ? 'Số tiền mua phải là số lớn hơn 0'
            : true,
      },
      {
        type: 'input',
        name: 'profitSell',
        message: 'Lợi nhuận tự động bán (%): ',
        required: true,
        transformer: (value: string) => value.trim(),
        validate: (value: string) =>
          isNaN(Number(value)) || parseFloat(value) <= 0
            ? 'Lợi nhuận tự động bán phải là số lớn hơn 0'
            : true,
        default: '80',
      },
      {
        type: 'input',
        name: 'jitoTip',
        message: 'Tip cho Jito (SOL): ',
        required: true,
        transformer: (value: string) => value.trim(),
        validate: (value: string) =>
          isNaN(Number(value)) || parseFloat(value) <= 0
            ? 'Tip cho Jito phải là số lớn hơn 0'
            : true,
        default: '0.001',
      },
    ])

    const answers = await wrapEscHandler<PoolCheckerConfig>(question)
    const parsedConfig = poolCheckerSchema.parse(answers)
    const { configService } = this.context
    await configService.createNewConfig(parsedConfig)

    this.context.stdout.write('Cấu hình đã được lưu thành công\n')
  }

  async deleteConfig() {
    const { configService } = this.context
    const configs = await configService.getAllConfig()

    if (configs.length === 0) {
      console.log('❌ Không có cấu hình nào để xóa')
      return
    }

    const inquirer = await import('inquirer')
    const prompt = inquirer.default.prompt

    const choices = configs.map((config, index) => ({
      name: `Config ${index + 1}: Target=${config.target}, Amount=${config.amount}`,
      value: config.id,
    }))

    const question = prompt<{ configId: string }>({
      type: 'list',
      name: 'configId',
      message: 'Chọn cấu hình để xóa:',
      choices,
    })

    const { configId } = await wrapEscHandler<typeof question>(question)

    if (configId) {
      await configService.deleteConfig(configId)
      console.log('✅ Cấu hình đã được xóa thành công')
    }
  }

  async editConfig() {
    const { configService } = this.context
    const configs = await configService.getAllConfig()

    if (configs.length === 0) {
      console.log('❌ Không có cấu hình nào để sửa')
      return
    }

    const inquirer = await import('inquirer')
    const prompt = inquirer.default.prompt

    const choices = configs.map((config, index) => ({
      name: `Config ${index + 1}: Target=${config.target}, Amount=${config.amount}`,
      value: config,
    }))

    const question = prompt<{ config: PoolCheckerConfig }>({
      type: 'list',
      name: 'config',
      message: 'Chọn cấu hình để sửa:',
      choices,
    })

    const { config } = await wrapEscHandler<typeof question>(question)

    if (config) {
      const updatedConfig = await this.editConfigFields(config)
      await configService.updateConfig(config.id!, updatedConfig)
      console.log('✅ Cấu hình đã được cập nhật thành công')
    }
  }

  private async editConfigFields(config: PoolCheckerConfig): Promise<PoolCheckerConfig> {
    const inquirer = await import('inquirer')
    const prompt = inquirer.default.prompt

    const question = prompt<Partial<PoolCheckerConfig>>([
      {
        type: 'input',
        name: 'target',
        message: `Mức pool mục tiêu (hiện tại: ${config.target}):`,
        default: config.target.toString(),
        transformer: (value: string) => value.trim(),
        validate: (value: string) =>
          isNaN(Number(value)) || parseFloat(value) <= 0
            ? 'Mức pool mục tiêu phải là số lớn hơn 0'
            : true,
      },
      {
        type: 'confirm',
        name: 'hasBoost',
        message: `Có cần kiểm tra boost không? (hiện tại: ${config.hasBoost ? 'Có' : 'Không'}):`,
        default: config.hasBoost,
      },
      {
        type: 'input',
        name: 'totalBoost',
        message: 'Tổng boost muốn kiểm tra:',
        default: config.totalBoost?.toString() || '0',
        when: ({ hasBoost }) => hasBoost,
        transformer: (value: string) => value.trim(),
        validate: (value: string) =>
          isNaN(Number(value)) || Number(value) <= 0 ? 'Tổng boost phải là số lớn hơn 0' : true,
      },
      {
        type: 'confirm',
        name: 'hasImage',
        message: `Có cần kiểm tra ảnh không? (hiện tại: ${config.hasImage ? 'Có' : 'Không'}):`,
        default: config.hasImage,
      },
      {
        type: 'input',
        name: 'expiresHour',
        message: `Thời gian hết hạn (giờ) (hiện tại: ${config.expiresHour / 3600}):`,
        default: (config.expiresHour / 3600).toString(),
        transformer: (value: string) => value.trim(),
        validate: (value: string) =>
          isNaN(Number(value)) || Number(value) <= 0
            ? 'Thời gian hết hạn phải là số lớn hơn 0'
            : true,
      },
      {
        type: 'input',
        name: 'amount',
        message: `Số tiền mua (SOL) (hiện tại: ${Number(config.amount) / 10 ** 9}):`,
        default: (Number(config.amount) / 10 ** 9).toString(),
        transformer: (value: string) => value.trim(),
        validate: (value: string) =>
          isNaN(Number(value)) || parseFloat(value) <= 0
            ? 'Số tiền mua phải là số lớn hơn 0'
            : true,
      },
      {
        type: 'input',
        name: 'profitSell',
        message: `Lợi nhuận tự động bán (%) (hiện tại: ${config.profitSell / 100}):`,
        default: (config.profitSell / 100).toString(),
        transformer: (value: string) => value.trim(),
        validate: (value: string) =>
          isNaN(Number(value)) || parseFloat(value) <= 0
            ? 'Lợi nhuận tự động bán phải là số lớn hơn 0'
            : true,
      },
      {
        type: 'input',
        name: 'jitoTip',
        message: `Tip cho Jito (SOL) (hiện tại: ${config.jitoTip}):`,
        default: config.jitoTip.toString(),
        transformer: (value: string) => value.trim(),
        validate: (value: string) =>
          isNaN(Number(value)) || parseFloat(value) <= 0
            ? 'Tip cho Jito phải là số lớn hơn 0'
            : true,
      },
    ])

    const answers = await wrapEscHandler<Partial<PoolCheckerConfig>>(question)
    return poolCheckerSchema.parse({ ...config, ...answers })
  }
}

PoolCheckerConfigCommand.paths = [['config run']]
