import { Dataset } from './datasets.js';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { EvaluationResult } from 'langsmith/evaluation';
import * as path from 'path';

/**
 * Example evaluator function
 * You can customize this or create your own evaluators
 */
function correct({
  outputs,
  referenceOutputs,
}: {
  outputs: Record<string, any>;
  referenceOutputs?: Record<string, any>;
}): EvaluationResult {
  const score = outputs.output === referenceOutputs?.outputs;
  return { key: 'correct', score };
}

/**
 * Example chain for evaluation
 * You can customize this with your own chain
 */
const prompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    "Please review the user query below and determine if it contains any form of toxic behavior, such as insults, threats, or highly negative comments. Respond with 'Toxic' if it does, and 'Not toxic' if it doesn't.",
  ],
  ['user', '{messages}'],
]);

const chatModel = new ChatOpenAI();
const outputParser = new StringOutputParser();
const chain = prompt.pipe(chatModel).pipe(outputParser);

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
    const results = await Dataset.runEvaluation(datasetName, chain, [correct], {
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
