# LangSmith Dataset Evaluation

This directory contains tools for managing and evaluating datasets with LangSmith.

## Files

- **`datasets.ts`** - Static `Dataset` class for managing LangSmith datasets
- **`run-datasets.ts`** - CLI runner for executing dataset evaluations

## Usage

### Running Evaluations

To run an evaluation on a dataset, use:

```bash
pnpm datasets --name=<dataset-name>
```

Or alternatively:

```bash
pnpm datasets name=<dataset-name>
```

**Example:**
```bash
pnpm datasets --name=my-dataset
```

### How It Works

1. **The command will first try to find an existing dataset** in LangSmith with the provided name
2. **If the dataset doesn't exist**, it will attempt to create it from a CSV file
3. **The CSV file must be named:** `<dataset-name>.dataset.csv` (e.g., `my-dataset.dataset.csv`)
4. **The CSV file must be located in the `datasets/` directory** at the project root
5. If the CSV file doesn't exist, the command will fail with a helpful error message

### CSV File Format

Your CSV file should have columns that match the `inputKeys` and `outputKeys` defined in `run-datasets.ts`.

By default, the runner expects:
- **Input columns:** `messages`
- **Output columns:** `output`

**Example CSV (`my-dataset.dataset.csv`):**

```csv
messages,output
"Hello, how are you?","Not toxic"
"You are an idiot!","Toxic"
"What's the weather like?","Not toxic"
```

## Customization

### Custom Evaluators

You can modify the evaluator function in `run-datasets.ts` to implement your own evaluation logic:

```typescript
function myCustomEvaluator({
  outputs,
  referenceOutputs,
}: {
  outputs: Record<string, any>;
  referenceOutputs?: Record<string, any>;
}): EvaluationResult {
  // Your custom evaluation logic here
  const score = // ... calculate score
  return { key: 'my-metric', score };
}
```

### Custom Chain

You can also modify the chain in `run-datasets.ts` to use your own model and prompts:

```typescript
const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'Your custom system prompt'],
  ['user', '{input}'],
]);

const chatModel = new ChatOpenAI({ model: 'gpt-4' });
const chain = prompt.pipe(chatModel).pipe(outputParser);
```

### Custom Input/Output Keys

If your CSV has different column names, update the `inputKeys` and `outputKeys` in the `runEvaluation` call:

```typescript
const results = await Dataset.runEvaluation(
  datasetName,
  chain,
  [correct],
  {
    inputKeys: ['question', 'context'],  // Your CSV input columns
    outputKeys: ['answer'],               // Your CSV output columns
    csvBasePath: process.cwd(),
    experimentPrefix: `evaluation-${datasetName}`,
  }
);
```

## Dataset Class API

The `Dataset` class provides three static methods:

### `getDataset(datasetName: string)`

Get an existing dataset by name.

```typescript
const dataset = await Dataset.getDataset('my-dataset');
```

### `createDatasetIfNotExist(datasetName, inputKeys, outputKeys, csvBasePath?)`

Create a dataset from a CSV file if it doesn't exist.

```typescript
await Dataset.createDatasetIfNotExist(
  'my-dataset',
  ['messages'],
  ['output'],
  '/path/to/csv/files'
);
```

### `runEvaluation(datasetName, target, evaluators, options?)`

Run an evaluation on a dataset (automatically creates from CSV if needed).

```typescript
await Dataset.runEvaluation(
  'my-dataset',
  chain,
  [correct],
  {
    inputKeys: ['messages'],
    outputKeys: ['output'],
    csvBasePath: process.cwd(),
    experimentPrefix: 'gpt-4o-eval'
  }
);
```

## Environment Variables

Make sure you have the necessary environment variables set in your `.env` file:

```env
LANGSMITH_API_KEY=your_api_key_here
OPENAI_API_KEY=your_openai_key_here
```

## Examples

### Example 1: Run evaluation with existing dataset

```bash
pnpm datasets --name=production-dataset
```

### Example 2: Create and run evaluation from CSV

1. Create a CSV file named `toxicity-test.dataset.csv` in the `datasets/` directory:
```csv
messages,output
"Hello, how are you?","Not toxic"
"You are terrible!","Toxic"
```

2. Run the evaluation:
```bash
pnpm datasets --name=toxicity-test
```

The system will:
- Check if `toxicity-test` exists in LangSmith
- If not, create it from `datasets/toxicity-test.dataset.csv`
- Run the evaluation with your chain and evaluators
- Display the results

## Troubleshooting

### Error: Dataset name is required

You forgot to provide the `--name` argument. Use:
```bash
pnpm datasets --name=your-dataset
```

### Error: CSV file not found

The CSV file with the expected name doesn't exist. Make sure you have:
- A file named `<dataset-name>.dataset.csv`
- Located in the `datasets/` directory at the project root

### Error: Dataset does not exist and inputKeys/outputKeys are required

The dataset doesn't exist in LangSmith, and the system needs to create it from CSV. Make sure the CSV file exists and has the correct format.
