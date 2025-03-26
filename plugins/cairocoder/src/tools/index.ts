import { StarknetTool, StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { generateCairoCodeSchema } from '../schema/schema.js';
import { generateCairoCode } from '../actions/generateCairoCode.js';
import { initializeDatabase } from '../utils/db_utils.js';

/**
 * Initialize database connection when the plugin is loaded
 * @param agent The Starknet agent
 */
export const initializeTools = async (
  agent: StarknetAgentInterface
): Promise<any | undefined> => {
  try {
    console.log('Initializing CairoCoder plugin...');
    // Initialize our own database with rawProgram table
    const dbInstance = await initializeDatabase(agent);
    console.log('CairoCoder plugin initialized successfully');
    return dbInstance;
  } catch (error) {
    console.error('Error initializing CairoCoder plugin:', error);
    return undefined;
  }
};

export const registerTools = async (
  StarknetToolRegistry: StarknetTool[],
  agent: StarknetAgentInterface
) => {
  // Try to initialize database connection
  const dbInstance = await initializeTools(agent);
  if (!dbInstance) {
    console.warn('Warning: CairoCoder will have limited functionality because database initialization failed');
  }

  StarknetToolRegistry.push({
    name: 'cairocoder_generate_code',
    plugins: 'cairocoder',
    description: 'Generate Cairo code using AI and save it to the database. Requires a prompt describing the code to be generated and a contract name.',
    schema: generateCairoCodeSchema,
    execute: generateCairoCode,
  });
}; 