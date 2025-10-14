# Datasets Directory

This directory contains CSV files used to create and populate LangSmith datasets for evaluation.

## File Naming Convention

All CSV files in this directory should follow the naming pattern:
```
<graph-name>.<node-name>.dataset.csv
```

For example:
- `supervisor.supervisor.dataset.csv` → Dataset for supervisor node in supervisor graph
- `supervisor.agentConfigurationHelper.dataset.csv` → Dataset for agentConfigurationHelper node
- `supervisor.mcpConfigurationHelper.dataset.csv` → Dataset for mcpConfigurationHelper node
- `supervisor.snakRagAgentHelper.dataset.csv` → Dataset for snakRagAgentHelper node

You can also use custom CSV file names by specifying the `--csv_path` parameter.

## CSV Format

Your CSV file should have:
- **Header row**: Column names that match your `inputKeys` and `outputKeys`
- **Data rows**: Examples for evaluation

### Example CSV Structure

```csv
messages,output
"Hello, how are you?","Not toxic"
"You are an idiot!","Toxic"
"What's the weather like today?","Not toxic"
```

In this example:
- `messages` is an input column
- `output` is an output column

## Usage

To run an evaluation using a dataset from this directory:

```bash
pnpm datasets --graph=<graph-name> --node=<node-name> [--csv_path=<path>]
```

**Required Parameters:**
- `--graph`: The graph name (currently only `supervisor` is supported)
- `--node`: The node name (`mcpConfigurationHelper`, `snakRagAgentHelper`, `agentConfigurationHelper`, or `supervisor`)

**Optional Parameters:**
- `--csv_path`: Custom CSV file path (defaults to `<graph>.<node>.dataset.csv`)

### Examples

```bash
# Use default CSV file naming
pnpm datasets --graph=supervisor --node=supervisor
# Looks for: supervisor.supervisor.dataset.csv

# Evaluate a helper node
pnpm datasets --graph=supervisor --node=agentConfigurationHelper
# Looks for: supervisor.agentConfigurationHelper.dataset.csv

# Use custom CSV file
pnpm datasets --graph=supervisor --node=supervisor --csv_path=my-custom-test.csv
# Uses: my-custom-test.csv
```

## What Happens

1. The system validates the graph and node names
2. It retrieves the specified node from the compiled state graph
3. The system searches for the CSV file (either default naming or custom path)
4. If the dataset doesn't exist in LangSmith, it creates it from the CSV
5. The evaluation runs on the specified node
6. Results are displayed with a link to view them in LangSmith

## Tips

- Keep your CSV files well-organized in this directory
- Use the naming convention `<graph>.<node>.dataset.csv` for default behavior
- Valid nodes are: `mcpConfigurationHelper`, `snakRagAgentHelper`, `agentConfigurationHelper`, `supervisor`
- You can use custom file names with the `--csv_path` parameter
- You can customize input/output keys in `run-datasets.ts`
