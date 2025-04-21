import { logger, StarknetAgentInterface } from '@hijox/core';
('@hijox/core');
import { z } from 'zod';
import { generateCairoCodeSchema } from '../schema/schema.js';
import {
  validateParams,
  callCairoGenerationAPI,
  extractCairoCode,
} from '../utils/utils.js';
import { scarb } from '@hijox/database/queries';

/**
 * Generate Cairo code using AI via API and store it in the database
 * @param {GenerateCairoCodeParams} params - The parameters for code generation
 * @returns {Promise<string>} JSON string with the generated code or error
 */
export const generateCairoCode = async (
  _agent: StarknetAgentInterface,
  params: z.infer<typeof generateCairoCodeSchema>
): Promise<string> => {
  try {
    logger.debug('\n Generating Cairo code');
    logger.debug(JSON.stringify(params, null, 2));

    validateParams(params);

    const generatedContent = await callCairoGenerationAPI(params.prompt);
    const cairoCode = extractCairoCode(generatedContent);

    const projectData = await scarb.retrieveProjectData(params.projectName);
    if (!projectData) {
      throw new Error(`project ${params.projectName} does not exist`);
    }

    await scarb.insertProgram({
      project_id: projectData.id,
      name: params.programName,
      source_code: cairoCode,
    });

    return JSON.stringify({
      status: 'success',
      message: `Cairo code generated and saved to database as ${params.programName}`,
      programName: params.programName,
      code: cairoCode,
      stopExecution: true,
      stopExecutionReason:
        'Do not continue execution except if there is an error or another tool is called',
    });
  } catch (error) {
    logger.error('Error generating Cairo code:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
