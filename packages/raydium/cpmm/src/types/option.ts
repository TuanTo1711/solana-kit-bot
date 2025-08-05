export type BuyOption = Partial<{
  hasSolAta: boolean
  hasTokenAta: boolean
}>

export type SellOption = Partial<{
  sellAll: boolean
  hasSolAta: boolean
}>

export type AtomicSwapOption = Partial<{
  hasSolAta: boolean
  hasTokenAta: boolean
  minOutIsZero: boolean
}>
