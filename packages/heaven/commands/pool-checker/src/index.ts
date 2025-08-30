import { Command, type BaseContext } from 'clipanion'

import { type SolanaBotContext } from '@solana-kit-bot/core'
import {
  getCreateStandardLiquidityPoolEventCodec,
  HEAVEN_PROGRAM_ADDRESS,
} from '@solana-kit-bot/heaven-program'

export class HeavenPoolCheckerCommand extends Command<BaseContext & SolanaBotContext> {
  override async execute(): Promise<number | void> {
    const { advanceSubscriptions } = this.context.provider

    advanceSubscriptions.eventNotifications(
      HEAVEN_PROGRAM_ADDRESS,
      new Uint8Array([189, 56, 131, 144, 75, 63, 249, 148]),
      getCreateStandardLiquidityPoolEventCodec(),
      { delay: 1000, retry: Infinity }
    )
  }
}
