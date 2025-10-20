import { Dataset, displaySummary, parseLangSmithResults } from './datasets.js';
import * as path from 'path';
import { SupervisorAgent } from '../core/supervisorAgent.js';
import { createAgentConfigRuntimeFromOutputWithId } from '../../utils/agent-initialization.utils.js';
import { supervisorAgentConfig } from '@snakagent/core';
import { v4 as uuidv4 } from 'uuid';
/**
 * Parse command line arguments
 */
function parseArgs(): { graph?: string; node?: string; csv_path?: string } {
  const args = process.argv.slice(2);
  const result: { graph?: string; node?: string; csv_path?: string } = {};

  for (const arg of args) {
    if (arg.startsWith('--graph=')) {
      result.graph = arg.split('=')[1];
    } else if (arg.startsWith('--node=')) {
      result.node = arg.split('=')[1];
    } else if (arg.startsWith('--csv_path=')) {
      result.csv_path = arg.split('=')[1];
    }
  }

  return result;
}

/**
 * Main function to run dataset evaluation
 */
async function main() {
  const args = parseArgs();
  // Validate required arguments
  if (!args.graph) {
    console.error('Error: --graph parameter is required!');
    console.log(
      '\nUsage: pnpm datasets --graph=<graph-name> --node=<node-name> [--csv_path=<path>]'
    );
    console.log(
      '\nExample: pnpm datasets --graph=supervisor --node=supervisor'
    );
    console.log(
      'Example: pnpm datasets --graph=supervisor --node=agentConfigurationHelper --csv_path=my-custom.csv'
    );
    process.exit(1);
  }

  if (!args.node) {
    console.error('Error: --node parameter is required!');
    console.log(
      '\nUsage: pnpm datasets --graph=<graph-name> --node=<node-name> [--csv_path=<path>]'
    );
    console.log(
      '\nExample: pnpm datasets --graph=supervisor --node=supervisor'
    );
    process.exit(1);
  }

  const graphName = args.graph;
  const nodeName = args.node;

  // Validate graph name
  if (graphName !== 'supervisor') {
    console.error(
      `Error: Graph '${graphName}' not found. Only 'supervisor' graph is supported.`
    );
    process.exit(1);
  }

  // Validate node name
  const validNodes = [
    'mcpConfigurationHelper',
    'snakRagAgentHelper',
    'agentConfigurationHelper',
    'supervisor',
  ];
  if (!validNodes.includes(nodeName)) {
    console.error(
      `Error: Node '${nodeName}' is not valid. Valid nodes are: ${validNodes.join(', ')}`
    );
    process.exit(1);
  }

  // Generate dataset name from graph and node if csv_path is not provided
  const datasetName = args.csv_path
    ? args.csv_path.replace('.dataset.csv', '').replace('.csv', '')
    : `${graphName}-${nodeName}`;

  const csvFileName = args.csv_path || `${graphName}.${nodeName}.dataset.csv`;

  console.log(`\nRunning evaluation for:`);
  console.log(`   Graph: ${graphName}`);
  console.log(`   Node: ${nodeName}`);
  console.log(`   Dataset: ${datasetName}`);
  console.log(`   CSV: ${csvFileName}\n`);

  // Define the datasets directory path
  const datasetsPath = path.join(process.cwd(), 'datasets');

  try {
    const supervisorConfigRunTime =
      await createAgentConfigRuntimeFromOutputWithId({
        ...supervisorAgentConfig,
        id: uuidv4(),
        user_id: uuidv4(),
      });
    if (!supervisorConfigRunTime) {
      throw new Error(`Failed to create runtime config for supervisor agent`);
    }
    const supervisorAgent = new SupervisorAgent(supervisorConfigRunTime);
    if (!supervisorAgent) {
      throw new Error(`Failed to create supervisor agent`);
    }
    await supervisorAgent.init();

    // Get the specified node from the compiled state graph
    const supervisorInstance = supervisorAgent.getSupervisorGraphInstance();
    if (!supervisorInstance) {
      throw new Error(`Supervisor graph instance is not initialized`);
    }
    let targetNode;
    if (nodeName === 'supervisor') {
      targetNode = supervisorAgent.getCompiledStateGraph()?.nodes[nodeName];
    } else {
      // Map node names to their corresponding getter methods
      const specialistGetters: Record<string, () => any> = {
        agentConfigurationHelper: () =>
          supervisorInstance.getAgentConfigurationHelper(),
        mcpConfigurationHelper: () =>
          supervisorInstance.getMcpConfigurationHelper(),
        snakRagAgentHelper: () => supervisorInstance.getSnakRagAgentHelper(),
      };

      const getSpecialistGraph = specialistGetters[nodeName];
      if (!getSpecialistGraph) {
        throw new Error(
          `Unknown specialist node '${nodeName}'. Valid specialist nodes are: ${Object.keys(specialistGetters).join(', ')}`
        );
      }

      const specialistGraph = getSpecialistGraph();
      if (!specialistGraph) {
        throw new Error(
          `Specialist graph instance for node '${nodeName}' is not initialized`
        );
      }
      targetNode = specialistGraph.nodes['agent'];
    }

    if (!targetNode) {
      throw new Error(`Node '${nodeName}' not found in the ${graphName} graph`);
    }

    // Run evaluation
    // If dataset doesn't exist, it will try to create it from CSV
    const results = await Dataset.runEvaluation(datasetName, targetNode, {
      // These are only needed if the dataset doesn't exist and needs to be created from CSV
      inputKeys: ['messages'],
      outputKeys: ['message'],
      csvBasePath: datasetsPath,
      experimentPrefix: `evaluation-${datasetName}`,
    });

    console.log('\nEvaluation completed successfully!');
    const summary = parseLangSmithResults(results);
    console.log(displaySummary(summary));
  } catch (error) {
    console.error('\nError running evaluation:');
    if (error instanceof Error) {
      console.error(error.message);

      // Provide helpful error message if CSV is missing
      if (error.message.includes('CSV file not found')) {
        console.log('\nTip: Make sure you have a CSV file named:');
        console.log(`   ${csvFileName}`);
        console.log(`   in the datasets directory: ${datasetsPath}`);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

// Run the main function
main();
