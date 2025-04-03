import { z } from 'zod';

/**
 * Schema for generating Cairo code using AI
 * @typedef {Object} GenerateCairoCodeSchema
 * @property {string} prompt - The prompt describing the Cairo code to be generated
 * @property {string} programName - The name of the program file to be created (with .cairo extension)
 * @property {string} projectName - The name of the project to associate the program with
 */
export const generateCairoCodeSchema = z.object({
  prompt: z
    .string()
    .describe('The prompt describing what Cairo code to generate'),
  programName: z
    .string()
    .describe('The name of the Cairo program/contract file to be created (with .cairo extension)'),
  projectName: z
    .string()
    .describe('The name of the existing project to associate the program with')
});

/**
 * Schema for fixing Cairo code using AI
 * @typedef {Object} FixCairoCodeSchema
 * @property {string} programName - The name of the program to fix (with .cairo extension)
 * @property {string} error - The error message or issue to fix in the code
 * @property {string} projectName - Optional - The name of the project to associate the fixed program with
 */
export const fixCairoCodeSchema = z.object({
  programName: z
    .string()
    .describe('The name of the Cairo program to fix (with .cairo extension)'),
  error: z
    .string()
    .describe('The error message or issue description that needs to be fixed'),
  projectName: z
    .string()
    .describe('The name of the existing project to associate the fixed program with')
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
  existingProgramNames: z
    .array(z.string())
    .optional()
    .describe('Array of already existing program names to directly add to the project. If provided, no need to generate code.'),
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
 * Schema for deleting a program
 *
 * @property projectName The name of the project to delete the program from
 * @property programName The name of the program to delete
 */
export const deleteProgramSchema = z.object({
  projectName: z
    .string()
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
    .describe('The name of the project to delete the dependency from'),
  dependencyName: z
    .string()
    .describe('The name of the dependency to delete'),
});

/**
 * Schema for deleting a project
 *
 * @property projectName The name of the project to delete
 */
export const deleteProjectSchema = z.object({
  projectName: z.string().describe('The name of the project to delete'),
});

export const addProgramSchema = z.object({
  projectName: z
    .string()
    .describe('The name of the existing project to add the program to'),
  programPaths: z
    .array(z.string())
    .describe('Array of paths to Cairo files'),
});

export const addDependencySchema = z.object({
  projectName: z
    .string()
    .describe('The name of the existing project to add the dependency to'),
  dependencies: z
    .array(
      z.object({
        name: z.string().describe('Dependency name'),
        version: z.string().optional().describe('Dependency version'),
        git: z.string().optional().describe('Git URL for the dependency'),
      })
    )
    .describe('List of project dependencies'),
});

/**
 * Schema for listing all projects
 * 
 * Empty schema as no parameters are required
 */
export const listProjectsSchema = z.object({});