import { z } from 'zod';

/**
 * Schema for contract declaration parameters
 */
export const declareContractSchema = z.object({
  sierraPath: z.string({
    required_error: "Sierra file path is required",
    description: "Path to the compiled Sierra contract file (.json)",
  }),
  casmPath: z.string({
    required_error: "CASM file path is required",
    description: "Path to the compiled contract assembly file (.json)",
  }),
});

/**
 * Schema for contract deployment parameters
 */
export const deployContractSchema = z.object({
  classHash: z.string({
    required_error: "Class hash is required",
    description: "Class hash of the declared contract to deploy",
  }),
  abiPath: z.string().optional().describe("Path to the contract ABI file"),
  sierraPath: z.string().optional().describe("Path to Sierra file when not using separate ABI"),
  casmPath: z.string().optional().describe("Path to CASM file when not using separate ABI"),
  constructorArgs: z.array(z.string()).optional().describe(
    "Arguments for the contract constructor in the order specified by getConstructorParams"
  ),
});

/**
 * Schema for getting constructor parameters
 */
export const getConstructorParamsSchema = z.object({
  classHash: z.string({
    required_error: "Class hash is required",
    description: "Class hash of the declared contract to deploy",
  }),
  abiPath: z.string().optional().describe("Path to the contract ABI file"),
  sierraPath: z.string().optional().describe("Path to Sierra file when not using separate ABI"),
  casmPath: z.string().optional().describe("Path to CASM file when not using separate ABI"),
  constructorArgs: z.array(z.string()).optional().describe(
    "Arguments for the contract constructor in the order specified by getConstructorParams"
  ),
});