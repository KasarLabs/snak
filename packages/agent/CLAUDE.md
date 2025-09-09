# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Package
```bash
npm run build          # Build the project using tsup
npm run clean:dist     # Remove dist directory
npm run clean:all      # Remove node_modules and dist
npm run pack           # Create package tarball
```

### Testing
```bash
npm test               # Run all tests using Jest
npm run test:graph     # Run specific graph tests (autonomous.spec.ts)
```

### Code Quality
```bash
npm run lint           # Lint TypeScript files
npm run lint:fix       # Auto-fix lint issues
npm run format         # Format code with Prettier
```

### Development
```bash
npm start              # Start the agent using tsx
npm run pgvector       # Run pgvector setup script
```

## Architecture Overview

This is the **@snakagent/agents** package - the core Agent Kit engine for Snak, a Starknet blockchain agent system.

### Core Components

**Agent System Architecture:**
- `SnakAgent` (src/agents/core/snakAgent.ts) - Main agent class that orchestrates blockchain interactions
- `BaseAgent` (src/agents/core/baseAgent.ts) - Abstract base for all agent types
- Graph-based execution using LangGraph for complex multi-step workflows

**Graph Execution System:**
- `Graph` class (src/agents/graphs/graph.ts) - Main orchestrator with StateGraph implementation
- Sub-graphs for specialized tasks:
  - `PlannerGraph` - Task planning and decomposition
  - `AgentExecutorGraph` - Task execution 
  - `MemoryGraph` - Memory management and context
  - `TaskVerifierGraph` - Task completion verification

**Key Operators:**
- `ModelSelector` - LLM model selection and management
- `MemoryAgent` - Memory operations and persistence
- `RagAgent` - Retrieval-augmented generation
- `MCPAgent` - Model Context Protocol integration

**Plugin System:**
The agent supports numerous Starknet-specific plugins (workspace dependencies):
- `@snakagent/plugin-argent`, `@snakagent/plugin-braavos` - Wallet integrations
- `@snakagent/plugin-erc20`, `@snakagent/plugin-erc721` - Token standards
- `@snakagent/plugin-transaction`, `@snakagent/plugin-rpc` - Blockchain operations

### Project Structure

```
src/
├── agents/           # Core agent implementations
│   ├── core/         # Base agent classes
│   ├── graphs/       # LangGraph workflow definitions
│   ├── operators/    # Specialized agent operators
│   └── studio/       # Studio-related functionality
├── shared/           # Common utilities and types
│   ├── types/        # TypeScript type definitions
│   ├── enums/        # Enum definitions
│   ├── lib/          # Shared libraries (memory, token)
│   └── schemas/      # Zod schemas
├── tools/            # Tool registration and management
├── config/           # Configuration management
└── services/         # External service integrations
```

### Path Aliases

The project uses TypeScript path mapping:
- `@agents/*` → `src/agents/*`
- `@lib/*` → `src/shared/lib/*`
- `@types/*` → `src/shared/types/*`
- `@enums/*` → `src/shared/enums/*`
- `@config/*` → `src/config/*`
- `@tools/*` → `src/tools/*`

### Agent Execution Modes

- **AgentMode.INTERACTIVE** - Direct user interaction
- **AgentMode.AUTONOMOUS** - Self-directed execution
- **AgentMode.HYBRID** - Mixed interaction patterns

### Memory System

The agent implements a sophisticated memory system with:
- Short-term memory (STM) for immediate context
- Long-term memory with vector embeddings
- Task-specific memory for execution context
- Memory verification and validation

## Graph System Architecture (`src/agents/graphs/`)

The graph system is the core execution engine built on LangGraph, implementing a sophisticated workflow orchestration for agent tasks.

### Main Graph Orchestrator (`graph.ts`)

The main `Graph` class orchestrates the entire execution flow:

- **GraphState**: Defines the shared state across all graph nodes including:
  - `messages`: Message history and communication
  - `tasks`: Current task queue with status tracking
  - `memories`: STM/LTM memory contexts
  - `currentTaskIndex`: Task progression tracking
  - `error`: Error state management

- **Orchestration Routers**: 
  - `orchestrationRouter()` - Main routing logic between graph nodes
  - `startOrchestrationRouter()` - Entry point routing based on agent mode
  - `task_updater()` - Task progression and verification handling

### Sub-Graphs (`sub-graph/`)

Four specialized sub-graphs handle different execution phases:

#### PlannerGraph (`planner-graph.ts`)
- **Purpose**: Task decomposition and planning
- **Key Features**: 
  - Multi-mode planning (INTERACTIVE, AUTONOMOUS, HYBRID)
  - Plan validation and re-planning capability
  - Step-by-step task breakdown with dependencies
- **Nodes**: Plan generation, plan validation, replanning
- **Prompts**: Adaptive planning based on agent mode and context

#### AgentExecutorGraph (`executor-graph.ts`)
- **Purpose**: Task execution with tool calling
- **Key Features**:
  - ReAct pattern implementation for reasoning and acting
  - Tool validation and step verification
  - Token tracking and resource management
  - Human-in-the-loop interrupts
- **Tools Integration**: Executes blockchain and utility tools
- **Error Handling**: Retry logic and graceful failure management

#### MemoryGraph (`memory-graph.ts`)
- **Purpose**: Memory management and context preservation
- **Key Features**:
  - STM (Short-term Memory) management with size limits
  - LTM (Long-term Memory) with vector embeddings
  - Context summarization and retrieval
  - Memory persistence to database
- **Memory Types**: Episodic and semantic memory contexts
- **Database Integration**: Vector storage for long-term recall

#### TaskVerifierGraph (`task-verifier-graph.ts`)
- **Purpose**: Task completion verification and quality control
- **Key Features**:
  - Completion assessment with confidence scoring
  - Missing elements detection
  - Next action recommendations
  - Task result validation
- **Schema**: Structured verification results with reasoning
- **Integration**: Feeds back to task updater for progression decisions

### Support Components

#### Manager Classes (`manager/`)
- **MemoryStateManager**: STM/LTM state management and persistence
- **MemoryDBManager**: Database operations for memory storage  
- **PromptManagerFactory**: Dynamic prompt generation for different contexts
- **STMManager/LTMManager**: Specialized memory type handlers

#### Utilities (`utils/`)
- **graph-utils.ts**: Common graph operations and state management
- **react-utils.ts**: ReAct pattern parsing and tool call handling
- **Token estimation and resource management**

#### Configuration (`config/`)
- **default-config.ts**: Default graph parameters and validation schemas
- **Configurable limits**: Max steps, memory size, timeouts

### Execution Flow

1. **Start Router** determines entry point based on agent mode
2. **Planning Phase** (if needed) decomposes user request into tasks
3. **Memory Retrieval** loads relevant context from STM/LTM
4. **Execution Phase** processes tasks with tool calling
5. **Verification Phase** validates task completion
6. **Task Update** progresses to next task or completes
7. **Memory Storage** persists execution context and results

### Error Handling

- **Node-level error handling** with `handleNodeError()` utility
- **Retry mechanisms** for failed tasks and tool calls
- **Graceful degradation** when components are unavailable
- **Error state propagation** through graph routing

## Testing

Jest is configured with comprehensive TypeScript support and extensive mocking for external dependencies. Tests are co-located with source files in `__tests__` directories.



## Source TO use 
./SuperAGI/CLAUDE.md
./SuperAGI/*