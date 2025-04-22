# Model Selection Agent

## Overview

The ModelSelectionAgent is an optimization layer that intelligently routes requests to the most appropriate AI model based on the task characteristics. This feature automatically selects between fast, smart, and cheap models to optimize for performance, quality, and cost.

## How It Works

The ModelSelectionAgent analyzes incoming messages and determines which model is most appropriate based on:

- **Complexity**: How complex is the task? (high/medium/low)
- **Urgency**: How time-sensitive is the request? (high/medium/low)
- **Creativity**: How much creative thinking is required? (high/medium/low)
- **Task Type**: What kind of task is it? (reasoning/generation/classification/general)

## Model Selection Logic

The agent uses these heuristics for model selection:

- **Smart Model**: Used for high complexity reasoning tasks, creative generation, and medium complexity default tasks
- **Fast Model**: Used for high urgency + low complexity tasks and classification tasks
- **Cheap Model**: Used for low complexity tasks where budget is a concern

## Usage

### Enabling Debug Logging

Model selection debugging is automatically enabled when the logger is in debug mode.

To enable debug mode, you can:

- Set `LOG_LEVEL=debug` in your environment or .env file
- Set `NODE_ENV=development` in your environment
- Set `DEBUG_LOGGING=true` in your environment

This will output detailed logs showing which model was selected and why without needing any additional flags.

### Integration Points

The ModelSelectionAgent is integrated with:

1. Interactive agent execution
2. Autonomous agent execution
3. LLM invocations

## Benefits

- Reduced costs by using cheaper models for simpler tasks
- Improved response times by using faster models when appropriate
- Better quality for complex tasks by ensuring they use the smartest models

## Implementation Details

The agent is implemented in `modelSelectionAgent.ts` and integrated into the StarknetAgent class, making it a central part of all model invocations.
