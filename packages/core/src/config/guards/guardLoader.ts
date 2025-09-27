import * as fs from 'fs/promises';
import * as path from 'path';
import { GuardsConfigSchema, GuardsConfig } from './guardsSchema.js';
import { readFileSync } from 'fs';

/**
 * Loads and validates the guards configuration from a JSON file using Zod schema validation.
 *
 * @param configPath The relative path to the configuration file.
 * @returns The validated GuardsConfig object.
 * @throws Error if the file cannot be read, parsed, or does not contain valid configuration.
 */
export function loadGuardsConfig(configPath: string): GuardsConfig {
  const absolutePath = path.resolve(configPath);

  try {
    const fileContent = readFileSync(absolutePath, 'utf-8');
    const rawConfig = JSON.parse(fileContent);

    // Validate the configuration using Zod schema
    const validatedConfig = GuardsConfigSchema.parse(rawConfig);

    return validatedConfig;
  } catch (error: any) {
    console.error(
      `Error loading guards configuration from ${absolutePath}:`,
      error.message
    );

    if (error.code === 'ENOENT') {
      throw new Error(`Configuration file not found at ${absolutePath}`);
    } else if (error instanceof SyntaxError) {
      throw new Error(
        `Invalid JSON format in configuration file ${absolutePath}`
      );
    } else if (error.name === 'ZodError') {
      // Format Zod validation errors in a user-friendly way
      const formattedErrors = error.errors
        .map((err: any) => {
          const path = err.path.join('.');
          return `${path}: ${err.message}`;
        })
        .join('\n');

      throw new Error(`Invalid configuration:\n${formattedErrors}`);
    } else {
      // Rethrow other errors
      throw error;
    }
  }
}
