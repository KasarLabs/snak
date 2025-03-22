import { z } from 'zod';

export const installScarbSchema = z.object({
  path: z.string().optional().describe('The path to the project (defaults to current directory)')
});

export const registerProjectSchema = z.object({
  projectName: z.string().describe('The name of the project to create or register'),
  programPaths: z.array(z.string()).optional().describe('Array of paths to Cairo files'),
  projectType: z.enum(['contract', 'cairo_program']).optional().describe('Type of project (contract or cairo_program)'),
  dependencies: z.array(
    z.object({
      name: z.string().describe('Dependency name'),
      version: z.string().optional().describe('Dependency version'),
      git: z.string().optional().describe('Git URL for the dependency')
    })
  ).optional().describe('List of project dependencies')
});

export const compileContractSchema = z.object({
  projectName: z.string().describe('The name of the project to create or use')
});

export const executeProgramSchema = z.object({
  projectName: z.string().describe('The name of the project to create or use'),
  executableName: z.string().optional().describe('The name of the executable to run'),
  executableFunction: z.string().optional().describe('The name of the function to run'),
  arguments: z.string().optional().describe('Comma-separated list of integers corresponding to the function arguments'),
  mode: z.enum(['standalone', 'bootloader']).optional().describe('The target to compile for')
});

export const proveProgramSchema = z.object({
  projectName: z.string().describe('The name of the project to create or use'),
  executableName: z.string().optional().describe('The name of the executable to run'),
  executableFunction: z.string().optional().describe('The name of the function to run'),
  arguments: z.string().optional().describe('Comma-separated list of integers corresponding to the function arguments'),
});

export const verifyProgramSchema = z.object({
  projectName: z.string().describe('The name of the project to prove')
});