import { StarknetTool, StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { generateCairoCodeSchema, fixCairoCodeSchema } from '../schema/schema.js';
import { generateCairoCode } from '../actions/generateCairoCode.js';
import { fixCairoCode } from '../actions/fixCairoCode.js';
import { initializeDatabase } from '../utils/db_utils.js';

/**
 * Initialize database connection when the plugin is loaded
 * @param agent The Starknet agent
 */
export const initializeTools = async (
  agent: StarknetAgentInterface
): Promise<any | undefined> => {
  try {
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
    console.error('Error while initializing database');
    return;
  }

  StarknetToolRegistry.push({
    name: 'cairocoder_generate_code',
    plugins: 'cairocoder',
    description: 'Generate Cairo code using AI and save it to the database. Requires a prompt describing the code to be generated and a program name.',
    schema: generateCairoCodeSchema,
    execute: generateCairoCode,
  });
  
  // Add the new fixCairo tool
  StarknetToolRegistry.push({
    name: 'cairocoder_fix_code',
    plugins: 'cairocoder',
    description: 'Fix Cairo code using AI and update it in the database. Requires the name of an existing program and an error description.',
    schema: fixCairoCodeSchema,
    execute: fixCairoCode,
  });
}; 