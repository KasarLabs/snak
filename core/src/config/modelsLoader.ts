import * as fs from 'fs/promises';
import * as path from 'path';
import { ModelsConfig } from '../types/modelsConfig.js';

/**
 * Loads and validates the models configuration from a JSON file.
 *
 * @param configPath The relative path to the configuration file.
 * @returns A promise that resolves with the validated ModelsConfig object.
 * @throws Error if the file cannot be read, parsed, or does not contain the required model levels.
 */
export async function loadModelsConfig(
  configPath: string
): Promise<ModelsConfig> {
  const absolutePath = path.resolve(configPath);
  console.log(`Loading models configuration from: ${absolutePath}`);

  try {
    const fileContent = await fs.readFile(absolutePath, 'utf-8');
    const config = JSON.parse(fileContent);

    // Basic validation for required levels
    if (!config.fast || !config.smart || !config.cheap) {
      throw new Error(
        'Invalid configuration: Missing one or more required model levels (fast, smart, cheap).'
      );
    }

    // Further validation could be added here to check provider/model_name formats if needed.

    console.log('Models configuration loaded and validated successfully.');
    return config as ModelsConfig;
  } catch (error: any) {
    console.error(
      `Error loading models configuration from ${absolutePath}:`,
      error.message
    );
    if (error.code === 'ENOENT') {
      throw new Error(`Configuration file not found at ${absolutePath}`);
    } else if (error instanceof SyntaxError) {
      throw new Error(
        `Invalid JSON format in configuration file ${absolutePath}`
      );
    } else {
      // Rethrow other errors (validation error, etc.)
      throw error;
    }
  }
}
