import { evaluate } from 'langsmith/evaluation';
import { Client } from 'langsmith';
import * as fs from 'fs';
import * as path from 'path';
import { File } from 'buffer';
import * as ls from 'langsmith/vitest';
// import * as ls from "langsmith/jest";
import { createLLMAsJudge, CORRECTNESS_PROMPT } from 'openevals';

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
    const correctnessEvaluator = createLLMAsJudge({
      prompt: CORRECTNESS_PROMPT,
      feedbackKey: '    ',
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
