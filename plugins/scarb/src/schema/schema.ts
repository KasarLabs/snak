import { z } from 'zod';

export const installScarbSchema = z.object({
  path: z.string().optional().describe('The path to the project (defaults to current directory)')
});

export const compileContractSchema = z.object({
  projectName: z.string().describe('The name of the project to create or use'),
  contractPaths: z.array(z.string()).describe('Array of paths to Cairo contract files'),
  targetDir: z.string().optional().describe('Target directory for compilation outputs'),
  dependencies: z.array(
    z.object({
      name: z.string().describe('Dependency name'),
      version: z.string().optional().describe('Dependency version'),
      git: z.string().optional().describe('Git URL for the dependency')
    })
  ).optional().describe('List of project dependencies')
});

export const executeContractSchema = z.object({
  projectName: z.string().describe('The name of the project to create or use'),
  programPaths: z.array(z.string()).describe('Array of paths to Cairo contract files'),
  dependencies: z.array(
    z.object({
      name: z.string().describe('Dependency name'),
      version: z.string().optional().describe('Dependency version'),
      git: z.string().optional().describe('Git URL for the dependency')
    })
  ).optional().describe('List of project dependencies'),
  executableName: z.string().optional().describe('The name of the executable to run'),
  executableFunction: z.string().optional().describe('The name of the function to run'),
  arguments: z.string().optional().describe('Comma-separated list of integers corresponding to the function arguments'),
});

export const proveContractSchema = z.object({
  projectName: z.string().describe('The name of the project to prove'),
  executionId: z.string().describe('The ID of the execution to prove'),
});

export const verifyContractSchema = z.object({
  proofPath: z.string().describe('Path to the proof JSON file to verify')
});