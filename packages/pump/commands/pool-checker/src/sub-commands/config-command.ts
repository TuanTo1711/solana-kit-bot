import { abbreviateNumber, wrapEscHandler } from '@solana-kit-bot/core'
import chalk from 'chalk'
import CliTable3 from 'cli-table3'
import { Command, type BaseContext } from 'clipanion'
import type { ConfigService } from '~/services/ConfigService'

import type { PoolCheckerConfig } from '~/types'

export type PoolCheckerConfigContext = {
  configService: ConfigService
}

export class ConfigCommand extends Command<BaseContext & PoolCheckerConfigContext> {
  override async execute(): Promise<number | void> {
    const inquirer = await import('inquirer')
    const prompt = inquirer.default.prompt
    const controller = new AbortController()

    while (!controller.signal.aborted) {
      const question = prompt<{ action: () => Promise<void> }>({
        type: 'list',
        name: 'action',
        message: 'Chọn hành động: ',
        choices: [
          {
            name: '🔍 Xem cấu hình',
            value: this.view.bind(this),
          },
          {
            name: '➕ Thêm cấu hình',
            value: this.add.bind(this),
          },
          {
            name: '🗑️ Xóa cấu hình',
            value: this.remove.bind(this),
          },
          {
            name: '🔄 Chỉnh sửa cấu hình',
            value: this.edit.bind(this),
          },
          new inquirer.default.Separator(chalk.hex('#00FF88')('─'.repeat(100))),
          {
            name: `🔙 ${chalk.gray('Quay lại menu chính')}`,
            value: controller.abort.bind(controller),
          },
        ],
        theme: {
          style: {
            answer: (text: string) => chalk.hex('#00FF88')(text),
            message: (text: string, status: string) =>
              status === 'done' ? chalk.hex('#00FF88')(text) : chalk.hex('#FFFFFF')(text),
            error: (text: string) => chalk.red(text),
            defaultAnswer: (text: string) => chalk.dim(text),
            help: (text: string) => chalk.dim(text),
            highlight: (text: string) => chalk.hex('#00FF88').bold(text),
            key: (text: string) => chalk.hex('#FFFFFF').bold(text),
          },
        },
      })

      const answer = await wrapEscHandler<typeof question>(question)

      await answer.action()
    }
  }

  async view() {
    const configs = await this.context.configService.getConfigs()
    if (configs.length === 0) {
      console.log('📝 Không có cấu hình nào được tạo')
      return
    }

    const cliTable = new CliTable3({
      head: [
        'ID',
        'Mục tiêu',
        'Boost',
        'Tổng boost',
        'Hình',
        'Hết hạn (giờ)',
        'Số tiền (SOL)',
        'Lợi nhuận (%)',
        'Tip (SOL)',
      ],
      colWidths: [5, 10, 7, 12, 6, 15, 15, 15, 10],
    })

    configs.forEach((config, index) => {
      cliTable.push([
        index + 1,
        abbreviateNumber(Number(config.target) / 10 ** 6),
        config.hasBoost ? '✅' : '❌',
        config.totalBoost ?? 'N/A',
        config.hasImage ? '✅' : '❌',
        config.expiresHour,
        Number(config.amount) / 10 ** 9,
        config.profitSell,
        Number(config.jitoTip) / 10 ** 9,
      ])
    })

    console.log('\n📋 Danh sách cấu hình Pool Checker: ')
    console.log(cliTable.toString())
  }

  async add() {
    const inquirer = await import('inquirer')
    const prompt = inquirer.default.prompt

    const questions = prompt<PoolCheckerConfig>([
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
        filter: (value: string) => BigInt(Number(value) * 10 ** 6),
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
        when: ({ hasBoost }) => hasBoost,
        transformer: (value: string) => value.trim(),
        validate: (value: string) =>
          isNaN(Number(value)) || Number(value) <= 0 ? 'Tổng boost phải là số lớn hơn 0' : true,
        filter: value => Number(value),
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
        filter: (value: string) => Number(value),
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
        filter: value => BigInt(Number(value) * 10 ** 9),
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
        filter: value => Number(value),
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
        filter: value => BigInt(Number(value) * 10 ** 9),
      },
    ])

    const data = await wrapEscHandler<typeof questions>(questions)

    await this.context.configService.createConfig(data)

