import z from 'zod';

/**
 * Schema for getting available routes
 */
export const getAvailableRoutesSchema = z.object({
  source_network: z
    .string()
    .describe('Source network ID (e.g., STARKNET_MAINNET)'),
  destination_network: z
    .string()
    .optional()
    .describe('Optional destination network filter'),
  asset: z.string().optional().describe('Optional asset filter (e.g., ETH)'),
});

export type GetAvailableRoutesParams = z.infer<typeof getAvailableRoutesSchema>;

/**
 * Schema for getting swap quote
 */
export const getSwapQuoteSchema = z.object({
  source_network: z
    .string()
    .describe('Source network ID (e.g., STARKNET_MAINNET)'),
  source_token: z.string().describe('Token to bridge (e.g., ETH)'),
  destination_network: z
    .string()
    .describe('Destination network ID (e.g., PARADEX_MAINNET)'),
  destination_token: z
    .string()
    .describe('Destination token (usually same as source)'),
  amount: z.number().describe('Amount to bridge'),
  refuel: z
    .boolean()
    .optional()
    .default(false)
    .describe('Add gas on destination chain'),
});

export type GetSwapQuoteParams = z.infer<typeof getSwapQuoteSchema>;

/**
 * Schema for creating a new swap
 */
export const createSwapSchema = z.object({
  source_network: z
    .string()
    .describe('Source network ID (e.g., STARKNET_MAINNET)'),
  source_token: z.string().describe('Token to bridge (e.g., ETH)'),
  destination_network: z
    .string()
    .describe('Destination network ID (e.g., PARADEX_MAINNET)'),
  destination_token: z
    .string()
    .describe('Destination token (usually same as source)'),
  source_address: z.string().describe('Source address (sender)'),
  destination_address: z.string().describe('Destination address (receiver)'),
  amount: z.number().describe('Amount to bridge'),
  refuel: z
    .boolean()
    .optional()
    .default(false)
    .describe('Add gas on destination chain'),
  reference_id: z
    .string()
    .optional()
    .describe('Optional reference ID for tracking'),
});

export type CreateSwapParams = z.infer<typeof createSwapSchema>;

/**
 * Schema for getting swap status
 */
export const getSwapStatusSchema = z.object({
  swap_id: z.string().describe('ID of the swap to check status'),
});

export type GetSwapStatusParams = z.infer<typeof getSwapStatusSchema>;

/**
 * Schema for executing bridge operation
 */
export const executeBridgeSchema = z.object({
  source_network: z
    .string()
    .describe('Source network ID (e.g., STARKNET_MAINNET)'),
  source_token: z.string().describe('Token to bridge (e.g., ETH)'),
  destination_network: z
    .string()
    .describe('Destination network ID (e.g., PARADEX_MAINNET)'),
  destination_token: z
    .string()
    .describe('Destination token (usually same as source)'),
  source_address: z.string().describe('Source address (sender)'),
  destination_address: z.string().describe('Destination address (receiver)'),
  amount: z.number().describe('Amount to bridge'),
  refuel: z
    .boolean()
    .optional()
    .default(false)
    .describe('Add gas on destination chain'),
  reference_id: z
    .string()
    .optional()
    .describe('Optional reference ID for tracking'),
  max_poll_attempts: z
    .number()
    .optional()
    .default(30)
    .describe('Maximum polling attempts for status'),
  poll_interval_ms: z
    .number()
    .optional()
    .default(10000)
    .describe('Polling interval in milliseconds'),
});

export type ExecuteBridgeParams = z.infer<typeof executeBridgeSchema>;
