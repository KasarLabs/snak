import { z } from 'zod';

//jsdoc more detailed description

/**
 * Schema for installing Scarb
 *
 * @property path The path to the project (defaults to current directory)
 */
export const installScarbSchema = z.object({
  path: z
    .string()
    .optional()
    .describe('The path to the project (defaults to current directory)'),
});


/**
 * Schema for compiling a contract
 *
 * @property projectName The name of the project to compile
 */
export const compileContractSchema = z.object({
  projectName: z.string().describe('The name of the project to compile'),
});

/**
 * Schema for executing a program
 *
 * @property projectName The name of the project to execute
 * @property executableName The name of the executable to run
 * @property executableFunction The name of the function to run
 * @property arguments Comma-separated list of integers corresponding to the function arguments
 * @property mode The target to compile for
 */
export const executeProgramSchema = z.object({
  projectName: z.string().describe('The name of the project to execute'),
  executableName: z
    .string()
    .optional()
    .describe('The name of the executable to run'),
  executableFunction: z
    .string()
    .optional()
    .describe('The name of the function to run'),
  arguments: z
    .string()
    .optional()
    .describe(
      'Comma-separated list of integers corresponding to the function arguments'
    ),
  mode: z
    .enum(['standalone', 'bootloader'])
    .optional()
    .describe('The target to compile for'),
});

/**
 * Schema for proving a program
 *
 * @property projectName The name of the project to prove
 * @property executableName The name of the executable to run
 * @property executableFunction The name of the function to run
 * @property arguments Comma-separated list of integers corresponding to the function arguments
 */
export const proveProgramSchema = z.object({
  projectName: z.string().describe('The name of the project to prove'),
  executableName: z
    .string()
    .optional()
    .describe('The name of the executable to run'),
  executableFunction: z
    .string()
    .optional()
    .describe('The name of the function to run'),
  arguments: z
    .string()
    .optional()
    .describe(
      'Comma-separated list of integers corresponding to the function arguments'
    ),
});

/**
 * Schema for verifying a program
 *
 * @property projectName The name of the project to verify
 */
export const verifyProgramSchema = z.object({
  projectName: z.string().describe('The name of the project to prove'),
});

