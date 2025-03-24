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
 * Schema for registering a project
 *
 * @property projectName The name of the project to create or register
 * @property programPaths Array of paths to Cairo files
 * @property projectType Type of project (contract or cairo_program)
 * @property dependencies List of project dependencies
 */
export const registerProjectSchema = z.object({
  projectName: z
    .string()
    .describe('The name of the project to create or register'),
  programPaths: z
    .array(z.string())
    .optional()
    .describe('Array of paths to Cairo files'),
  projectType: z
    .enum(['contract', 'cairo_program'])
    .optional()
    .describe('Type of project (contract or cairo_program)'),
  dependencies: z
    .array(
      z.object({
        name: z.string().describe('Dependency name'),
        version: z.string().optional().describe('Dependency version'),
        git: z.string().optional().describe('Git URL for the dependency'),
      })
    )
    .optional()
    .describe('List of project dependencies'),
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

/**
 * Schema for deleting a program
 *
 * @property projectName The name of the project to delete the program from
 * @property programName The name of the program to delete
 */
export const deleteProgramSchema = z.object({
  projectName: z
    .string()
    .min(1)
    .describe('The name of the project to delete the program from'),
  programName: z.string().min(1).describe('The name of the program to delete'),
});

/**
 * Schema for deleting a dependency
 *
 * @property projectName The name of the project to delete the dependency from
 * @property dependencyName The name of the dependency to delete
 */
export const deleteDependencySchema = z.object({
  projectName: z
    .string()
    .min(1)
    .describe('The name of the project to delete the dependency from'),
  dependencyName: z
    .string()
    .min(1)
    .describe('The name of the dependency to delete'),
});

/**
 * Schema for deleting a project
 *
 * @property projectName The name of the project to delete
 */
export const deleteProjectSchema = z.object({
  projectName: z.string().min(1).describe('The name of the project to delete'),
});
