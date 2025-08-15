export type PoolCheckerConfig = {
  id?: string
  target: bigint
  hasBoost: boolean
  totalBoost?: number
  hasImage: boolean
  expiresHour: number
  amount: bigint
  profitSell: number
  jitoTip: bigint
}
