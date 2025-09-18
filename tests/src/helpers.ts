import { randomUUID } from "crypto";
import { CreateAgentResponse, SnakConfig } from "./types";
import chalk from "chalk";
import { AgentInitializationDTO, AgentMode } from "@snakagent/core";
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export function generateUserId(): string {
    return randomUUID();
}

export function extractAgentNameFromResponse(response: CreateAgentResponse): string | null {
    try {
      const match = response.data.match(/Agent (.+?) added and registered with supervisor/);
      return match ? match[1] : null;
    } catch (error) {
      console.log(chalk.yellow(`Warning: Could not extract agent name from response: ${error}`));
      return null;
    }
  }

export function defaultAgentConfiguration(agentName: string): AgentInitializationDTO {
    return {
      name: agentName,
      group: 'stress-test',
      description: `Stress test agent: ${agentName}`,
      lore: [
        'I am an agent created for stress testing.',
        'My role is to test system performance.',
        'I help validate system stability and performance.'
      ],
      objectives: [
        'Test system performance under high load',
        'Validate creation and management of multiple agents',
        'Verify stability with many concurrent users',
        'Measure system performance metrics'
      ],
      knowledge: [
        'I understand stress testing and performance',
        'I know multi-user systems',
        'I can validate system stability',
        'I am familiar with performance metrics'
      ],
      interval: 0,
      max_iterations: 10,
      mode: AgentMode.INTERACTIVE,
      memory: {
        enabled: true,
        memory_size: 5,
        short_term_memory_size: 5
      },
      rag: {
        enabled: true,
        embedding_model: 'Xenova/all-MiniLM-L6-v2'
      },
      plugins: []
    };
  }

  export function createConfigForUser(): SnakConfig {
    const port = process.env.SERVER_PORT || '3002';
    return {
      baseUrl: `http://localhost:${port}`,
      userId: generateUserId(),
      apiKey: process.env.SERVER_API_KEY,
    };
  }

