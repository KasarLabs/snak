import { Dataset } from './datasets.js';
import { ChatOpenAI } from '@langchain/openai';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { EvaluationResult } from 'langsmith/evaluation';
import * as path from 'path';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { SUPERVISOR_SYSTEM_PROMPT } from '../../shared/prompts/agents/supervisor/supervisor.prompt.js';
import { SupervisorAgent } from '@agents/core/supervisorAgent.js';
import { createAgentConfigRuntimeFromOutputWithId } from 'utils/agent-initialization.utils.js';
import { AgentConfig, supervisorAgentConfig } from '@snakagent/core';

const prompt = ChatPromptTemplate.fromMessages([
  ['system', SUPERVISOR_SYSTEM_PROMPT],
  new MessagesPlaceholder('messages'),
]);

const chatModel = new ChatGoogleGenerativeAI({
  model: 'gemini-2.5-flash', // Updated to valid Gemini model name
  verbose: false,
  temperature: 0.7,
  apiKey: process.env.GEMINI_API_KEY,
});
const outputParser = new StringOutputParser();
const chain = prompt.pipe(chatModel).pipe(outputParser);

const supervisorConfigRunTime  = await createAgentConfigRuntimeFromOutputWithId({...supervisorAgentConfig, id: 'd5796090-5202-45d6-b0a3-554fc3db0185', user_id : 'd5796090-5202-45d6-b0a3-554fc3db0185'})
if (!supervisorConfigRunTime) {
  throw new Error(
    `Failed to create runtime config for supervisor agent`
  );
}
const supervisorAgent = new SupervisorAgent(supervisorConfigRunTime)
/**
 * Parse command line arguments
 */
function parseArgs(): { name?: string } {
  const args = process.argv.slice(2);
  const result: { name?: string } = {};

  for (const arg of args) {
    if (arg.startsWith('--name=')) {
      result.name = arg.split('=')[1];
    } else if (arg.startsWith('name=')) {
      result.name = arg.split('=')[1];
    }
  }

  return result;
}

/**
 * Main function to run dataset evaluation
 */
async function main() {
  const args = parseArgs();

  if (!args.name) {
    console.error('❌ Error: Dataset name is required!');
    console.log('\nUsage: pnpm datasets --name=<dataset-name>');
    console.log('   or: pnpm datasets name=<dataset-name>');
    console.log('\nExample: pnpm datasets --name=my-dataset');
    process.exit(1);
  }

  const datasetName = args.name;

  console.log(`\n🚀 Running evaluation for dataset: ${datasetName}\n`);

  // Define the datasets directory path
  const datasetsPath = path.join(process.cwd(), 'datasets');

  try {
    // Run evaluation
    // If dataset doesn't exist, it will try to create it from CSV
    const results = await Dataset.runEvaluation(datasetName, chain, {
      // These are only needed if the dataset doesn't exist and needs to be created from CSV
      inputKeys: ['messages'],
      outputKeys: ['output'],
      csvBasePath: datasetsPath,
      experimentPrefix: `evaluation-${datasetName}`,
    });

    console.log('\n✅ Evaluation completed successfully!');
    console.log('\nResults:', results);
  } catch (error) {
    console.error('\n❌ Error running evaluation:');
    if (error instanceof Error) {
      console.error(error.message);

      // Provide helpful error message if CSV is missing
      if (error.message.includes('CSV file not found')) {
        console.log('\n💡 Tip: Make sure you have a CSV file named:');
        console.log(`   ${datasetName}.dataset.csv`);
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
