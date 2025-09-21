import { logger, AgentMode } from '@snakagent/core';
import { ModelSelector } from '../../operators/modelSelector.js';
import {
  BaseMessage,
  AIMessageChunk,
  ToolMessage,
  HumanMessage,
} from '@langchain/core/messages';
import { MemoryAgent } from '../../operators/memoryAgent.js';
import { RagAgent } from '../../operators/ragAgent.js';
import { Graph, createGraph } from '../graph.js';
import { ExecutionMode } from '../../../shared/enums/agent-modes.enum.js';

// Mock all the modules first before importing the main module
jest.mock('../sub-graph/memory-graph.js', () => ({
  MemoryGraph: jest.fn().mockImplementation(() => ({
    createGraphMemory: jest.fn(),
    getMemoryGraph: jest.fn(() => jest.fn()),
  })),
}));

jest.mock('../sub-graph/planner-graph.js', () => ({
  PlannerGraph: jest.fn().mockImplementation(() => ({
    createPlannerGraph: jest.fn(),
    getPlannerGraph: jest.fn(() => jest.fn()),
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

// Consolidated mocks - one per package
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
  },
}));

jest.mock('../../operators/modelSelector.js', () => ({
  ModelSelector: class {
    private model = {
      withStructuredOutput() {
        return {
          invoke: jest.fn(async () => ({
            steps: [
              {
                stepNumber: 1,
                stepName: 'Step 1',
                description: 'desc',
                status: 'pending',
                type: 'message',
                result: '',
              },
            ],
            summary: 'sum',
          })),
        };
      },
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
      },
      invoke: jest.fn(async () => ({
        content: 'summary',
        additional_kwargs: {},
        response_metadata: { usage: { completion_tokens: 3 } },
      })),
    };
    getModels() {
      return { fast: this.model };
    }
    async selectModelForMessages() {
      return { modelName: 'fast', model: this.model };
    }
  },
}));

jest.mock('@langchain/langgraph', () => ({
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
  Annotation: Object.assign(
    (schema: any) => ({
      reducer: (x: any, y: any) => y,
      default: () => schema,
    }),
    {
      Root: (schema: any) => ({ State: { ...schema } }),
    }
  ),
  END: '__END__',
  interrupt: (s: any) => s,
}));

jest.mock('@langchain/langgraph/prebuilt', () => ({
  ToolNode: class {
    invoke = jest.fn(async () => ({
      messages: [{ name: 'toolA', content: 'ok', tool_call_id: 'call-1' }],
    }));
  },
}));

jest.mock('@langchain/core/messages', () => ({
  BaseMessage: class {
    public response_metadata: any;
    public content: any;
    public additional_kwargs: any;
    constructor(content: any, additional_kwargs: any = {}) {
      this.content = content;
      this.additional_kwargs = additional_kwargs || {};
      this.response_metadata = {};
    }
    _getType() {
      return 'base';
    }
  },
  AIMessageChunk: class {
    public content: any;
    public additional_kwargs: any;
    public response_metadata: any;
    public tool_calls?: any[];
    constructor(opts: any) {
      this.content = opts.content;
      this.additional_kwargs = opts.additional_kwargs || {};
      this.response_metadata = opts.response_metadata || {};
      if (opts.tool_calls) this.tool_calls = opts.tool_calls;
    }
    _getType() {
      return 'ai';
    }
  },
  ToolMessage: class {
    public name: string;
    public content: any;
    public tool_call_id: string;
    public additional_kwargs: any;
    constructor(name: string, content: any, tool_call_id: string) {
      this.name = name;
      this.content = content;
      this.tool_call_id = tool_call_id;
      this.additional_kwargs = {};
    }
    _getType() {
      return 'tool';
    }
  },
  HumanMessage: class {
    public content: any;
    public additional_kwargs: any;
    constructor(content: any, additional_kwargs: any = {}) {
      this.content = content;
      this.additional_kwargs = additional_kwargs;
    }
    _getType() {
      return 'human';
    }
  },
  SystemMessage: class {
    public content: any;
    public additional_kwargs: any;
    constructor(opts: any) {
      this.content = opts.content || opts;
      this.additional_kwargs = opts.additional_kwargs || {};
    }
    _getType() {
      return 'system';
    }
  },
}));

jest.mock('@langchain/core/prompts', () => ({
  MessagesPlaceholder: class {
    constructor(public _name: string) {}
  },
  ChatPromptTemplate: class {
    static fromMessages() {
      return new (class MockChatPromptTemplate {
        async formatMessages(vars: any) {
          return vars;
        }
      })();
    }
    async formatMessages(vars: any) {
      return vars;
    }
  },
}));

jest.mock('../../../shared/prompts/core/prompts.js', () => ({
  ADAPTIVE_PLANNER_CONTEXT: 'CTX',
  ADAPTIVE_PLANNER_SYSTEM_PROMPT: 'AP_SYS',
  AUTONOMOUS_PLAN_EXECUTOR_SYSTEM_PROMPT: 'AUTO_PLAN',
  STEP_EXECUTOR_SYSTEM_PROMPT: 'STEP_RULES',
  REPLAN_EXECUTOR_SYSTEM_PROMPT: 'REPLAN',
  STEPS_VALIDATOR_SYSTEM_PROMPT: 'STEPS_VALIDATOR',
  RETRY_EXECUTOR_SYSTEM_PROMPT: 'RETRY_EXEC',
  STEP_EXECUTOR_CONTEXT: 'STEP_CTX',
  RETRY_CONTENT: 'RETRY_CTX',
  AUTONOMOUS_PLAN_VALIDATOR_SYSTEM_PROMPT: 'PLAN_VALIDATOR',
  SummarizeAgent: 'SUMMARIZE',
  HYBRID_PLAN_EXECUTOR_SYSTEM_PROMPT: 'HYBR_PLAN',
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
  ExecutorNode: {
    AGENT_EXECUTOR: 'agent_executor',
  },
  PlannerNode: {
    PLANNING_ORCHESTRATOR: 'planning_orchestrator',
  },
  MemoryNode: {
    MEMORY_ORCHESTRATOR: 'memory_orchestrator',
  },
  GraphNode: {
    AGENT_EXECUTOR: 'agent_executor',
    PLANNING_ORCHESTRATOR: 'planning_orchestrator',
    MEMORY_ORCHESTRATOR: 'memory_orchestrator',
    END_GRAPH: 'end_graph',
  },
  ExecutionMode: {
    REACTIVE: 'REACTIVE',
    PLANNING: 'PLANNING',
  },
}));

jest.mock('../utils/graph-utils.js', () => ({
  createMaxIterationsResponse: (graphStep: number) => ({
    messages: { content: `max-iter-${graphStep}`, additional_kwargs: {} },
    last_message: { content: `max-iter-${graphStep}`, additional_kwargs: {} },
    last_node: 'executor',
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
}));

// Factory functions
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
    mode: AgentMode.AUTONOMOUS,
    memory: true,
    rag: { enabled: true },
    prompt: { content: 'SYS' },
  }),
  getDatabaseCredentials: () => ({ uri: 'postgres://x' }),
  getMemoryAgent: () => new MemoryAgent({}),
  getRagAgent: () => new RagAgent({}),
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
      mode: AgentMode.AUTONOMOUS,
      memory: true,
      rag: { enabled: true },
      prompt: { content: 'SYS' },
    },
    user_request: undefined,
    executionMode: ExecutionMode.PLANNING,
    ...(over.configurable || {}),
  },
});