    console.log('Cấu hình đã được lưu thành công')
  }

  private async remove() {
    const configs = await this.context.configService.getConfigs()

    if (configs.length === 0) {
      console.log('❌ Không có cấu hình nào để xóa')
      return
    }

    const inquirer = await import('inquirer')
    const prompt = inquirer.default.prompt

    const choices = configs.map((config, index) => ({
      name: `Config ${index + 1}: Target=${abbreviateNumber(Number(config.target) / 10 ** 6)}, Amount=${Number(config.amount) / 10 ** 9} SOL`,
      value: config,
    }))

    const question = prompt<{ config: PoolCheckerConfig | 'back' }>({
      type: 'select',
      name: 'config',
      message: 'Chọn cấu hình để xóa: ',
      choices: [
        ...choices,
        new inquirer.default.Separator(chalk.hex('#00FF88')('─'.repeat(100))),
        {
          name: `🔙 ${chalk.gray('Quay lại menu chính')}`,
          value: 'back',
        },
      ],
      theme: {
        style: {
          answer: (text: string) => chalk.hex('#00FF88')(text),
          message: (text: string, status: string) =>
            status === 'done' ? chalk.hex('#00FF88')(text) : chalk.hex('#FFFFFF')(text),
          error: (text: string) => chalk.red(text),
          defaultAnswer: (text: string) => chalk.dim(text),
          help: (text: string) => chalk.dim(text),
          highlight: (text: string) => chalk.hex('#00FF88').bold(text),
          key: (text: string) => chalk.hex('#FFFFFF').bold(text),
        },
      },
    })

    const { config } = await wrapEscHandler<typeof question>(question)

    if (config === 'back') {
      return
    }

    if (config && config.id) {
      // Confirm deletion
      const confirmQuestion = prompt<{ confirmed: boolean }>({
        type: 'confirm',
        name: 'confirmed',
        message: `Bạn có chắc chắn muốn xóa cấu hình này không?`,
        default: false,
        theme: {
          style: {
            answer: (text: string) => chalk.hex('#00FF88')(text),
            message: (text: string, status: string) =>
              status === 'done' ? chalk.hex('#00FF88')(text) : chalk.hex('#FFFFFF')(text),
            error: (text: string) => chalk.red(text),
            defaultAnswer: (text: string) => chalk.dim(text),
            help: (text: string) => chalk.dim(text),
            highlight: (text: string) => chalk.hex('#00FF88').bold(text),
            key: (text: string) => chalk.hex('#FFFFFF').bold(text),
          },
        },
      })

      const { confirmed } = await wrapEscHandler<typeof confirmQuestion>(confirmQuestion)

      if (confirmed) {
        await this.context.configService.deleteConfig(config.id)
        console.log('✅ Cấu hình đã được xóa thành công')
      } else {
        console.log('❌ Hủy xóa cấu hình')
      }
    }
  }

  private async edit() {
    const configs = await this.context.configService.getConfigs()

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
      await this.context.configService.updateConfig(updatedConfig)
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
        transformer: (value: string) => value.trim(),
        validate: (value: string) =>
          isNaN(Number(value)) || parseFloat(value) <= 0
            ? 'Mức pool mục tiêu phải là số lớn hơn 0'
            : true,
        filter: (value: string) => BigInt(Number(value) * 10 ** 6),
      },
      {
        type: 'confirm',
        name: 'hasBoost',
        message: `Có cần kiểm tra boost không? (hiện tại: ${config.hasBoost ? 'Có' : 'Không'}):`,
      },
      {
        type: 'input',
        name: 'totalBoost',
        message: 'Tổng boost muốn kiểm tra:',
        when: ({ hasBoost }) => hasBoost,
        transformer: (value: string) => value.trim(),
        validate: (value: string) =>
          isNaN(Number(value)) || Number(value) <= 0 ? 'Tổng boost phải là số lớn hơn 0' : true,
        filter: value => Number(value),
      },
      {
        type: 'confirm',
        name: 'hasImage',
        message: `Có cần kiểm tra ảnh không? (hiện tại: ${config.hasImage ? 'Có' : 'Không'}):`,
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
        filter: (value: string) => Number(value),
      },
      {
        type: 'input',
        name: 'amount',
        message: `Số tiền mua (SOL) (hiện tại: ${Number(config.amount) / 10 ** 9}):`,
        transformer: (value: string) => value.trim(),
        validate: (value: string) =>
          isNaN(Number(value)) || parseFloat(value) <= 0
            ? 'Số tiền mua phải là số lớn hơn 0'
            : true,
        filter: value => BigInt(Number(value) * 10 ** 9),
      },
      {
        type: 'input',
        name: 'profitSell',
        message: `Lợi nhuận tự động bán (%) (hiện tại: ${config.profitSell / 100}):`,
        transformer: (value: string) => value.trim(),
        validate: (value: string) =>
          isNaN(Number(value)) || parseFloat(value) <= 0
            ? 'Lợi nhuận tự động bán phải là số lớn hơn 0'
            : true,
        filter: value => Number(value),
      },
      {
        type: 'input',
        name: 'jitoTip',
        message: `Tip cho Jito (SOL) (hiện tại: ${config.jitoTip}): `,
        transformer: (value: string) => value.trim(),
        validate: (value: string) =>
          isNaN(Number(value)) || parseFloat(value) <= 0
            ? 'Tip cho Jito phải là số lớn hơn 0'
            : true,
        filter: value => BigInt(Number(value) * 10 ** 9),
      },
    ])

    const answers = await wrapEscHandler<Partial<PoolCheckerConfig>>(question)
    return { ...config, ...answers }
  }
}

ConfigCommand.paths = [['config']]
