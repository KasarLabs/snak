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