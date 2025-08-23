import { Command, type BaseContext } from 'clipanion'

import { type SolanaBotContext } from '@solana-kit-bot/core'
import {
  getCreateEventCodec,
  PUMP_PROGRAM_ADDRESS,
  type BondingCurve,
  type CreateEvent,
} from '@solana-kit-bot/pumpfun'
import { address } from '@solana/addresses'

export class PumpfunSniperBumpCommand extends Command<BaseContext & SolanaBotContext> {
  override async execute(): Promise<number | void> {
    
  }
}

PumpfunSniperBumpCommand.paths = [['pumpfun sniper-bump']]
