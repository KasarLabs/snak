import chalk from "chalk";
import { TestRunner } from "../test-runner";

export interface CleanupAgent {
    testRunner: TestRunner;
    agentId: string;
    userId?: string;
    agentName?: string;
  }

  export interface CleanupResult {
    success: boolean;
    index?: number;
    error?: string;
  }

  export async function cleanupAgents(
    agents: CleanupAgent[],
    context: string = 'Cleanup'
  ): Promise<{ successful: number; failed: number; results: CleanupResult[] }> {
    if (agents.length === 0) {
      console.log(chalk.blue(`\n${context}: No agents to cleanup`));
      return { successful: 0, failed: 0, results: [] };
    }

    console.log(chalk.blue(`\n${context}: Cleaning up ${agents.length} agents...`));
    
    const cleanupPromises = agents.map(async (agent, index) => {
      try {
        const testName = `${context} - Delete Agent ${agent.agentId}`;

        await agent.testRunner.runTest(testName, () => 
          agent.testRunner.client.deleteAgent(agent.agentId)
        );
        
        return { success: true, index };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(chalk.red(`  Error: Failed to cleanup agent ${index + 1}: ${errorMessage}`));
        return { success: false, index, error: errorMessage };
      }
    });
    
    const settledResults = await Promise.allSettled(cleanupPromises);
    const results = settledResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return { success: false, index, error: result.reason?.message || 'Unknown error' };
      }
    });
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(chalk.green(`  Success: ${context} completed: ${successful} successful, ${failed} failed`));
    
    return { successful, failed, results };
  }