# Datasets Directory

This directory contains CSV files used to create and populate LangSmith datasets for evaluation.

## File Naming Convention

All CSV files in this directory should follow the naming pattern:
```
<dataset-name>.dataset.csv
```

For example:
- `my-test.dataset.csv` → Creates a dataset named `my-test`
- `production-eval.dataset.csv` → Creates a dataset named `production-eval`

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
pnpm datasets --name=<dataset-name>
```

For example, to use `example-dataset.dataset.csv`:
```bash
pnpm datasets --name=example-dataset
```

## What Happens

1. The system searches for `<dataset-name>.dataset.csv` in this directory
2. If the dataset doesn't exist in LangSmith, it creates it from the CSV
3. The evaluation runs on the dataset
4. Results are displayed with a link to view them in LangSmith

## Tips

- Keep your CSV files well-organized in this directory
- Use descriptive names for your datasets
- The example file (`example-dataset.dataset.csv`) is included as a reference
- You can customize input/output keys in `run-datasets.ts`
