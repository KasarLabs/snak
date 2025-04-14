import { logger, StarknetAgentInterface } from '@starknet-agent-kit/core';
('@starknet-agent-kit/core');
import { fixCairoCodeSchema } from '../schema/schema.js';
import {
  callCairoGenerationAPI,
  extractCairoCode,
  saveToDebugFile,
} from '../utils/utils.js';
import { addProgram } from '../utils/db_add.js';
import { retrieveProjectData } from '../utils/db_init.js';
import { z } from 'zod';

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
    logger.debug('\n Fixing Cairo code');
    logger.debug(JSON.stringify(params, null, 2));

    if (!params?.programName || !params.programName.endsWith('.cairo')) {
      throw new Error('Program name is required and must end with .cairo');
    }

    if (!params?.error) {
      throw new Error('Error description is required for fixing Cairo code');
    }

    const projectData = await retrieveProjectData(agent, params.projectName);
    const program = projectData.programs.find(
      (p) => p.name === params.programName
    );

    if (!program) {
      throw new Error(
        `Program ${params.programName} not found in the database`
      );
    }

    let errorText = params.error;
    if (
      errorText.includes('[EXACT_ERROR_BEGIN]') &&
      errorText.includes('[EXACT_ERROR_END]')
    ) {
      errorText = errorText
        .split('[EXACT_ERROR_BEGIN]')[1]
        .split('[EXACT_ERROR_END]')[0]
        .trim();
    }

    const fixPrompt = `I have the following Cairo code that has an error:
\`\`\`cairo
${program.source_code}
\`\`\`

The error is: ${errorText}

Can you fix the compilation errors?`;

    const generatedContent = await callCairoGenerationAPI(fixPrompt);
    const fixedCairoCode = extractCairoCode(generatedContent);

    await addProgram(agent, projectData.id, params.programName, fixedCairoCode);

    return JSON.stringify({
      status: 'success',
      message: `Cairo code fixed and updated in database as ${params.programName}`,
      programName: params.programName,
      originalCode: program.source_code,
      fixedCode: fixedCairoCode,
    });
  } catch (error) {
    logger.error('Error fixing Cairo code:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
