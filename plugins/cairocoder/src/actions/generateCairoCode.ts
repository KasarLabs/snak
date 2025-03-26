import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { generateCairoCodeSchema } from '../schema/schema.js';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { CairoCodeGenerationResponse } from '../types/types.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { addOrUpdateRawProgram } from '../utils/db_utils.js';

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    if (!params?.prompt) {
      throw new Error('Prompt is required for generating Cairo code');
    }

    if (!params?.contractName) {
      throw new Error('Contract name is required');
    }

    // Make sure the contractName ends with .cairo
    const contractFileName = params.contractName.endsWith('.cairo') 
      ? params.contractName 
      : `${params.contractName}.cairo`;

    // Make request to the Cairo code generation API
    const response = await axios.post<CairoCodeGenerationResponse>(
      'https://backend.agent.starknet.id/v1/chat/completions',
      {
        model: 'gemini-2.0-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a Cairo programming expert. Generate Cairo code that follows best practices.'
          },
          {
            role: 'user',
            content: params.prompt
          }
        ],
        temperature: 0.7
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    // Check if response contains an error
    if (response.data.error) {
      throw new Error(`API Error: ${response.data.error.message || 'Unknown error'}`);
    }

    // Extract content from the response
    const responseData = response.data;
    
    // Get the generated code from the response
    const generatedContent = responseData.choices?.[0]?.message?.content;
    console.log("\nGenerated content = ", generatedContent);
    
    if (!generatedContent) {
      throw new Error('No content was generated from the API');
    }

    // Extract Cairo code block if it's wrapped in markdown code blocks
    let cairoCode: string;
    const cairoCodePattern = /```cairo\s*([\s\S]*?)```/;
    const match = generatedContent.match(cairoCodePattern);
    
    if (match && match[1]) {
      // If the content contains a Cairo code block, extract it
      cairoCode = match[1].trim();
    } else {
      // Otherwise use the entire content
      cairoCode = generatedContent.trim();
    }
    console.log("\nCairo code = ", cairoCode);

    // Save to file for debugging purposes
    // Use a path relative to the current file, not to the working directory
    const debugDir = path.join(__dirname, '../../contract');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    const debugFile = path.join(debugDir, 'test.cairo');
    console.log("\nDebug file = ", debugFile);
    fs.writeFileSync(debugFile, cairoCode);
    console.log("\nCairo code written to debug file");

    // Add to database
    try {
      // Add or update program in rawProgram table with empty dependencies
      await addOrUpdateRawProgram(agent, contractFileName, cairoCode);
      
      console.log(`Cairo code saved to database as ${contractFileName}`);
    } catch (dbError) {
      console.error('Error saving to database:', dbError);
      return JSON.stringify({
        status: 'partial_success',
        message: 'Cairo code generated but could not be saved to the database',
        error: dbError instanceof Error ? dbError.message : 'Unknown database error',
        code: cairoCode
      });
    }

    return JSON.stringify({
      status: 'success',
      message: `Cairo code generated and saved to database as ${contractFileName}`,
      contractName: contractFileName,
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