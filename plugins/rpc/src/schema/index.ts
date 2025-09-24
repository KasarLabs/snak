import z from 'zod';

// RPC
export const contractAddressSchema = z.object({
  contractAddress: z.string().describe('The address of the contract'),
});

export const blockIdSchema = z.object({
  blockId: z
    .string()
    .describe(
      "Block identifier - either block number (as string) or block hash"
    ),
});

export const blockIdAndContractAddressSchema = blockIdSchema
  .merge(contractAddressSchema)
  .strict();

export const getStorageAtSchema = blockIdAndContractAddressSchema.merge(
  z.object({
    key: z
      .string()
      .describe('The key to the storage value for the given contract '),
  })
);

export const getClassAtSchema = blockIdAndContractAddressSchema.merge(
  z.object({
    key: z
      .string()
      .describe('The class for the given contract at the given block'),
  })
);

export const getClassHashAtSchema = blockIdAndContractAddressSchema.merge(
  z.object({
    key: z
      .string()
      .describe(
        'The class hash for the given contract at the given block need to be a real class hash'
      ),
  })
);

export const getTransactionByBlockIdAndIndexSchema = blockIdSchema.merge(
  z.object({
    transactionIndex: z
      .number()
      .int()
      .nonnegative()
      .describe('The index of the transaction within the block.'),
  })
);

export const transactionHashSchema = z.object({
  transactionHash: z
    .string()
    .describe('The hash of the requested transaction.'),
});

export type GetStorageParams = z.infer<typeof getStorageAtSchema>;
export type GetClassAtParams = z.infer<typeof getClassAtSchema>;
export type BlockIdParams = z.infer<typeof blockIdSchema>;
export type BlockIdAndContractAddressParams = z.infer<
  typeof blockIdAndContractAddressSchema
>;
export type GetTransactionByBlockIdAndIndexParams = z.infer<
  typeof getTransactionByBlockIdAndIndexSchema
>;
export type ContractAddressParams = z.infer<typeof contractAddressSchema>;
export type TransactionHashParams = z.infer<typeof transactionHashSchema>;

export const emptyInputSchema = z.object({});
