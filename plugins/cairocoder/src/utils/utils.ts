import { StarknetAgentInterface } from "@starknet-agent-kit/agents";
import { addProgram, checkProgramExists } from "./db_utils.js";
import { CairoCodeGenerationResponse } from "../types/types.js";
import { generateCairoCodeSchema } from "../schema/schema.js";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { z } from "zod";

// Get current file's directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Validates the input parameters for code generation
 * @param params The parameters to validate
 * @throws Error if parameters are invalid
 */
export function validateParams(params: z.infer<typeof generateCairoCodeSchema>): void {
    if (!params?.prompt) {
      throw new Error('Prompt is required for generating Cairo code');
    }
  
    if (!params?.programName || !params.programName.endsWith('.cairo')) {
      throw new Error('Program name is required and must end with .cairo');
    }
  }
  
  /**
   * Calls the Cairo code generation API
   * @param prompt The prompt to send to the API
   * @returns The content generated by the API
   * @throws Error if API call fails or returns an error
   */
  export async function callCairoGenerationAPI(prompt: string): Promise<string> {
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
            content: prompt
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
  
    if (response.data.error) {
      throw new Error(`API Error: ${response.data.error.message || 'Unknown error'}`);
    }
  
    const generatedContent = response.data.choices?.[0]?.message?.content;
    if (!generatedContent) {
      throw new Error('No content was generated from the API');
    }
  
    return generatedContent;
  }
  
  /**
   * Extracts Cairo code from the generated content
   * @param generatedContent The raw content returned by the API
   * @returns The extracted Cairo code
   */
  export function extractCairoCode(generatedContent: string): string {
    const cairoCodePattern = /```cairo\s*([\s\S]*?)```/;
    const match = generatedContent.match(cairoCodePattern);
    
    if (match && match[1]) {
      return match[1].trim();
    } else {
      return generatedContent.trim();
    }
  }
  
  /**
   * Saves Cairo code to a local file for debugging
   * @param contractName The name of the contract
   * @param cairoCode The Cairo code to save
   * @returns The path to the saved file
   */
  export function saveToDebugFile(contractName: string, cairoCode: string): string {
    // Using resolved directory path instead of __dirname directly
    const debugDir = path.join(__dirname, '../..', 'contract');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    const debugFile = path.join(debugDir, contractName);
    fs.writeFileSync(debugFile, cairoCode);
    console.log("\nCairo code written to debug file:", debugFile);
    
    return debugFile;
  }
  
  /**
   * Saves Cairo code to the database
   * @param agent The Starknet agent
   * @param contractName The name of the contract
   * @param cairoCode The Cairo code to save
   */
  export async function saveToDB(
    agent: StarknetAgentInterface,
    contractName: string,
    cairoCode: string
  ): Promise<void> {
    try {
        // const { exists, programId } = await checkProgramExists(agent, contractName);

        // if (exists && programId !== undefined) {
        //         await updateExistingProgram(agent, programId, contractName, cairoCode);
        // } else {
        //     await addNewProgram(agent, contractName, cairoCode);
        // }
        await addProgram(agent, contractName, cairoCode);
        console.log(`Cairo code saved to database as ${contractName}`);
    } catch (error) {
        throw new Error(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }