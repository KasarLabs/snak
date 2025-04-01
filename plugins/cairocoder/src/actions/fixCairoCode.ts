import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { fixCairoCodeSchema } from '../schema/schema.js';
import {
  callCairoGenerationAPI,
  extractCairoCode,
  saveToDebugFile,
  saveToDB,
  getRawProgramByName,
} from '../utils/utils.js';

/**
 * Fix Cairo code using AI via API and update it in the database
 * @param {StarknetAgentInterface} agent - The Starknet agent interface
 * @param {FixCairoCodeSchema} params - The parameters for code fixing
 * @returns {Promise<string>} JSON string with the fixed code or error
 */
export const fixCairoCode = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof fixCairoCodeSchema>
): Promise<string> => {
  try {
    // Validate parameters
    if (!params?.programName || !params.programName.endsWith('.cairo')) {
      throw new Error('Program name is required and must end with .cairo');
    }

    if (!params?.error) {
      throw new Error('Error description is required for fixing Cairo code');
    }

    // Retrieve the program from the database
    const program = await getRawProgramByName(agent, params.programName);

    if (!program) {
      throw new Error(
        `Program ${params.programName} not found in the database`
      );
    }

    // Create a prompt for fixing the code
    const fixPrompt = `I have the following Cairo code that has an error:
\`\`\`cairo
${program.source_code}
\`\`\`

The error is: ${params.error}

Please fix the code. Your response should only include the complete, corrected Cairo code in a code block.`;

    // Generate fixed code
    const generatedContent = await callCairoGenerationAPI(fixPrompt);
    const fixedCairoCode = extractCairoCode(generatedContent);

    console.log('\nFixed Cairo code = ', fixedCairoCode);

    // Save to debug file
    const debugFile = saveToDebugFile(params.programName, fixedCairoCode);

    // Save to database
    await saveToDB(agent, params.programName, fixedCairoCode);

    // Return success response
    return JSON.stringify({
      status: 'success',
      message: `Cairo code fixed and updated in database as ${params.programName}`,
      programName: params.programName,
      debugFile: debugFile,
      originalCode: program.source_code,
      fixedCode: fixedCairoCode,
    });
  } catch (error) {
    console.error('Error fixing Cairo code:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
