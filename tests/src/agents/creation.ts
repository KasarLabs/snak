import chalk from "chalk";
import { TestRunner } from "../test-runner";
import { defaultAgentConfiguration, extractAgentNameFromResponse } from "../helpers";
import { CreateAgentResponse } from "../types";
import { getAgentByName } from "./list.js";
import { AgentConfigSQL } from "@snakagent/agents";
import { AgentInitializationDTO } from "@snakagent/core";

async function waitForAgentCreation(
    testRunner: TestRunner,
    agentName: string,
    maxWaitTime: number = 30000,
    pollInterval: number = 100,
  ): Promise<{ success: boolean; agentId?: string; agent?: AgentConfigSQL; error?: string }> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const result = await getAgentByName(testRunner.client, agentName);
      if (result.success && result.agent) {
        return { success: true, agentId: result.agent.id, agent: result.agent };
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    return { success: false, error: 'Agent creation timeout' };
  }

export async function createAgentWithTracking(
    testRunner: TestRunner,
    agentDefineName: string,
    agentConfig?: AgentInitializationDTO
  ): Promise<{ success: boolean; agentId?: string; agentName?: string; agent?: AgentConfigSQL; error?: string }> {
    try {
      let agentName = agentDefineName;
      
      const createResult = await testRunner.runTest(
        `Create Agent ${agentName}`,
        () => testRunner.client.createAgent({
          agent: agentConfig || defaultAgentConfiguration(agentName)
        })
      );
      const createResponse = createResult.response as CreateAgentResponse;
      if (!createResult.success || !createResponse.success) {
        return { success: false, error: createResult.error };
      }
  
      const extractedAgentName = extractAgentNameFromResponse(createResponse);
      if (extractedAgentName) {
        console.log(chalk.green(`  Success: Created agent "${extractedAgentName}"`));
  
        if (extractedAgentName !== agentName) {
            console.log(chalk.yellow(`  Warning: Agent name mismatch! Expected: "${agentName}", Got: "${extractedAgentName}"`));
            agentName = extractedAgentName;
        } else {
          console.log(chalk.green(`  ✓ Agent name verification passed: "${agentName}"`));
        }
      } else {
        console.log(chalk.yellow(`  Warning: Could not extract agent name from response: ${createResult.response}`));
      }
  
      const waitResult = await waitForAgentCreation(testRunner, agentName, 30000);
      
      return {
        success: waitResult.success,
        agentId: waitResult.agentId,
        agentName: extractedAgentName || agentName,
        agent: waitResult.agent,
        error: waitResult.error
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }