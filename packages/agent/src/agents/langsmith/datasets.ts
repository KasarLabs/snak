import { DatabaseConfigService, initializeGuards } from '@snakagent/core';
import { LanggraphDatabase, Postgres } from '@snakagent/database';
import { RedisClient } from '@snakagent/database/redis';

// TODO Check if we ca have a better initialization

const guardsConfigPath = path.resolve(
  process.cwd(),
  process.env.GUARDS_CONFIG_PATH || 'config/guards/default.guards.json'
);

initializeGuards(guardsConfigPath);
DatabaseConfigService.getInstance().initialize();
RedisClient.getInstance().connect();
const databaseConfig = DatabaseConfigService.getInstance().getCredentials();

await Postgres.connect(databaseConfig);
await LanggraphDatabase.getInstance().connect(databaseConfig);
import { evaluate } from 'langsmith/evaluation';
import { Client } from 'langsmith';
import * as fs from 'fs';
import * as path from 'path';
import { File } from 'buffer';
import { createLLMAsJudge, CORRECTNESS_PROMPT } from 'openevals';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import z from 'zod';

// Define the actual structure that matches the JSON schema for CSV data
const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
  name: z.string().optional(),
  tool_calls: z.array(z.any()).optional(),
  tool_call_id: z.string().optional(),
});

const toolDefSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  parameters: z.record(z.any()).optional(),
  // Add other tool definition properties as needed
});

const inputDatasetsSchema = z.object({
  messages: z.array(messageSchema),
  tools: z.array(toolDefSchema).optional(),
});

// Type for validated input data from CSV
export type DatasetInput = z.infer<typeof inputDatasetsSchema>;
/**
 * Static Dataset class for managing LangSmith datasets with CSV integration
 */
export class Dataset {
  private static client = new Client();

  /**
   * Get an existing dataset by name
   * @param datasetName - The name of the dataset to retrieve
   * @returns The dataset if found, null otherwise
   */
  static async getDataset(datasetName: string) {
    try {
      const dataset = await this.client.readDataset({ datasetName });
      console.log(`Found existing dataset: ${datasetName}`);
      return dataset;
    } catch (error) {
      console.log(`Dataset ${datasetName} not found`);
      return null;
    }
  }

  /**
   * Create a dataset from a CSV file if it doesn't exist
   * @param datasetName - The name of the dataset
   * @param inputKeys - Array of column names to use as inputs
   * @param outputKeys - Array of column names to use as outputs
   * @param csvBasePath - Base path where CSV files are located (defaults to ./datasets directory)
   * @returns The created or existing dataset
   * @throws Error if CSV file doesn't exist
   */
  static async createDatasetIfNotExist(
    datasetName: string,
    inputKeys: string[],
    outputKeys: string[],
    csvBasePath: string = path.join(process.cwd(), 'datasets')
  ) {
    // Check if dataset already exists
    const existingDataset = await this.getDataset(datasetName);
    if (existingDataset) {
      console.log(`Using existing dataset: ${datasetName}`);
      return existingDataset;
    }

    // Construct CSV file path: datasetName.dataset.csv
    const csvFileName = `${datasetName}.dataset.csv`;
    const csvFilePath = path.join(csvBasePath, csvFileName);

    // Check if CSV file exists
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(
        `CSV file not found: ${csvFilePath}. Cannot create dataset without CSV file.`
      );
    }

    console.log(
      `Creating dataset ${datasetName} from CSV file: ${csvFilePath}`
    );

    // Read CSV file and create a native File object (Node.js v18+)
    const csvBuffer = fs.readFileSync(csvFilePath);
    const csvFile = new File([csvBuffer], `${datasetName}.csv`, {
      type: 'text/csv',
    });

    // Upload CSV and create dataset
    // fileName parameter in uploadCsv must include .csv extension
    // name parameter explicitly sets the dataset name
    const dataset = await this.client.uploadCsv({
      csvFile: csvFile as any,
      fileName: `${datasetName}.csv`,
      name: datasetName,
      inputKeys: inputKeys,
      outputKeys: outputKeys,
      description: `Dataset created from ${csvFileName}`,
      dataType: 'kv',
    });

