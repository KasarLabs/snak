# LangSmith Dataset Evaluation

Run evaluations on graph nodes using LangSmith datasets.

## Usage

```bash
pnpm datasets --graph=<graph-name> --node=<node-name> [--csv_path=<path>]
```

**Required:**
- `--graph`: Graph name (currently only `supervisor`)
- `--node`: Node to evaluate (`mcpConfigurationHelper`, `snakRagAgentHelper`, `agentConfigurationHelper`, or `supervisor`)

**Optional:**
- `--csv_path`: Custom CSV path (defaults to `<graph>.<node>.dataset.csv`)

## Examples

```bash
# Evaluate supervisor node (uses supervisor.supervisor.dataset.csv)
pnpm datasets --graph=supervisor --node=supervisor

# Evaluate helper node (uses supervisor.agentConfigurationHelper.dataset.csv)
pnpm datasets --graph=supervisor --node=agentConfigurationHelper

# Use custom CSV file
pnpm datasets --graph=supervisor --node=supervisor --csv_path=custom-test.csv
```

## CSV Format

CSV files must be in the `datasets/` directory with columns: `messages` (input) and `output` (expected output).

```csv
messages,output
"Hello, how are you?","Not toxic"
"You are an idiot!","Toxic"
```

## Environment Variables

```env
LANGSMITH_API_KEY=your_api_key_here
GEMINI_API_KEY=your_gemini_key_here
```
