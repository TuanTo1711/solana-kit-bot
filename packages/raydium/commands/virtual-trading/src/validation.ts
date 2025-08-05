import { z } from 'zod'
import {
  MAX_VIRTUAL_WALLETS,
  MIN_VIRTUAL_WALLETS,
  MIN_TIP_LAMPORTS,
  LAMPORTS_PER_SOL,
} from './constants'

/**
 * Schema for virtual buy command options
 *
 * This schema validates and transforms the command-line options for the virtual buy command.
 * It includes validation for pool addresses, wallet counts, pricing strategies, and other
 * configuration parameters required for virtual wallet buy operations.
 */
export const virtualTradingOptionsSchema = z
  .object({
    /** Pool address for the token to buy */
    pool: z
      .string()
      .transform(val => val.trim())
      .describe('Địa chỉ pool để thực hiện mua bằng ví ảo'),

    /** Number of virtual wallets to use for buying */
    wallets: z
      .union([z.string(), z.number()])
      .transform((val: string | number) => (typeof val === 'string' ? parseInt(val, 10) : val))
      .pipe(
        z
          .number()
          .int()
          .min(MIN_VIRTUAL_WALLETS, `Số lượng ví tối thiểu là ${MIN_VIRTUAL_WALLETS}`)
          .max(MAX_VIRTUAL_WALLETS, `Số lượng ví tối đa là ${MAX_VIRTUAL_WALLETS}`)
      )
      .describe('Số lượng ví sử dụng'),

    /** Tip amount in SOL for Jito transactions */
    tip: z
      .union([z.string(), z.number()])
      .transform((val: string | number) => (typeof val === 'string' ? parseFloat(val) : val))
      .transform(val => BigInt(val * LAMPORTS_PER_SOL))
      .pipe(
        z
          .bigint()
          .min(
            MIN_TIP_LAMPORTS,
            `Tip thấp nhất là ${Number(MIN_TIP_LAMPORTS) / LAMPORTS_PER_SOL} SOL`
          )
      )
      .describe('Số tiền tip (SOL) cho Jito'),

    /** Number of execution loops (0 for infinite) */
    loops: z
      .union([z.string(), z.number()])
      .transform((val: string | number) => (typeof val === 'string' ? parseInt(val, 10) : val))
      .pipe(z.number().int().nonnegative('Số chu kỳ phải lớn hơn hoặc bằng 0'))
      .describe('Số chu kỳ chạy'),

    /** Interval between execution loops in seconds */
    interval: z
      .union([z.string(), z.number()])
      .transform((val: string | number) => (typeof val === 'string' ? parseInt(val, 10) : val))
      .transform(val => val * 1000)
      .pipe(z.number().int().nonnegative('Khoảng thời gian phải lớn hơn hoặc bằng 0'))
      .describe('Khoảng thời gian giữa các chu kỳ (giây)'),

    timeout: z
      .union([z.string(), z.number()])
      .transform((val: string | number) => (typeof val === 'string' ? parseInt(val, 10) : val))
      .transform(val => val * 1000)
      .pipe(z.number().int().nonnegative('Thời gian chờ phải lớn hơn 0 (giây)'))
      .describe('Thời gian chờ để bán (giây)'),

    /** Pricing strategy: fixed amount or random range */
    strategy: z
      .enum(['fixed', 'random'], { message: 'Chiến lược mua phải là fixed hoặc random' })
      .describe('Chiến lược mua: cố định hoặc ngẫu nhiên'),

    /** Fixed amount in SOL (required for 'fixed' strategy) */
    amount: z
      .union([z.string(), z.number()])
      .transform((val: string | number) => (typeof val === 'string' ? parseFloat(val) : val))
      .transform(val => BigInt(val * LAMPORTS_PER_SOL))
      .pipe(z.bigint().positive('Số tiền phải lớn hơn 0'))
      .optional()
      .describe('Số tiền cố định (SOL) - bắt buộc cho chiến lược fixed'),

    /** Minimum price in SOL (required for 'random' strategy) */
    min: z
      .union([z.string(), z.number()])
      .transform((val: string | number) => (typeof val === 'string' ? parseFloat(val) : val))
      .transform(val => BigInt(val * LAMPORTS_PER_SOL))
      .pipe(z.bigint().positive('Giá tối thiểu phải lớn hơn 0'))
      .optional()
      .describe('Giá tối thiểu (SOL) - bắt buộc cho chiến lược random'),

    /** Maximum price in SOL (required for 'random' strategy) */
    max: z
      .union([z.string(), z.number()])
      .transform((val: string | number) => (typeof val === 'string' ? parseFloat(val) : val))
      .transform(val => BigInt(val * LAMPORTS_PER_SOL))
      .pipe(z.bigint().positive('Giá tối đa phải lớn hơn 0'))
      .optional()
      .describe('Giá tối đa (SOL) - bắt buộc cho chiến lược random'),
  })
  .refine(
    data => {
      // Validate that 'fixed' strategy has required amount field
      if (data.strategy === 'fixed') {
        return data.amount !== undefined
      }
      // Validate that 'random' strategy has required price range fields
      if (data.strategy === 'random') {
        return data.min !== undefined && data.max !== undefined
      }
      return true
    },
    {
      message: 'Chiến lược fixed cần có amount, chiến lược random cần có min và max',
    }
  )
  .refine(
    data => {
      // Validate that min is less than or equal to max for random strategy
      if (data.strategy === 'random' && data.min !== undefined && data.max !== undefined) {
        return data.min <= data.max
      }
      return true
    },
    {
      message: 'Giá tối thiểu phải nhỏ hơn giá tối đa',
    }
  )

/**
 * Type definition for virtual buy options
 *
 * Inferred from the virtualBuyOptionsSchema, this type represents
 * the validated and transformed options for virtual buy operations.
 * All string inputs are converted to appropriate numeric types.
 */
export type VirtualTradingOptions = z.infer<typeof virtualTradingOptionsSchema>
