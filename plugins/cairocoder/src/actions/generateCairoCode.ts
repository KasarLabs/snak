import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { generateCairoCodeSchema } from '../schema/schema.js';
import { validateParams, callCairoGenerationAPI, extractCairoCode, saveToDebugFile, saveToDB } from '../utils/utils.js';

/**
 * Generate Cairo code using AI via API and store it in the database
 * @param {StarknetAgentInterface} agent - The Starknet agent interface
 * @param {GenerateCairoCodeParams} params - The parameters for code generation
 * @returns {Promise<string>} JSON string with the generated code or error
 */
export const generateCairoCode = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof generateCairoCodeSchema>
): Promise<string> => {
  try {
    validateParams(params);
    
    const generatedContent = await callCairoGenerationAPI(params.prompt);
    const cairoCode = extractCairoCode(generatedContent);
    console.log("\nCairo code = ", cairoCode);
    
    const debugFile = saveToDebugFile(params.contractName, cairoCode);
    
    await saveToDB(agent, params.contractName, cairoCode);
    
    return JSON.stringify({
      status: 'success',
      message: `Cairo code generated and saved to database as ${params.contractName}`,
      contractName: params.contractName,
      debugFile: debugFile,
      code: cairoCode
    });
  } catch (error) {
    console.error('Error generating Cairo code:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}; 