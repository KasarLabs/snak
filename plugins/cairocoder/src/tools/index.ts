import { StarknetTool } from '@starknet-agent-kit/agents';
import { generateCairoCodeSchema } from '../schemas/schema.js';
import { generateCairoCode } from '../actions/generateCairoCode.js';

export const registerTools = (StarknetToolRegistry: StarknetTool[]) => {
  StarknetToolRegistry.push({
    name: 'cairocoder_generate_code',
    plugins: 'cairocoder',
    description: 'Generate Cairo code using AI and save it to a file. Requires a prompt describing the code to be generated.',
    schema: generateCairoCodeSchema,
    execute: generateCairoCode,
  });
}; 