    console.log(`Successfully created dataset: ${datasetName}`);
    return dataset;
  }

  static async getEvaluator(): Promise<any> {
    console.log(process.env.GEMINI_API_KEY);
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    const model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.5-flash',
      temperature: 0.7,
      apiKey: process.env.GEMINI_API_KEY,
      verbose: false,
    });

    const correctnessEvaluator = createLLMAsJudge({
      prompt: CORRECTNESS_PROMPT,
      judge: model,
      useReasoning: true,
      continuous: true,
      model: 'gemini-2.5-flash',
    });
    return correctnessEvaluator;
  }

  /**
   * Run an evaluation on a dataset
   * If the dataset doesn't exist, it will attempt to create it from a CSV file
   * @param datasetName - The name of the dataset to evaluate
   * @param target - The target function or chain to evaluate
   * @param evaluators - Array of evaluator functions
   * @param inputKeys - Array of column names to use as inputs (required if creating dataset)
   * @param outputKeys - Array of column names to use as outputs (required if creating dataset)
   * @param csvBasePath - Base path where CSV files are located
   * @param experimentPrefix - Optional prefix for the experiment name
   * @returns The evaluation results
   */
  static async runEvaluation(
    datasetName: string,
    target: any,
    options?: {
      inputKeys?: string[];
      outputKeys?: string[];
      csvBasePath?: string;
      experimentPrefix?: string;
    }
  ): Promise<any> {
    // Try to get existing dataset
    let dataset = await this.getDataset(datasetName);

    // If dataset doesn't exist, try to create it from CSV
    if (!dataset) {
      console.log(
        `Dataset ${datasetName} not found. Attempting to create from CSV...`
      );

      if (!options?.inputKeys || !options?.outputKeys) {
        throw new Error(
          `Dataset ${datasetName} does not exist and inputKeys/outputKeys are required to create it from CSV.`
        );
      }

      dataset = await this.createDatasetIfNotExist(
        datasetName,
        options.inputKeys,
        options.outputKeys,
        options.csvBasePath
      );

      // Wait a moment for the dataset to be fully available
      console.log('Waiting for dataset to be available...');
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify dataset exists
      dataset = await this.getDataset(datasetName);
      if (!dataset) {
        throw new Error(
          `Dataset ${datasetName} was created but cannot be retrieved. Please try again.`
        );
      }
    }
    const evaluator = await this.getEvaluator();
    // Run evaluation
    console.log(`Running evaluation on dataset: ${datasetName}`);
    const results = await evaluate(target, {
      data: datasetName,
      evaluators: [evaluator],
      experimentPrefix:
        options?.experimentPrefix || `evaluation-${datasetName}`,
      maxConcurrency: 1,
    });

    return results;
  }
}

/**
 * Example usage of the Dataset class:
 *
 * // Run evaluation with existing dataset
 * await Dataset.runEvaluation(
 *   'my-dataset-name',
 *   chain,
 *   [correct]
 * );
 *
 * // Run evaluation and create dataset from CSV if it doesn't exist
 * // This requires a file named 'my-dataset-name.dataset.csv' in the csvBasePath
 * await Dataset.runEvaluation(
 *   'my-dataset-name',
 *   chain,
 *   [correct],
 *   {
 *     inputKeys: ['messages'],
 *     outputKeys: ['output'],
 *     csvBasePath: process.cwd(),
 *     experimentPrefix: 'gpt-4o, baseline'
 *   }
 * );
 *
 * // Get an existing dataset
 * const dataset = await Dataset.getDataset('my-dataset-name');
 *
 * // Create dataset from CSV if it doesn't exist
 * await Dataset.createDatasetIfNotExist(
 *   'my-dataset-name',
 *   ['column1', 'column2'],
 *   ['output1'],
 *   '/path/to/csv/files'
 * );
 */

// ============================================================================
// Evaluation Results Analysis
// ============================================================================

/**
 * Summary of evaluation results for analysis and reporting
 */
export interface EvaluationSummary {
  experimentName: string;
  experimentId: string;
  totalTests: number;
  processedTests: number;
  averageScore: number;
  minScore: number;
  maxScore: number;
  passedTests: number;
  failedTests: number;
  testResults: Array<{
    testNumber: number;
    testName: string;
    exampleId: string;
    score: number;
    passed: boolean;
    comment: string;
  }>;
  scoreDistribution: Record<number, number>;
}

