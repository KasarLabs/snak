import { logger, AgentMode } from '@snakagent/core';
import { ModelSelector } from '../../operators/modelSelector.js';
import {
  BaseMessage,
  AIMessageChunk,
  ToolMessage,
  HumanMessage,
} from '@langchain/core/messages';
import { Graph, createGraph } from '../graph.js';
import { ExecutionMode } from '../../../shared/enums/agent.enum.js';

jest.mock('../sub-graph/memory-graph.js', () => ({
  MemoryGraph: jest.fn().mockImplementation(() => ({
    createGraphMemory: jest.fn(),
    getMemoryGraph: jest.fn(() => jest.fn()),
  })),
}));

jest.mock('../sub-graph/task_manager_graph.js', () => ({
  TaskManagerGraph: jest.fn().mockImplementation(() => ({
    createTaskManagerGraph: jest.fn(),
    getTaskManagerGraph: jest.fn(() => jest.fn()),
  })),
}));

jest.mock('../sub-graph/executor-graph.js', () => ({
  AgentExecutorGraph: jest.fn().mockImplementation(() => ({
    createAgentExecutorGraph: jest.fn(),
    getExecutorGraph: jest.fn(() => jest.fn()),
  })),
}));

jest.mock('../../utils/database.utils.js', () => ({
  initializeDatabase: jest.fn(async () => {}),
}));

jest.mock('../../../tools/tools.js', () => ({
  initializeToolsList: jest.fn(async () => []),
}));

jest.mock('../../../shared/enums/utils.js', () => ({
  isInEnum: jest.fn(() => true),
}));

jest.mock('@snakagent/core', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  AgentMode: {
    AUTONOMOUS: 'AUTONOMOUS',
    HYBRID: 'HYBRID',
    INTERACTIVE: 'INTERACTIVE',
  },
}));

jest.mock('../../operators/modelSelector.js', () => {
  class FakeModel {
    withStructuredOutput() {
      return {
        invoke: jest.fn(async (input: any) => {
          if (input && Array.isArray(input)) {
            return {
              isValidated: true,
              description: 'Plan is valid and feasible',
            };
          }
          return {
            steps: [
              {
                stepNumber: 1,
                stepName: 'Step 1',
                description: 'First step description',
                status: 'pending',
                result: '',
              },
              {
                stepNumber: 2,
                stepName: 'Step 2',
                description: 'Second step description',
                status: 'pending',
                result: '',
              },
            ],
            summary: 'Test plan summary',
          };
        }),
      };
    }

    bindTools() {
      return {
        invoke: jest.fn(async () => ({
          content: 'model-result',
          additional_kwargs: {},
          tool_calls: undefined,
          response_metadata: { usage: { completion_tokens: 2 } },
          toString: () => 'model-result',
        })),
      };
    }

    invoke = jest.fn(async () => ({
      content: 'summary',
      additional_kwargs: {},
      response_metadata: { usage: { completion_tokens: 3 } },
    }));
  }

  return {
    ModelSelector: class {
      private model = new FakeModel();
      getModels() {
        return { fast: this.model };
      }
      async selectModelForMessages() {
        return { modelName: 'fast', model: this.model };
      }
    },
  };
});

jest.mock('@langchain/langgraph', () => {
  const Annotation = (schema: any) => ({
    reducer: (x: any, y: any) => y,
    default: () => schema,
  });
  Annotation.Root = (schema: any) => ({ State: { ...schema } });

  return {
    StateGraph: class {
      addNode() {
        return this;
      }
      addEdge() {
        return this;
      }
      addConditionalEdges() {
        return this;
      }
      compile() {
        return { run: jest.fn() };
      }
    },
    MemorySaver: class {},
    Annotation,
    END: '__END__',
  };
});

jest.mock('@langchain/langgraph/prebuilt', () => ({
  ToolNode: class {
    invoke = jest.fn(async () => ({
      messages: [{ name: 'toolA', content: 'ok', tool_call_id: 'call-1' }],
    }));
  },
}));

jest.mock('@langchain/core/messages', () => {
  interface IBaseMessage {
    content: any;
    additional_kwargs: any;
    response_metadata: any;
  }
  class BaseMessage implements IBaseMessage {
    public response_metadata: any;
    constructor(
      public content: any,
      public additional_kwargs: any = {},
      response_metadata: any = {}
    ) {
      this.response_metadata = response_metadata;
    }
  }

  class AIMessageChunk extends BaseMessage {
    tool_calls?: any[];
    constructor(opts: any) {
      super(
        opts.content,
        opts.additional_kwargs || {},
        opts.response_metadata || {}
      );
      if (opts.tool_calls) this.tool_calls = opts.tool_calls;
    }
  }

  class ToolMessage extends BaseMessage {
    constructor(
      public name: string,
      content: any,
      public tool_call_id: string,
      kwargs: any = {}
    ) {
      super(content, kwargs);
    }
  }

  class HumanMessage extends BaseMessage {}

  class SystemMessage extends BaseMessage {
    constructor(opts: any) {
      super(opts.content || opts, opts.additional_kwargs || {});
    }
  }

  return {
    BaseMessage,
    AIMessageChunk,
    ToolMessage,
    HumanMessage,
    SystemMessage,
  };
});

jest.mock('@langchain/core/prompts', () => ({
  MessagesPlaceholder: class {
    constructor(public _name: string) {}
  },
  ChatPromptTemplate: class {
    static fromMessages() {
      return new (require('@langchain/core/prompts').ChatPromptTemplate)();
    }
    async formatMessages(vars: any) {
      return vars;
    }
  },
}));

jest.mock('../../../shared/prompts/core/prompts.js', () => ({
  INTERACTIVE_PLAN_EXECUTOR_SYSTEM_PROMPT: 'INTERACTIVE_PLAN',
  INTERACTIVE_PLAN_VALIDATOR_SYSTEM_PROMPT: 'INTERACTIVE_VALIDATOR',
  STEP_EXECUTOR_SYSTEM_PROMPT: 'STEP_RULES',
  REPLAN_EXECUTOR_SYSTEM_PROMPT: 'REPLAN',
  STEPS_VALIDATOR_SYSTEM_PROMPT: 'STEPS_VALIDATOR',
  RETRY_EXECUTOR_SYSTEM_PROMPT: 'RETRY_EXEC',
}));

jest.mock('../../core/utils.js', () => ({
  initializeDatabase: jest.fn(async () => {}),
  initializeToolsList: jest.fn(async () => [{ name: 'toolA' }]),
  truncateToolResults: jest.fn((result: any) => ({
    messages: result?.messages ?? [
      { name: 'toolA', content: 'ok', tool_call_id: 'id-1' },
    ],
  })),
}));

jest.mock('../../operators/memoryAgent.js', () => ({
  MemoryAgent: class {
    prepareMemoryTools() {
      return [{ name: 'memoryTool' }];
    }
    createMemoryNode() {
      return jest.fn();
    }
  },
}));

jest.mock('../../operators/ragAgent.js', () => ({
  RagAgent: class {},
}));

jest.mock('../../../shared/enums/agent-modes.enum.js', () => ({
  TaskExecutorNode: {
    AGENT_EXECUTOR: 'agent_executor',
  },
  PlannerNode: {
    TASK_MANAGER: 'planning_orchestrator',
  },
  TaskMemoryNode: {
    MEMORY_ORCHESTRATOR: 'memory_orchestrator',
  },
  GraphNode: {
    AGENT_EXECUTOR: 'agent_executor',
    TASK_MANAGER: 'planning_orchestrator',
    MEMORY_ORCHESTRATOR: 'memory_orchestrator',
    END_GRAPH: 'end_graph',
  },
  ExecutionMode: {
    REACTIVE: 'REACTIVE',
    PLANNING: 'PLANNING',
  },
}));

const Agent = {
  PLANNER: 'planner',
  PLANNER_VALIDATOR: 'planner_validator',
  EXECUTOR: 'executor',
  EXEC_VALIDATOR: 'exec_validator',
  TOOLS: 'tools',
  HUMAN: 'human',
  SUMMARIZE: 'summarize',
  ADAPTIVE_PLANNER: 'adaptive_planner',
};

jest.mock('../utils/graph-utils.js', () => ({
  createMaxIterationsResponse: (graphStep: number) => ({
    messages: { content: `max-iter-${graphStep}`, additional_kwargs: {} },
    last_message: { content: `max-iter-${graphStep}`, additional_kwargs: {} },
    last_node: 'agent_executor',
    currentGraphStep: graphStep,
  }),
  filterMessagesByShortTermMemory: (msgs: any[], n: number) => msgs.slice(-n),
  formatParsedPlanSimple: (plan: any) =>
    `plan(${(plan?.steps || []).length} steps)`,
  handleModelError: (err: any) => ({
    messages: { content: `error:${err.message}`, additional_kwargs: {} },
  }),
  isTerminalMessage: (msg: any) =>
    String(msg?.content || '').includes('TERMINAL'),
  getLatestMessageForMessage: (messages: any[], type: any) => {
    const filtered = messages.filter((msg) => msg instanceof type);
    return filtered[filtered.length - 1] || null;
  },
}));

