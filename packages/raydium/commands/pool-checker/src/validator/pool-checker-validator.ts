import z from 'zod'

/**
 * Pool checker validation schema for validating pool monitoring and trading parameters.
 *
 * This schema validates and transforms user input for pool checking operations,
 * including target thresholds, boost requirements, trading amounts, and profit targets.
 */
export const poolCheckerSchema = z
  .object({
    /**
     * Unique identifier for the configuration
     */
    id: z.string().optional().describe('Unique identifier for the configuration'),
    /**
     * Target pool threshold to monitor (converted to micro units)
     * @example 1000000 // 1 SOL in micro units
     */
    target: z
      .union([z.string(), z.number()])
      .transform((val: string | number) => (typeof val === 'string' ? parseFloat(val) : val))
      .transform(val => BigInt(val * 10 ** 6))
      .pipe(z.bigint().positive('Mức đặt mục tiêu phải lớn hơn 0'))
      .describe('Mức đặt mục tiêu pool để kiểm tra'),

    /**
     * Whether boost checking is required
     * @default false
     */
    hasBoost: z.boolean().default(false).describe('Có cần kiểm tra boost không?'),

    /**
     * Total boost amount to verify (only validated when mustBoost is true)
     * @example 100
     */
    totalBoost: z
      .union([z.number(), z.string()])
      .transform((val: string | number) => (typeof val === 'string' ? parseInt(val) : val))
      .pipe(z.number().int().positive('Tổng boost phải lớn hơn 0'))
      .describe('Tổng boost muốn kiểm tra')
      .optional(),

    /**
     * Whether image verification is required
     * @default false
     */
    hasImage: z.boolean().default(false).describe('Có cần kiểm tra ảnh không?'),

    /**
     * Expiration time in hours (converted to seconds)
     * @example 24 // 24 hours = 86400 seconds
     */
    expiresHour: z
      .union([z.string(), z.number()])
      .transform((val: string | number) => (typeof val === 'string' ? parseInt(val, 10) : val))
      .transform(val => val * 3600)
      .pipe(z.number().int().nonnegative('Thời gian hết hạn phải lớn hơn 0 (giờ)'))
      .describe('Thời gian hết hạn (giờ)'),

    /**
     * Purchase amount in SOL (converted to nano units)
     * @example 1 // 1 SOL = 1,000,000,000 nano units
     */
    amount: z
      .union([z.string(), z.number()])
      .transform((val: string | number) => (typeof val === 'string' ? parseFloat(val) : val))
      .transform(val => BigInt(val * 10 ** 9))
      .pipe(z.bigint().positive('Số tiền mua phải lớn hơn 0'))
      .describe('Số tiền mua (SOL)'),

    /**
     * Auto-sell profit threshold in percentage (converted to basis points)
     * @example 50 // 50% = 5000 basis points
     */
    profitSell: z
      .union([z.string(), z.number()])
      .transform((val: string | number) => (typeof val === 'string' ? parseFloat(val) : val))
      .pipe(z.number().positive('Lợi nhuận tự động bán phải lớn hơn 0'))
      .describe('Lợi nhuận tự động bán (%)'),

    /**
     * Jito MEV tip amount in SOL
     * @example 0.001 // 0.001 SOL tip
     */
    jitoTip: z
      .union([z.string(), z.number()])
      .transform((val: string | number) => (typeof val === 'string' ? parseFloat(val) : val))
      .pipe(z.number().positive('Tip cho Jito phải lớn hơn 0'))
      .describe('Tip cho Jito (SOL)'),
  })
  .refine(
    data => {
      if (data.hasBoost && !data.totalBoost) {
        return false
      }
      return true
    },
    {
      message: 'Total boost phải được cung cấp khi mustBoost được bật',
      path: ['totalBoost'],
    }
  )

/**
 * Inferred TypeScript type from the pool checker validation schema.
 *
 * Contains all validated and transformed pool checking configuration parameters
 * ready for use in pool monitoring and trading operations.
 */
export type PoolCheckerConfig = z.infer<typeof poolCheckerSchema>
