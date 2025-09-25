import type { Address, TransactionSigner } from '@solana/kit'

export type InitPoolParams = {
  payer: TransactionSigner<string>
  baseMint: Address<string>
  baseAmount: number
  quoteMint: Address<string>
  quoteAmount: number
  openTime?: number
}
