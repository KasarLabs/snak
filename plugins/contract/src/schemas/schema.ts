import { z } from 'zod';

/**
 * Schema pour les paramètres de déclaration de contrat
 *
 * @typedef {Object} DeclareContractParams
 * @property {string} projectName - name of the project to deploy
 * @property {string} contractName - name of the contract to deploy (.cairo)
 */
export const declareContractSchema = z.object({
  projectName: z.string().describe('The name of the project to deploy'),
  contractName: z
    .string()
    .describe('The name of the contract to deploy (.cairo)'),
});

/**
 * Parameters for deploying a contract
 *
 * @typedef {Object} DeployContractParams
 * @property {string} projectName - name of the project to deploy
 * @property {string} contractName - name of the contract to deploy (.cairo)
 * @property {string} classHash - class hash of the declared contract to deploy
 * @property {string[]} [constructorArgs] - Arguments for the contract constructor
 */
export const deployContractSchema = z.object({
  projectName: z.string().describe('The name of the project to deploy'),
  contractName: z
    .string()
    .describe('The name of the contract to deploy (.cairo)'),
  classHash: z.string({
    required_error: 'Class hash is required',
    description: 'Class hash of the declared contract to deploy',
  }),
  constructorArgs: z
    .array(z.string())
    .optional()
    .describe(
      'Arguments for the contract constructor in the order specified by getConstructorParams'
    ),
});

/**
 * Schema pour obtenir les paramètres du constructeur
 *
 * @typedef {Object} GetConstructorParamsSchema
 * @property {string} classHash - Hash de classe du contrat
 * @property {string} projectName - name of the project to deploy
 * @property {string} contractName - name of the contract to deploy (.cairo)
 * @property {string[]} [constructorArgs] - Arguments pour le constructeur du contrat
 */
export const getConstructorParamsSchema = z.object({
  projectName: z.string().describe('The name of the project to deploy'),
  contractName: z
    .string()
    .describe('The name of the contract to deploy (.cairo)'),
  classHash: z.string({
    required_error: 'Class hash is required',
    description: 'Class hash of the declared contract to deploy',
  }),
  constructorArgs: z
    .array(z.string())
    .optional()
    .describe(
      'Arguments for the contract constructor in the order specified by getConstructorParams'
    ),
});
