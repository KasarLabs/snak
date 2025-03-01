import z from 'zod';
// For declare contract
export const declareContractSchema = z.object({
  contract: z.any().describe('The compiled contract to be declared'),
  classHash: z.string().optional().describe('Optional pre-computed class hash'),
  compiledClassHash: z
    .string()
    .optional()
    .describe('Optional compiled class hash for Cairo 1 contracts'),
});

/* For simulate Invoke Transaction */

const callSchema = z.object({
  contractAddress: z.string().describe('The contract Address'),
  entrypoint: z.string().describe('The entrypoint'),
  calldata: z.array(z.string()).or(z.record(z.any())).optional(),
});

export const simulateInvokeTransactionSchema = z.object({
  accountAddress: z.string().describe('Account Address/public key'),
  payloads: z.array(callSchema),
});

/* For simulate Deploy Account Transaction*/

const PayloadDeployAccountSchema = z.object({
  classHash: z.string().describe('The class Hash Address'),
  constructorCalldata: z.array(z.string()).or(z.record(z.any())).optional(),
  addressSalt: z
    .union([z.string().regex(/^0x[0-9a-fA-F]+$/), z.number(), z.bigint()])
    .optional(),
  contractAddressSchema: z.string().describe('ContractAddress').optional(),
});

export const simulateDeployAccountTransactionSchema = z.object({
  accountAddress: z.string().describe('Account Address'),
  payloads: z.array(PayloadDeployAccountSchema),
});

/* For simulate Deploy Transaction */

const PayloadDeploySchema = z.object({
  classHash: z.union([
    z.string().regex(/^0x[0-9a-fA-F]+$/),
    z.number(),
    z.bigint().describe('The class Hash Address'),
  ]),
  addressSalt: z
    .union([z.string().regex(/^0x[0-9a-fA-F]+$/), z.number(), z.bigint()])
    .optional(),
  unique: z
    .union([
      z.string().regex(/^0x[0-9a-fA-F]+$/),
      z.boolean().describe('unique true or false'),
    ])
    .optional(),
  constructorCalldata: z.array(z.string()).or(z.record(z.any())).optional(),
});

export const simulateDeployTransactionSchema = z.object({
  accountAddress: z.string().describe('Account Address'),
  payloads: z.array(PayloadDeploySchema),
});

/* For simulate Declare Contract Transaction*/
const cairoAssemblySchema = z.object({
  prime: z.string(),
  compiler_version: z.string(),
  bytecode: z.array(z.string()),
  hints: z.record(z.any()),
  entry_points_by_type: z.object({
    CONSTRUCTOR: z.array(z.any()),
    EXTERNAL: z.array(z.any()),
    L1_HANDLER: z.array(z.any()),
  }),
});

const compiledContractSchema = z.object({
  program: z.any(),
  entry_points_by_type: z.any(),
});

export const simulateDeclareTransactionSchema = z.object({
  accountAddress: z.string().describe('Account address'),
  contract: z
    .union([z.string(), compiledContractSchema])
    .describe('Contract data'),
  classHash: z.string().optional().describe('Class hash of the contract'),
  casm: cairoAssemblySchema.optional().describe('Cairo assembly data'),
  compiledClassHash: z.string().optional().describe('Compiled class hash'),
});

/* for estimate account deploye fee */
export const estimateAccountDeployFeeSchema = z.object({
  accountAddress: z.string().describe('Account Address'),
  payloads: z.array(PayloadDeployAccountSchema),
});
