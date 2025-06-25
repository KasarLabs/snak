import * as fs from 'fs/promises';
import * as path from 'path';
import { RagConfig } from '../types/rag/ragConfig.js';

export async function loadRagConfig(
  configPath: string
): Promise<RagConfig> {
  const absolutePath = path.resolve(configPath);
  try {
    const fileContent = await fs.readFile(absolutePath, 'utf-8');
    const config = JSON.parse(fileContent);
    if (
      typeof config.maxAgentSize !== 'number' ||
      typeof config.maxProcessSize !== 'number' ||
      typeof config.maxRagSize !== 'number'
    ) {
      throw new Error('Invalid configuration: missing size limits');
    }
    return config as RagConfig;
  } catch (error: any) {
    console.error(
      `Error loading rag configuration from ${absolutePath}:`,
      error.message
    );
    if (error.code === 'ENOENT') {
      throw new Error(`Configuration file not found at ${absolutePath}`);
    } else if (error instanceof SyntaxError) {
      throw new Error(
        `Invalid JSON format in configuration file ${absolutePath}`
      );
    }
    throw error;
  }
}
