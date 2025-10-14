# LangSmith Dataset Evaluation

This directory contains tools for managing and evaluating datasets with LangSmith.

## Files

- **`datasets.ts`** - Static `Dataset` class for managing LangSmith datasets
- **`run-datasets.ts`** - CLI runner for executing dataset evaluations

## Usage

### Running Evaluations

To run an evaluation on a specific node in a graph:

```bash
pnpm datasets --graph=<graph-name> --node=<node-name> [--csv_path=<path>]
```

**Required Parameters:**
- `--graph`: The graph name (currently only `supervisor` is supported)
- `--node`: The node name to evaluate. Valid nodes are:
  - `mcpConfigurationHelper`
  - `snakRagAgentHelper`
  - `agentConfigurationHelper`
  - `supervisor`

**Optional Parameters:**
- `--csv_path`: Custom path to CSV file (defaults to `<graph>.<node>.dataset.csv`)

**Examples:**
```bash
# Evaluate the supervisor node with default CSV
pnpm datasets --graph=supervisor --node=supervisor
# Uses: supervisor.supervisor.dataset.csv

# Evaluate a helper node with default CSV
pnpm datasets --graph=supervisor --node=agentConfigurationHelper
# Uses: supervisor.agentConfigurationHelper.dataset.csv

# Evaluate with custom CSV file
pnpm datasets --graph=supervisor --node=supervisor --csv_path=custom-test.csv
# Uses: custom-test.csv
```

### How It Works

1. **Validates the graph name** - Only `supervisor` graph is currently supported
2. **Validates the node name** - Checks if the node exists in the list of valid nodes
3. **Retrieves the node** from the compiled state graph
4. **Determines the CSV file**:
   - If `--csv_path` is provided, uses that file
   - Otherwise, looks for `<graph>.<node>.dataset.csv` (e.g., `supervisor.supervisor.dataset.csv`)
5. **The command will first try to find an existing dataset** in LangSmith
6. **If the dataset doesn't exist**, it will attempt to create it from the CSV file
7. **The CSV file must be located in the `datasets/` directory** at the project root
8. If the CSV file doesn't exist, the command will fail with a helpful error message

### CSV File Format

Your CSV file should have columns that match the `inputKeys` and `outputKeys` defined in `run-datasets.ts`.

By default, the runner expects:
- **Input columns:** `messages`
- **Output columns:** `output`

**Example CSV (`supervisor.supervisor.dataset.csv`):**

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

### Example 1: Evaluate the supervisor node

```bash
pnpm datasets --graph=supervisor --node=supervisor
```

This will look for `supervisor.supervisor.dataset.csv` in the datasets directory.

### Example 2: Evaluate a helper node

```bash
pnpm datasets --graph=supervisor --node=agentConfigurationHelper
```

This will look for `supervisor.agentConfigurationHelper.dataset.csv`.

### Example 3: Evaluate with custom CSV

1. Create a CSV file named `custom-test.csv` in the `datasets/` directory:
```csv
messages,output
"Hello, how are you?","Not toxic"
"You are terrible!","Toxic"
```

2. Run the evaluation:
```bash
pnpm datasets --graph=supervisor --node=supervisor --csv_path=custom-test.csv
```

The system will:
- Validate the graph and node names
- Retrieve the node from the compiled state graph
- Check if the dataset exists in LangSmith
- If not, create it from the specified CSV file
- Run the evaluation on the node
- Display the results

## Troubleshooting

### Error: --graph parameter is required

You forgot to provide the `--graph` argument. Use:
```bash
pnpm datasets --graph=supervisor --node=<node-name>
```

### Error: --node parameter is required

You forgot to provide the `--node` argument. Use:
```bash
pnpm datasets --graph=supervisor --node=supervisor
```

### Error: Graph not found

Currently, only the `supervisor` graph is supported. Make sure you use:
```bash
pnpm datasets --graph=supervisor --node=<node-name>
```

### Error: Node is not valid

The node name must be one of:
- `mcpConfigurationHelper`
- `snakRagAgentHelper`
- `agentConfigurationHelper`
- `supervisor`

### Error: CSV file not found

The CSV file with the expected name doesn't exist. Make sure you have:
- A file named `<graph>.<node>.dataset.csv` (e.g., `supervisor.supervisor.dataset.csv`)
- Or specify a custom path with `--csv_path`
- Located in the `datasets/` directory at the project root

### Error: Node not found in the graph

The specified node doesn't exist in the compiled state graph. This could indicate:
- The supervisor agent wasn't initialized correctly
- The node name is valid but not present in the current graph configuration
