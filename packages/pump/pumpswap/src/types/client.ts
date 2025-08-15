import type { Address, Instruction } from '@solana/kit'
import type { AtomicSwapOption, BuyOption, SellOption } from './option'
import type { AtomicSwapParams, BuyParams, PoolKeys, SellParams } from './params'

export type PumpswapClient = {
  fetchPoolKeys(poolId: string | Address<string>): Promise<PoolKeys>
  createBuyInstructions(params: BuyParams, option: BuyOption): Promise<Instruction[]>
  createSellInstructions(params: SellParams, option: SellOption): Promise<Instruction[]>
  createAtomicSwapInstructions(
    params: AtomicSwapParams,
    option: AtomicSwapOption
  ): Promise<Instruction[]>
}
