import chalk from "chalk";
import { SnakClient } from "../snak-client-http";
import { AgentConfigSQL } from "@snakagent/agents";

  export async function getAgentByName(
    client: SnakClient,
    agentName: string
  ): Promise<{ success: boolean; agent?: AgentConfigSQL }> {
    try {
      const agentResponse = await client.getAgents();

      const foundAgent = agentResponse.data.find((agent: AgentConfigSQL) => agent.name === agentName);
      return { 
        success: !!foundAgent, 
        agent: foundAgent 
      };
    } catch (error) {
      console.log(chalk.yellow(`Warning: Error finding agent by name: ${error}`));
      return { success: false };
    }
  }

