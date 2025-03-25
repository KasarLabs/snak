import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { generateCairoCodeSchema } from '../schemas/schema.js';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { CairoCodeGenerationResponse } from '../types/types.js';

/**
 * Generate Cairo code using AI via API
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
    console.log("\nGenerated content = ",generatedContent);
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
    console.log("\nCairo code = ",cairoCode);
    // Write the generated code to a file
    const outputDir = path.join(process.cwd(), '../plugins/cairocoder/src/contract');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputFile = path.join(outputDir, 'test.cairo');
    console.log("\nOutput file = ",outputFile);
    fs.writeFileSync(outputFile, cairoCode);
    console.log("\nCairo code written to file  !!!");
    console.log("\nCairo code = ",cairoCode);

    return JSON.stringify({
      status: 'success',
      message: 'Cairo code generated successfully',
      outputFile: outputFile,
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