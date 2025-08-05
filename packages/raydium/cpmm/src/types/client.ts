import type { Instruction } from '@solana/kit'

import type { AtomicSwapOption, BuyOption, SellOption } from './option'
import type { AtomicSwapParams, BuyParams, PoolKeys, SellParams } from './params'

export type RaydiumCpmmClient = {
  fetchPoolKeys(address: string): Promise<PoolKeys>
  createBuyInstructions(params: BuyParams, option: BuyOption): Promise<Instruction[]>
  createSellInstructions(params: SellParams, option: SellOption): Promise<Instruction[]>
  createAtomicInstructions(
    params: AtomicSwapParams,
    option: AtomicSwapOption
  ): Promise<{ buyInstructions: Instruction[]; sellInstructions: Instruction[] }>
}
