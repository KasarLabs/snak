// plugins/scarb/src/schemas/index.ts
import { z } from 'zod';

export const initProjectSchema = z.object({
  name: z.string().describe('The name of the project to create')
});

export const buildProjectSchema = z.object({
  path: z.string().optional().describe('The path to the project (defaults to current directory)')
});

export const addDependencySchema = z.object({
  package: z.string().describe('The package name to add'),
  version: z.string().optional().describe('The version of the package'),
  git: z.string().optional().describe('The Git URL for the package'),
  path: z.string().optional().describe('The path to the project (defaults to current directory)')
});

export const runTestsSchema = z.object({
  path: z.string().optional().describe('The path to the project (defaults to current directory)')
});

export const installScarbSchema = z.object({
  path: z.string().optional().describe('The path to the project (defaults to current directory)')
});

export const configureSierraAndCasmSchema = z.object({
  path: z.string().optional().describe('The path to the project (defaults to current directory)')
});