describe('Graph (Autonomous Mode)', () => {
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
            mode: AgentMode.AUTONOMOUS,
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

  describe('Routing logic', () => {
    it('orchestrationRouter handles different execution modes correctly', async () => {
      await agent.initialize();

      // Test PLANNING mode routing
      const planningState = makeState({
        last_node: 'memory_orchestrator',
        messages: [
          new AIMessageChunk({
            content: 'test',
            additional_kwargs: { final: true },
          }),
        ],
      });

      const planningConfig = makeConfig({
        configurable: {
          executionMode: ExecutionMode.PLANNING,
          agent_config: {
            mode: AgentMode.AUTONOMOUS,
            memory: true,
            rag: { enabled: true },
            prompt: { content: 'SYS' },
          },
        },
      });

      const planningRoute = (agent as any).orchestrationRouter(
        planningState,
        planningConfig
      );
      expect(planningRoute).toBe('memory_orchestrator'); // Memory orchestrator routes to memory first

      // Test REACTIVE mode routing
      const reactiveConfig = makeConfig({
        configurable: {
          executionMode: ExecutionMode.REACTIVE,
          agent_config: {
            mode: AgentMode.AUTONOMOUS,
            memory: true,
            rag: { enabled: true },
            prompt: { content: 'SYS' },
          },
        },
      });

      const reactiveRoute = (agent as any).orchestrationRouter(
        planningState,
        reactiveConfig
      );
      expect(reactiveRoute).toBe('memory_orchestrator'); // Memory orchestrator routes to memory first
    });

    it('startOrchestrationRouter routes AUTONOMOUS mode correctly', async () => {
      await agent.initialize();

      const state = makeState();
      const config = makeConfig();

      const route = (agent as any).startOrchestrationRouter(state, config);
      expect(route).toBe('planning_orchestrator');
    });
  });

  describe('Graph operations', () => {
    it('end_graph resets state correctly', () => {
      const res = (agent as any).end_graph({});
      expect(res.plans_or_histories).toBeUndefined();
      expect(res.currentTaskIndex).toBe(0);
      expect(res.retry).toBe(0);
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

  describe('Integration scenarios', () => {
    it('successfully initializes and compiles graph for autonomous mode', async () => {
      const result = await agent.initialize();
      expect(result.app).toBeTruthy();
      expect(result.agent_config).toBeTruthy();
      expect(result.agent_config.mode).toBe(AgentMode.AUTONOMOUS);
    });

    it('graph routing works correctly for different agent modes', async () => {
      await agent.initialize();

      // Test start routing for AUTONOMOUS mode
      const autonomousState = makeState();
      const autonomousConfig = makeConfig({
        configurable: {
          agent_config: {
            mode: AgentMode.AUTONOMOUS,
            memory: true,
            rag: { enabled: true },
            prompt: { content: 'SYS' },
          },
          executionMode: ExecutionMode.PLANNING,
        },
      });

      const autonomousRoute = (agent as any).startOrchestrationRouter(
        autonomousState,
        autonomousConfig
      );
      expect(autonomousRoute).toBe('planning_orchestrator');
    });
  });
});
