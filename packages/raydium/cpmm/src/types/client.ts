import type { Instruction } from '@solana/kit'

import type { InitPoolParams } from './initPool'
import type { AtomicSwapOption, BuyOption, SellOption } from './option'
import type { AtomicSwapParams, BuyParams, PoolKeys, SellParams } from './params'

export interface RaydiumCpmmClient {
  fetchPoolKeys(address: string): Promise<PoolKeys>
  initializePool(params: InitPoolParams): Promise<Instruction[]>
  createBuyInstructions(params: BuyParams, option: BuyOption): Promise<Instruction[]>
  createSellInstructions(params: SellParams, option: SellOption): Promise<Instruction[]>
  createAtomicInstructions(
    params: AtomicSwapParams,
    option: AtomicSwapOption
  ): Promise<{ buyInstructions: Instruction[]; sellInstructions: Instruction[] }>
}