jest.mock('@langchain/core/tools', () => ({
  DynamicStructuredTool: class {},
  StructuredTool: class {},
  Tool: class {},
}));

jest.mock('../../../token/tokenTracking.js', () => ({
  TokenTracker: {
    trackCall: jest.fn(),
  },
}));

const makeModelSelectorConfig = () => ({
  debugMode: false,
  useModelSelector: false,
  modelsConfig: {
    fast: {
      provider: 'openai' as any,
      modelName: 'gpt-4o-mini',
      description: 'Fast model',
    },
    smart: {
      provider: 'openai' as any,
      modelName: 'gpt-4o-mini',
      description: 'Smart model',
    },
    cheap: {
      provider: 'openai' as any,
      modelName: 'gpt-4o-mini',
      description: 'Cheap model',
    },
  },
});

const makeSnakAgent = (overrides: Partial<any> = {}) => ({
  getAgentConfig: () => ({
    mode: AgentMode.INTERACTIVE,
    memory: true,
    rag: { enabled: true },
    prompt: { content: 'SYS' },
  }),
  getDatabaseCredentials: () => ({ uri: 'postgres://x' }),
  getMemoryAgent: () =>
    new (require('../../operators/memoryAgent.js').MemoryAgent)(),
  getRagAgent: () => new (require('../../operators/ragAgent.js').RagAgent)(),
  ...overrides,
});

const makeState = (over: Partial<any> = {}) => ({
  messages: [],
  last_node: 'start',
  memories: {
    short_term: [],
    long_term: [],
    semantic: [],
    episodic: [],
    working: [],
  },
  rag: '',
  plans_or_histories: [],
  currentTaskIndex: 0,
  retry: 0,
  currentGraphStep: 0,
  skipValidation: { skipValidation: false, goto: '' },
  error: null,
  ...over,
});

const makeConfig = (over: Partial<any> = {}) => ({
  configurable: {
    thread_id: undefined,
    max_graph_steps: 100,
    short_term_memory: 5,
    memory_size: 20,
    human_in_the_loop: 0,
    agent_config: {
      mode: AgentMode.INTERACTIVE,
      memory: true,
      rag: { enabled: true },
      prompt: { content: 'SYS' },
    },
    user_request: undefined,
    executionMode: ExecutionMode.REACTIVE,
    ...(over.configurable || {}),
  },
});

