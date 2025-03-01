import z from 'zod';

// Schema for memecoin creation parameters
export const contractAddressSchema = z.object({
  contractAddress: z.string().describe('The address of the contract'),
});

export const createMemecoinSchema = z.object({
  owner: z.string().describe('Owner address of the memecoin'),
  name: z.string().describe('Name of the memecoin'),
  symbol: z.string().describe('Symbol/ticker of the memecoin'),
  initialSupply: z.string().describe('Initial supply of tokens (in wei)'),
  salt: z
    .string()
    .optional()
    .describe('Optional salt for contract address generation'),
});
/**
 * Schema for the initial launch parameters
 */
const launchParametersSchema = z
  .object({
    // Memecoin contract address
    memecoinAddress: z
      .string()
      .regex(/^0x[0-9a-fA-F]{63,64}$/)
      .describe('Address of the memecoin contract to be launched'),

    // Transfer restriction delay (in seconds)
    transferRestrictionDelay: z
      .number()
      .min(0)
      .describe(
        'Time period in seconds during which transfers are restricted after launch. Example: 86400 for 24 hours'
      ),

    // Maximum percentage that can be bought at launch
    maxPercentageBuyLaunch: z
      .number()
      .min(1)
      .max(100)
      .describe(
        'Maximum percentage of total supply that can be bought by a single address at launch. Range: 1-100'
      ),

    // Quote token address (e.g., ETH)
    quoteAddress: z
      .string()
      .regex(/^0x[0-9a-fA-F]{63,64}$/)
      .describe(
        'Address of the quote token (e.g., ETH) used for the trading pair'
      ),

    // Initial token holders
    initialHolders: z
      .array(z.string().regex(/^0x[0-9a-fA-F]{63,64}$/))
      .min(1)
      .describe(
        'Array of addresses that will receive initial token distribution'
      ),

    // Initial token amounts for each holder
    initialHoldersAmounts: z
      .array(z.string())
      .min(1)
      .describe(
        'Array of token amounts (in wei) to be distributed to initial holders'
      ),
  })
  .refine(
    (data) => data.initialHolders.length === data.initialHoldersAmounts.length,
    {
      message: 'Initial holders and amounts arrays must have the same length',
    }
  );

/**
 * Schema for Ekubo-specific pool parameters
 */
const ekuboPoolParametersSchema = z.object({
  // Pool fee in basis points (1 bp = 0.01%)
  fee: z
    .string()
    .refine(
      (value) => {
        const fee = parseInt(value);
        return fee >= 1 && fee <= 10000; // 0.01% to 100%
      },
      {
        message: 'Fee must be between 1 and 10000 basis points (0.01% to 100%)',
      }
    )
    .describe('Pool fee in basis points. Example: "3000" for 0.3%'),

  // Tick spacing for the pool
  tickSpacing: z
    .string()
    .describe(
      'Determines the granularity of price points in the pool. Common values: "60" for 0.3% pools'
    ),

  // Starting price configuration
  startingPrice: z.object({
    // Magnitude of the price
    mag: z
      .string()
      .describe(
        'Magnitude of the starting price in wei. Example: "1000000000000000000" for 1.0'
      ),

    // Price direction (positive/negative)
    sign: z.boolean().describe('true for positive price, false for negative'),
  }),

  // Pool bound parameter
  bound: z
    .string()
    .describe(
      'Defines the price range limit for the concentrated liquidity pool'
    ),
});

export const launchOnEkuboSchema = z.object({
  launchParams: launchParametersSchema,
  ekuboParams: ekuboPoolParametersSchema,
});

export type LaunchOnEkuboParams = z.infer<typeof launchOnEkuboSchema>;
export type CreateMemecoinParams = z.infer<typeof createMemecoinSchema>;
export type ContractAddressParams = z.infer<typeof contractAddressSchema>;
