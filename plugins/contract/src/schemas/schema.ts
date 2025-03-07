import { z } from 'zod';

/**
 * Schema pour les paramètres de déclaration de contrat
 *
 * @typedef {Object} DeclareContractParams
 * @property {string} sierraPath - Chemin vers le fichier Sierra compilé du contrat (.json)
 * @property {string} casmPath - Chemin vers le fichier d'assemblage du contrat compilé (.json)
 */
export const declareContractSchema = z.object({
  sierraPath: z.string({
    required_error: 'Sierra file path is required',
    description: 'Path to the compiled Sierra contract file (.json)',
  }),
  casmPath: z.string({
    required_error: 'CASM file path is required',
    description: 'Path to the compiled contract assembly file (.json)',
  }),
});

/**
 * Schema pour les paramètres de déploiement de contrat
 *
 * @typedef {Object} DeployContractParams
 * @property {string} classHash - Hash de classe du contrat déclaré à déployer
 * @property {string} [abiPath] - Chemin vers le fichier ABI du contrat
 * @property {string} [sierraPath] - Chemin vers le fichier Sierra quand on n'utilise pas d'ABI séparé
 * @property {string} [casmPath] - Chemin vers le fichier CASM quand on n'utilise pas d'ABI séparé
 * @property {string[]} [constructorArgs] - Arguments pour le constructeur du contrat
 */
export const deployContractSchema = z.object({
  classHash: z.string({
    required_error: 'Class hash is required',
    description: 'Class hash of the declared contract to deploy',
  }),
  abiPath: z.string().optional().describe('Path to the contract ABI file'),
  sierraPath: z
    .string()
    .optional()
    .describe('Path to Sierra file when not using separate ABI'),
  casmPath: z
    .string()
    .optional()
    .describe('Path to CASM file when not using separate ABI'),
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
 * @property {string} [abiPath] - Chemin vers le fichier ABI du contrat
 * @property {string} [sierraPath] - Chemin vers le fichier Sierra quand on n'utilise pas d'ABI séparé
 * @property {string} [casmPath] - Chemin vers le fichier CASM quand on n'utilise pas d'ABI séparé
 * @property {string[]} [constructorArgs] - Arguments pour le constructeur du contrat
 */
export const getConstructorParamsSchema = z.object({
  classHash: z.string({
    required_error: 'Class hash is required',
    description: 'Class hash of the declared contract to deploy',
  }),
  abiPath: z.string().optional().describe('Path to the contract ABI file'),
  sierraPath: z
    .string()
    .optional()
    .describe('Path to Sierra file when not using separate ABI'),
  casmPath: z
    .string()
    .optional()
    .describe('Path to CASM file when not using separate ABI'),
  constructorArgs: z
    .array(z.string())
    .optional()
    .describe(
      'Arguments for the contract constructor in the order specified by getConstructorParams'
    ),
});