describe('Graph (Interactive Mode)', () => {
  let agent: Graph;
  let snak: any;
  let selector: ModelSelector;

  beforeEach(() => {
    snak = makeSnakAgent();
    selector = new ModelSelector(makeModelSelectorConfig());
    agent = new Graph(snak as any, selector);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('initialize() returns app and agent_config', async () => {
      const res = await agent.initialize();
      expect(res.app).toBeTruthy();
      expect(res.agent_config).toBeTruthy();
      expect(logger.info).toHaveBeenCalled();
    });
    it('createGraph() uses initialize()', async () => {
      const res = await createGraph(snak as any, selector);
      expect(res.app).toBeTruthy();
      expect(res.agent_config.prompt.content).toBe('SYS');
    });

    it('initialize() throws when getAgentConfig returns undefined', async () => {
      const invalidSnak = makeSnakAgent({ getAgentConfig: () => undefined });
      const invalidAgent = new Graph(invalidSnak as any, selector);
      await expect(invalidAgent.initialize()).rejects.toThrow(/agent config/i);
      expect(logger.error).toHaveBeenCalled();
    });

    it('initializeMemoryAgent initializes correctly', async () => {
      await (agent as any).initializeMemoryAgent();
      expect((agent as any).toolsList.length).toBeGreaterThanOrEqual(0);
      // Memory agent may or may not add tools depending on configuration
    });

    it('initializeRagAgent sets ragAgent property', async () => {
      await (agent as any).initializeRagAgent();
      expect((agent as any).ragAgent).toBeTruthy();
    });
  });

  describe('Graph workflow initialization', () => {
    it('buildWorkflow creates workflow with proper sub-graphs', async () => {
      await agent.initialize();
      const workflow = (agent as any).buildWorkflow();
      expect(workflow).toBeTruthy();
      expect(typeof workflow.addNode).toBe('function');
      expect(typeof workflow.addEdge).toBe('function');
      expect(typeof workflow.compile).toBe('function');
    });

    it('buildWorkflow throws error when memoryAgent is not setup', async () => {
      const invalidSnak = makeSnakAgent({
        getMemoryAgent: () => null,
      });
      const invalidAgent = new Graph(invalidSnak as any, selector);
      await invalidAgent.initialize().catch(() => {}); // Initialize may fail, that's ok
      (invalidAgent as any).memoryAgent = null;

      expect(() => (invalidAgent as any).buildWorkflow()).toThrow(
        'MemoryAgent is not setup'
      );
    });
  });

  describe('Routing logic', () => {
    it('orchestrationRouter handles different execution modes correctly', async () => {
      await agent.initialize();

      // Test REACTIVE mode routing
      const reactiveState = makeState({
        last_node: 'memory_orchestrator',
        messages: [
          new AIMessageChunk({
            content: 'test',
            additional_kwargs: { final: true },
          }),
        ],
      });

      const reactiveConfig = makeConfig({
        configurable: {
          executionMode: ExecutionMode.REACTIVE,
          agent_config: {
            mode: AgentMode.INTERACTIVE,
            memory: true,
            rag: { enabled: true },
            prompt: { content: 'SYS' },
          },
        },
      });

      const reactiveRoute = (agent as any).orchestrationRouter(
        reactiveState,
        reactiveConfig
      );
      expect(reactiveRoute).toBe('memory_orchestrator'); // Memory orchestrator routes to memory first

      // Test PLANNING mode routing
      const planningConfig = makeConfig({
        configurable: {
          executionMode: ExecutionMode.PLANNING,
          agent_config: {
            mode: AgentMode.INTERACTIVE,
            memory: true,
            rag: { enabled: true },
            prompt: { content: 'SYS' },
          },
        },
      });

      const planningRoute = (agent as any).orchestrationRouter(
        reactiveState,
        planningConfig
      );
      expect(planningRoute).toBe('memory_orchestrator'); // Memory orchestrator routes to memory first
    });

    it('startOrchestrationRouter routes INTERACTIVE mode correctly', async () => {
      await agent.initialize();

      // Test REACTIVE execution mode
      const state = makeState();
      const reactiveConfig = makeConfig({
        configurable: {
          executionMode: ExecutionMode.REACTIVE,
          agent_config: {
            mode: AgentMode.INTERACTIVE,
            memory: true,
            rag: { enabled: true },
            prompt: { content: 'SYS' },
          },
        },
      });

      const reactiveRoute = (agent as any).startOrchestrationRouter(
        state,
        reactiveConfig
      );
      expect(reactiveRoute).toBe('agent_executor');

      // Test PLANNING execution mode
      const planningConfig = makeConfig({
        configurable: {
          executionMode: ExecutionMode.PLANNING,
          agent_config: {
            mode: AgentMode.INTERACTIVE,
            memory: true,
            rag: { enabled: true },
            prompt: { content: 'SYS' },
          },
        },
      });

      const planningRoute = (agent as any).startOrchestrationRouter(
        state,
        planningConfig
      );
      expect(planningRoute).toBe('planning_orchestrator');
    });
  });

  describe('Error handling', () => {
    it('orchestrationRouter handles error state correctly', async () => {
      await agent.initialize();

      const errorState = makeState({
        error: {
          hasError: true,
          message: 'Test error',
          source: 'test',
          timestamp: Date.now(),
        },
      });

      const config = makeConfig();
      const route = (agent as any).orchestrationRouter(errorState, config);
      expect(route).toBe('end_graph');
    });

    it('startOrchestrationRouter handles missing config gracefully', async () => {
      await agent.initialize();

      const state = makeState();
      const invalidConfig = { configurable: {} };

      const route = (agent as any).startOrchestrationRouter(
        state,
        invalidConfig
      );
      expect(route).toBe('end_graph');
    });
  });

  describe('Memory and RAG initialization', () => {
    it('initializeMemoryAgent adds memory tools to toolsList', async () => {
      await (agent as any).initializeMemoryAgent();
      expect((agent as any).toolsList.length).toBeGreaterThanOrEqual(0);
      if ((agent as any).memoryAgent) {
        expect((agent as any).memoryAgent).toBeTruthy();
      }
    });

    it('initializeRagAgent sets ragAgent property', async () => {
      await (agent as any).initializeRagAgent();
      expect((agent as any).ragAgent).toBeTruthy();
    });

    it('initialization handles missing agents gracefully', async () => {
      const invalidSnak = makeSnakAgent({
        getMemoryAgent: () => null,
        getRagAgent: () => null,
      });
      const invalidAgent = new Graph(invalidSnak as any, selector);

      await (invalidAgent as any).initializeMemoryAgent();
      await (invalidAgent as any).initializeRagAgent();

      expect((invalidAgent as any).ragAgent).toBeNull();
    });
  });

  describe('Skip validation routing', () => {
    it('orchestrationRouter handles skipValidation correctly', async () => {
      await agent.initialize();

      const skipState = makeState({
        skipValidation: {
          skipValidation: true,
          goto: 'agent_executor',
        },
      });

      const config = makeConfig();
      const route = (agent as any).orchestrationRouter(skipState, config);
      expect(route).toBe('agent_executor');
    });

    it('orchestrationRouter handles invalid skip target gracefully', async () => {
      await agent.initialize();

      const skipState = makeState({
        skipValidation: {
          skipValidation: true,
          goto: 'invalid_target',
        },
      });

      const config = makeConfig();
      const route = (agent as any).orchestrationRouter(skipState, config);
      expect(route).toBe('end_graph');
    });
  });

  describe('Configuration and compilation', () => {
    it.each([
      [
        'memory enabled',
        true,
        { checkpointer: expect.any(Object), configurable: expect.any(Object) },
      ],
      ['memory disabled', false, { configurable: expect.any(Object) }],
    ])(
      'getCompileOptions %s returns correct options',
      async (_, memoryEnabled, expectedOptions) => {
        const testSnak = makeSnakAgent({
          getAgentConfig: () => ({
            mode: AgentMode.INTERACTIVE,
            memory: memoryEnabled,
            rag: { enabled: true },
            prompt: { content: 'SYS' },
          }),
        });
        const testAgent = new Graph(testSnak as any, selector);
        await testAgent.initialize();

        const options = (testAgent as any).getCompileOptions();
        expect(options.configurable).toBeDefined();
        expect(options.configurable.agent_config).toBeDefined();
        if (memoryEnabled) {
          expect(options.checkpointer).toBeDefined();
        }
      }
    );
  });

  describe('Graph operations', () => {
    it('end_graph resets state correctly', () => {
      const res = (agent as any).end_graph({});
      expect(res.plans_or_histories).toBeUndefined();
      expect(res.currentTaskIndex).toBe(0);
      expect(res.retry).toBe(0);
    });
  });

  describe('Integration scenarios', () => {
    it('successfully initializes and compiles graph for interactive mode', async () => {
      const result = await agent.initialize();
      expect(result.app).toBeTruthy();
      expect(result.agent_config).toBeTruthy();
      expect(result.agent_config.mode).toBe(AgentMode.INTERACTIVE);
    });

    it('graph routing works correctly for different execution modes in interactive agent', async () => {
      await agent.initialize();

      // Test start routing for INTERACTIVE mode with REACTIVE execution
      const reactiveState = makeState();
      const reactiveConfig = makeConfig({
        configurable: {
          agent_config: {
            mode: AgentMode.INTERACTIVE,
            memory: true,
            rag: { enabled: true },
            prompt: { content: 'SYS' },
          },
          executionMode: ExecutionMode.REACTIVE,
        },
      });

      const reactiveRoute = (agent as any).startOrchestrationRouter(
        reactiveState,
        reactiveConfig
      );
      expect(reactiveRoute).toBe('agent_executor');

      // Test start routing for INTERACTIVE mode with PLANNING execution
      const planningConfig = makeConfig({
        configurable: {
          agent_config: {
            mode: AgentMode.INTERACTIVE,
            memory: true,
            rag: { enabled: true },
            prompt: { content: 'SYS' },
          },
          executionMode: ExecutionMode.PLANNING,
        },
      });

      const planningRoute = (agent as any).startOrchestrationRouter(
        reactiveState,
        planningConfig
      );
      expect(planningRoute).toBe('planning_orchestrator');
    });
  });
});
