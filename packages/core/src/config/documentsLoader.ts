import * as fs from 'fs/promises';
import * as path from 'path';
import { DocumentsConfig } from '../types/documents/documentsConfig.js';

export async function loadDocumentsConfig(configPath: string): Promise<DocumentsConfig> {
  const absolutePath = path.resolve(configPath);
  try {
    const fileContent = await fs.readFile(absolutePath, 'utf-8');
    const config = JSON.parse(fileContent);
    if (
      typeof config.maxAgentSize !== 'number' ||
      typeof config.maxProcessSize !== 'number'
    ) {
      throw new Error('Invalid configuration: missing size limits');
    }
    return config as DocumentsConfig;
  } catch (error: any) {
    console.error(`Error loading documents configuration from ${absolutePath}:`, error.message);
    if (error.code === 'ENOENT') {
      throw new Error(`Configuration file not found at ${absolutePath}`);
    } else if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON format in configuration file ${absolutePath}`);
    }
    throw error;
  }
}