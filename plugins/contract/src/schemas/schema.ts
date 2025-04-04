import { z } from 'zod';

/**
 * Schema pour les paramètres de déclaration de contrat
 *
 * @typedef {Object} DeclareContractParams
 * @property {string} projectName - name of the project to deploy
 * @property {string} contractName - name of the contract to deploy (.cairo)
 */
export const declareContractSchema = z.object({
  projectName: z.string().describe('The name of the project containing the contract to declare'),
  contractName: z
    .string()
    .describe('The name of the contract to declare (finishing with .cairo)'),
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
  projectName: z.string().describe('The name of the project containing the contract to deploy'),
  contractName: z
    .string()
    .describe('The name of the contract to deploy (finishing with .cairo)'),
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
  projectName: z.string().describe('The name of the project containing the contract to deploy'),
  contractName: z
    .string()
    .describe('The name of the contract to deploy (finishing in .cairo)'),
  classHash: z.string({
    required_error: 'Class hash is required',
    description: 'Class hash of the declared contract to deploy',
  }),
  constructorArgs: z
    .array(z.string())
    .optional()
    .describe(
      'Arguments for the contract constructor that need to be ordered'
    ),
});

/**
 * Schema pour lister les contrats et leurs instances déployées
 * 
 * @typedef {Object} ListContractsSchema
 * @property {string} [projectName] - Filtrer par nom de projet (optionnel)
 * @property {string} [contractName] - Filtrer par nom de contrat (optionnel)
 */
export const listContractsSchema = z.object({
  projectName: z
    .string()
    .optional()
    .describe('Filter contracts by project name (optional)'),
  contractName: z
    .string()
    .optional()
    .describe('Filter contracts by contract name (optional)'),
});

/**
 * Schema pour lister les instances déployées d'un contrat par son classHash
 * 
 * @typedef {Object} ListDeploymentsByClassHashSchema
 * @property {string} classHash - Classhash du contrat dont on veut lister les déploiements
 */
export const listDeploymentsByClassHashSchema = z.object({
  classHash: z
    .string()
    .describe('The class hash of the contract to list deployments for'),
});

/**
 * Schema pour supprimer un contrat par son classHash
 * 
 * @typedef {Object} DeleteContractByClassHashSchema
 * @property {string} classHash - Classhash du contrat à supprimer
 */
export const deleteContractByClassHashSchema = z.object({
  classHash: z
    .string()
    .describe('The class hash of the contract to delete'),
});