/**
 * Parse LangSmith evaluation results and generate a comprehensive summary
 * @param experimentResults - The ExperimentResults object returned from evaluate()
 * @returns A structured summary of the evaluation with statistics and details
 */
export function parseLangSmithResults(
  experimentResults: any
): EvaluationSummary {
  const manager = experimentResults.manager;
  const results = experimentResults.results || [];

  const testResults: EvaluationSummary['testResults'] = [];
  const scores: number[] = [];
  const scoreDistribution: Record<number, number> = {};

  results.forEach((result: any, index: number) => {
    const evalResults = result.evaluationResults?.results || [];

    evalResults.forEach((evalResult: any) => {
      const score = evalResult.score ?? 0;
      scores.push(score);

      // Track score distribution
      scoreDistribution[score] = (scoreDistribution[score] || 0) + 1;

      testResults.push({
        testNumber: index + 1,
        testName: result.example?.name || `Test #${index + 1}`,
        exampleId: result.example?.id || '',
        score: score,
        passed: score >= 0.7, // 70% threshold for passing
        comment: evalResult.comment || '',
      });
    });
  });

  const averageScore =
    scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  const minScore = scores.length > 0 ? Math.min(...scores) : 0;
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

  const passedTests = testResults.filter((t) => t.passed).length;
  const failedTests = testResults.filter((t) => !t.passed).length;

  return {
    experimentName: manager._experiment?.name || 'Unknown',
    experimentId: manager._experiment?.id || '',
    totalTests: results.length,
    processedTests: experimentResults.processedCount || 0,
    averageScore: Math.round(averageScore * 100) / 100,
    minScore,
    maxScore,
    passedTests,
    failedTests,
    testResults,
    scoreDistribution,
  };
}

/**
 * Display evaluation summary in a human-readable format
 * @param summary - The evaluation summary to display
 * @returns A formatted string with statistics, results, and score distribution
 */
export function displaySummary(summary: EvaluationSummary): string {
  let output = `
EVALUATION SUMMARY
==================
Experiment: ${summary.experimentName}
ID: ${summary.experimentId}

GLOBAL STATISTICS
-----------------
Total tests: ${summary.totalTests}
Processed tests: ${summary.processedTests}
Average score: ${(summary.averageScore * 100).toFixed(1)}%
Min score: ${(summary.minScore * 100).toFixed(1)}%
Max score: ${(summary.maxScore * 100).toFixed(1)}%

RESULTS
-------
Passed tests: ${summary.passedTests} (${((summary.passedTests / summary.totalTests) * 100).toFixed(1)}%)
Failed tests: ${summary.failedTests} (${((summary.failedTests / summary.totalTests) * 100).toFixed(1)}%)

TEST DETAILS
------------
`;

  summary.testResults.forEach((test) => {
    const status = test.passed ? '✅' : '❌';
    output += `${status} Test ${test.testNumber}: ${test.testName}\n`;
    output += `   Score: ${(test.score * 100).toFixed(1)}%\n`;
    output += `   ${test.comment}}\n\n`;
  });

  output += `\nSCORE DISTRIBUTION\n------------------\n`;
  Object.entries(summary.scoreDistribution)
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([score, count]) => {
      output += `Score ${(Number(score) * 100).toFixed(1)}%: ${count} test(s)\n`;
    });

  return output;
}

/**
 * Example usage of evaluation results analysis:
 *
 * // Run evaluation and analyze results
 * const results = await Dataset.runEvaluation('my-dataset', chain);
 * const summary = parseLangSmithResults(results);
 * console.log(displaySummary(summary));
 *
 * // Access data programmatically
 * console.log(`Success rate: ${(summary.passedTests / summary.totalTests * 100).toFixed(1)}%`);
 * console.log(`Average score: ${(summary.averageScore * 100).toFixed(1)}%`);
 *
 * // Check if experiment meets quality threshold
 * if (summary.averageScore >= 0.8) {
 *   console.log('✅ Experiment passed quality threshold');
 * }
 */
