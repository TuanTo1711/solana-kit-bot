import { Command, type BaseContext } from 'clipanion'

import { type SolanaBotContext } from '@solana-kit-bot/core'

export class PumpfunSniperBumpCommand extends Command<BaseContext & SolanaBotContext> {
  override async execute(): Promise<number | void> {}
}

PumpfunSniperBumpCommand.paths = [['pumpfun sniper-bump']]
