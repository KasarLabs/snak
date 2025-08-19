import { logger, AgentMode } from '@snakagent/core';
import { ModelSelector } from '../../operators/modelSelector.js';
import { Agent } from '../types/index.js';
import {
  BaseMessage,
  AIMessageChunk,
  ToolMessage,
  HumanMessage,
} from '@langchain/core/messages';
import { AutonomousAgent, createAutonomousAgent } from '../autonomous.js';
import { MemoryAgent } from '../../operators/memoryAgent.js';
import { RagAgent } from '../../operators/ragAgent.js';

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
      return { model_name: 'fast', model: this.model };
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

jest.mock('../../../prompt/prompts.js', () => ({
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

jest.mock('../types/index.js', () => ({
  Agent: {
    PLANNER: 'planner',
    PLANNER_VALIDATOR: 'planner_validator',
    EXECUTOR: 'executor',
    EXEC_VALIDATOR: 'exec_validator',
    TOOLS: 'tools',
    HUMAN: 'human',
    SUMMARIZE: 'summarize',
    ADAPTIVE_PLANNER: 'adaptive_planner',
  },
}));

jest.mock('../utils.js', () => ({
  createMaxIterationsResponse: (graphStep: number) => ({
    messages: { content: `max-iter-${graphStep}`, additional_kwargs: {} },
    last_message: { content: `max-iter-${graphStep}`, additional_kwargs: {} },
    last_agent: 'executor',
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
      model_name: 'gpt-4o-mini',
      description: 'Fast model',
    },
    smart: {
      provider: 'openai' as any,
      model_name: 'gpt-4o-mini',
      description: 'Smart model',
    },
    cheap: {
      provider: 'openai' as any,
      model_name: 'gpt-4o-mini',
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
  last_message: new AIMessageChunk({
    content: 'init',
    additional_kwargs: { from: Agent.PLANNER, final: false },
  }),
  last_agent: Agent.PLANNER,
  memories: '',
  rag: '',
  plan: {
    steps: [
      {
        stepNumber: 1,
        stepName: 'S1',
        description: 'do something',
        status: 'pending',
        type: 'message',
        result: '',
      },
    ],
    summary: '',
  },
  currentStepIndex: 0,
  retry: 0,
  currentGraphStep: 0,
  ...over,
});

const makeConfig = (over: Partial<any> = {}) => ({
  configurable: {
    max_graph_steps: 3,
    short_term_memory: 2,
    memory_size: 20,
    human_in_the_loop: false,
    ...(over.configurable || {}),
  },
});

describe('AutonomousAgent', () => {
  let agent: AutonomousAgent;
  let snak: any;
  let selector: ModelSelector;

  beforeEach(() => {
    snak = makeSnakAgent();
    selector = new ModelSelector(makeModelSelectorConfig());
    agent = new AutonomousAgent(snak as any, selector);
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

    it('createAutonomousAgent() uses initialize()', async () => {
      const res = await createAutonomousAgent(snak as any, selector);
      expect(res.app).toBeTruthy();
      expect(res.agent_config.prompt.content).toBe('SYS');
    });

    it('initialize() throws when getAgentConfig returns undefined', async () => {
      const invalidSnak = makeSnakAgent({ getAgentConfig: () => undefined });
      const invalidAgent = new AutonomousAgent(invalidSnak as any, selector);
      await expect(invalidAgent.initialize()).rejects.toThrow(/agent config/i);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('System prompt building', () => {
    it.each([
      ['with tools', [{ name: 'A' }, { name: 'B' }], 'A, B'],
      ['empty tools', [], ''],
    ])(
      'buildSystemPrompt %s includes correct content',
      async (_, tools, expectedTools) => {
        await agent.initialize();
        (agent as any).toolsList = tools;

        const prompt = (agent as any).buildSystemPrompt(
          makeState(),
          makeConfig()
        );
        expect(prompt).toContain('SYS');
        expect(prompt).toContain('STEP_RULES');
        expect(prompt).toContain(`Available tools: ${expectedTools}`);
      }
    );
  });

  describe('Routing logic', () => {
    it.each([
      [
        'PLANNER_VALIDATOR validated',
        Agent.PLANNER_VALIDATOR,
        { validated: true, error: false },
        'executor',
      ],
      [
        'PLANNER_VALIDATOR error',
        Agent.PLANNER_VALIDATOR,
        { error: true },
        'end',
      ],
      [
        'EXEC_VALIDATOR final',
        Agent.EXEC_VALIDATOR,
        { final: true },
        'adaptive_planner',
      ],
      ['EXEC_VALIDATOR max retries', Agent.EXEC_VALIDATOR, {}, 'end', 5],
    ])(
      'handleValidatorRouting %s -> %s',
      (_, agentType, kwargs, expectedRoute, retry = 0) => {
        const state = makeState({
          last_agent: agentType,
          last_message: new AIMessageChunk({
            content: 'test',
            additional_kwargs: {
              from:
                agentType === Agent.PLANNER_VALIDATOR
                  ? 'planner_validator'
                  : 'exec_validator',
              ...kwargs,
            },
          }),
          retry,
        });

        const route = (agent as any).handleValidatorRouting(state);
        expect(route).toBe(expectedRoute);
      }
    );

    it.each([
      ['terminal message', { content: '...TERMINAL...' }, 'end'],
      ['REQUEST_REPLAN', { content: 'REQUEST_REPLAN' }, 're_planner'],
      ['tool calls', { tool_calls: [{ name: 'toolA', args: {} }] }, 'tools'],
      ['max steps reached', {}, 'end', 1, { max_graph_steps: 1 }, Agent.TOOLS],
    ])(
      'shouldContinueAutonomous %s -> %s',
      (
        _,
        messageProps,
        expectedRoute,
        graphStep = 0,
        configOverrides = { max_graph_steps: 100 },
        lastAgent = Agent.EXECUTOR
      ) => {
        const state = makeState({
          last_agent: lastAgent,
          last_message: new AIMessageChunk({
            content: 'test',
            ...messageProps,
          }),
          currentGraphStep: graphStep,
        });

        const next = (agent as any).shouldContinueAutonomous(state, {
          configurable: configOverrides,
        });
        expect(next).toBe(expectedRoute);
      }
    );

    describe('shouldContinueHybrid', () => {
      beforeEach(() => {
        (agent as any).agentConfig = {
          ...snak.getAgentConfig(),
          mode: AgentMode.HYBRID,
        };
      });

      it.each([
        ['final message', { additional_kwargs: { final: true } }, 'end'],
        ['human_in_the_loop step', {}, 'human', 'human_in_the_loop'],
        ['tool calls', { tool_calls: [{ name: 'toolA', args: {} }] }, 'tools'],
        ['default case', {}, 'validator'],
      ])('%s -> %s', (_, messageProps, expectedRoute, stepType = 'message') => {
        const state = makeState({
          last_agent: Agent.EXECUTOR,
          last_message: new AIMessageChunk({
            content: 'test',
            ...messageProps,
          }),
          plan: {
            steps: [{ ...makeState().plan.steps[0], type: stepType }],
            summary: '',
          },
          messages: [
            new HumanMessage('test'),
            new AIMessageChunk({ content: 'test', ...messageProps }),
          ],
        });

        const result = (agent as any).shouldContinueHybrid(state);
        expect(result).toBe(expectedRoute);
      });
    });
  });

  describe('Node operations', () => {
    it('humanNode returns HUMAN message and increments graph step', async () => {
      const state = makeState();
      const res = await (agent as any).humanNode(state);
      expect(res.last_agent).toBe(Agent.HUMAN);
      expect(res.currentGraphStep).toBe(state.currentGraphStep + 1);
    });

    it('end_graph resets plan, index and retry', () => {
      const res = (agent as any).end_graph({});
      expect(res.plan.steps).toEqual([]);
      expect(res.currentStepIndex).toBe(0);
      expect(res.retry).toBe(0);
    });
  });

  describe('Executor operations', () => {
    beforeEach(async () => {
      await agent.initialize();
      (agent as any).agentConfig = snak.getAgentConfig();
      (agent as any).modelSelector = selector;
      (agent as any).toolsList = [{ name: 't' }];
    });

    it.each([
      ['max_graph_steps limit', 3, 3, 'max-iter-3'],
      ['max_graph_steps exact', 2, 2, 'max-iter-2'],
    ])(
      '%s returns correct response',
      async (_, currentStep, maxSteps, expectedContent) => {
        const state = makeState({ currentGraphStep: currentStep });
        const cfg = makeConfig({ configurable: { max_graph_steps: maxSteps } });

        const res = await (agent as any).callModel(state, cfg);
        expect(res.last_message.content).toContain(expectedContent);
        expect(res.last_agent).toBe(Agent.EXECUTOR);
      }
    );

    it('callModel updates plan.result when no tool_calls', async () => {
      const state = makeState();
      const res = await (agent as any).callModel(state, makeConfig());
      expect(res.last_agent).toBe(Agent.EXECUTOR);
      expect(res.plan.steps[0].result).toBe('model-result');
    });

    it('callModel handles model not found error gracefully', async () => {
      (agent as any).modelSelector = {
        getModels: () => ({}),
        selectModelForMessages: jest.fn(),
      };

      const res = await (agent as any).callModel(makeState(), makeConfig());
      expect(res.last_message.content).toContain('error:');
      expect(res.messages).toBeDefined();
    });
  });

  describe('Planner operations', () => {
    beforeEach(async () => {
      await agent.initialize();
      (agent as any).agentConfig = snak.getAgentConfig();
      (agent as any).toolsList = [{ name: 't1' }];
    });

    it.each([
      ['initial plan', Agent.PLANNER, { steps: [], summary: '' }],
      ['re-plan', Agent.PLANNER_VALIDATOR, { steps: [], summary: '' }],
      [
        'hybrid mode',
        Agent.PLANNER,
        { steps: [], summary: '' },
        AgentMode.HYBRID,
      ],
    ])(
      '%s creates plan successfully',
      async (_, lastAgent, plan, mode = AgentMode.AUTONOMOUS) => {
        if (mode === AgentMode.HYBRID) {
          (agent as any).agentConfig = { ...snak.getAgentConfig(), mode };
        }

        const state = makeState({
          messages: [new HumanMessage('hi')],
          plan,
          last_agent: lastAgent,
          last_message:
            lastAgent === Agent.PLANNER_VALIDATOR
              ? new AIMessageChunk({
                  content: 'validator says fix',
                  additional_kwargs: { from: Agent.PLANNER_VALIDATOR },
                })
              : new AIMessageChunk({
                  content: 'init',
                  additional_kwargs: { from: Agent.PLANNER },
                }),
        });

        const res = await (agent as any).planExecution(state, makeConfig());
        expect(res.last_agent).toBe(Agent.PLANNER);
        expect(res.plan.steps.length).toBeGreaterThan(0);
        expect(res.currentStepIndex).toBe(0);
      }
    );

    it('adaptivePlanner appends steps and increments graph step', async () => {
      const state = makeState({
        plan: { steps: [], summary: '' },
        currentGraphStep: 1,
        messages: [],
        currentStepIndex: 0,
      });

      const res = await (agent as any).adaptivePlanner(state, makeConfig());
      expect(res.plan.steps.length).toBeGreaterThan(0);
      expect(res.currentGraphStep).toBe(2);
      expect(res.last_agent).toBe(Agent.PLANNER);
    });

    it('planner handles model not found error gracefully', async () => {
      (agent as any).modelSelector = {
        getModels: () => ({}),
        selectModelForMessages: jest.fn(),
      };

      const state = makeState({
        plan: { steps: [], summary: '' },
        currentGraphStep: 1,
        messages: [],
        currentStepIndex: 0,
      });

      const res = await (agent as any).adaptivePlanner(state, makeConfig());
      expect(res.last_message.content).toContain('Failed to create plan');
      expect(res.last_agent).toBe(Agent.PLANNER);
    });
  });

  describe('Validation operations', () => {
    beforeEach(async () => {
      await agent.initialize();
      (agent as any).agentConfig = snak.getAgentConfig();
      (agent as any).modelSelector = selector;
    });

    it.each([
      ['PLANNER', Agent.PLANNER, Agent.PLANNER_VALIDATOR],
      ['EXECUTOR', Agent.EXECUTOR, Agent.EXEC_VALIDATOR],
    ])('validator routes %s to %s', async (_, agentType, expectedValidator) => {
      const state = makeState({
        last_agent: agentType,
        plan: {
          steps: [
            {
              stepNumber: 1,
              stepName: 'Test',
              description: 'test',
              status: 'pending',
              result: '',
            },
          ],
          summary: 'test',
        },
      });

      const res = await (agent as any).validator(state);
      expect(res.last_agent).toBe(expectedValidator);
      expect(res.currentGraphStep).toBe(state.currentGraphStep + 1);
    });

    it('validatorPlanner validates plan successfully', async () => {
      const state = makeState({
        last_agent: Agent.PLANNER,
        plan: {
          steps: [
            {
              stepNumber: 1,
              stepName: 'Test',
              description: 'test',
              status: 'pending',
              result: '',
            },
          ],
          summary: 'test',
        },
      });

      const res = await (agent as any).validatorPlanner(state);
      expect(res.last_agent).toBe(Agent.PLANNER_VALIDATOR);
      expect(res.currentGraphStep).toBe(state.currentGraphStep + 1);
    });

    it('validatorExecutor validates step successfully', async () => {
      const state = makeState({
        last_agent: Agent.EXECUTOR,
        last_message: new AIMessageChunk({
          content: 'Step completed',
          additional_kwargs: {},
        }),
        plan: {
          steps: [
            {
              stepNumber: 1,
              stepName: 'Test',
              description: 'test',
              status: 'pending',
              result: '',
            },
          ],
          summary: 'test',
        },
      });

      const res = await (agent as any).validatorExecutor(state);
      expect(res.last_agent).toBe(Agent.EXEC_VALIDATOR);
      expect(res.currentGraphStep).toBe(state.currentGraphStep + 1);
    });

    it('validators handle model not found error gracefully', async () => {
      (agent as any).modelSelector = {
        getModels: () => ({}),
        selectModelForMessages: jest.fn(),
      };

      const state = makeState({
        last_agent: Agent.PLANNER,
        plan: {
          steps: [
            {
              stepNumber: 1,
              stepName: 'Test',
              description: 'test',
              status: 'pending',
              result: '',
            },
          ],
          summary: 'test',
        },
      });

      const res = await (agent as any).validatorPlanner(state);
      expect(res.last_message.content).toContain('Failed to validate plan');
      expect(res.last_agent).toBe(Agent.PLANNER_VALIDATOR);
    });
  });

  describe('Tool operations', () => {
    beforeEach(async () => {
      await agent.initialize();
      (agent as any).agentConfig = snak.getAgentConfig();
      (agent as any).toolsList = [{ name: 'toolA' }];
    });

    it('toolNodeInvoke wraps tool result and tags messages', async () => {
      const toolNode = (agent as any).createToolNode();
      const state = makeState({
        last_message: new AIMessageChunk({
          content: 'x',
          additional_kwargs: {},
          tool_calls: [{ name: 'toolA', args: { foo: 'bar' } }],
        }),
      });

      const res = await (agent as any).toolNodeInvoke(
        state,
        undefined,
        toolNode.invoke.bind(toolNode)
      );
      expect(res?.last_agent).toBe(Agent.TOOLS);
      expect(Array.isArray(res?.messages)).toBe(true);
      expect((res?.messages[0] as ToolMessage).name).toBe('toolA');
      expect((res?.messages[0] as any).additional_kwargs.from).toBe('tools');
    });

    it('createToolNode creates ToolNode with overridden invoke method', () => {
      const toolNode = (agent as any).createToolNode();
      expect(toolNode).toBeTruthy();
      expect(typeof toolNode.invoke).toBe('function');
    });

    it('toolNodeInvoke propagates tool execution errors', async () => {
      const originalInvoke = jest.fn().mockRejectedValue(new Error('boom'));
      const state = makeState({
        last_message: new AIMessageChunk({
          content: 'x',
          tool_calls: [{ name: 'toolA', args: {} }],
        }),
      });

      await expect(
        (agent as any).toolNodeInvoke(state, undefined, originalInvoke)
      ).rejects.toThrow('boom');
    });
  });

  describe('Memory and RAG operations', () => {
    it('initializeMemoryAgent adds memory tools to toolsList', async () => {
      await (agent as any).initializeMemoryAgent();
      expect((agent as any).toolsList.length).toBeGreaterThan(0);
      expect(
        (agent as any).toolsList.some((tool: any) => tool.name === 'memoryTool')
      ).toBe(true);
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
      const invalidAgent = new AutonomousAgent(invalidSnak as any, selector);

      await (invalidAgent as any).initializeMemoryAgent();
      await (invalidAgent as any).initializeRagAgent();

      expect((invalidAgent as any).toolsList.length).toBe(0);
      expect((invalidAgent as any).ragAgent).toBeNull();
    });
  });

  describe('Summarization', () => {
    beforeEach(async () => {
      await agent.initialize();
      (agent as any).agentConfig = snak.getAgentConfig();
      (agent as any).modelSelector = selector;
    });

    it.each([
      ['below threshold', 9, { messages: expect.any(Array) }],
      ['at threshold', 10, { messages: expect.any(Array) }],
      ['above threshold', 15, { messages: expect.any(Array) }],
    ])(
      'summarizeMessages %s returns correct result',
      async (_, messageCount, expectedResult) => {
        const msgs: any[] = [];
        for (let i = 0; i < messageCount; i++) {
          msgs.push(
            new AIMessageChunk({
              content: `exec-${i}`,
              additional_kwargs: { from: Agent.EXECUTOR },
              response_metadata: { usage: { completion_tokens: 100 } },
            })
          );
        }
        if (messageCount > 0) {
          msgs.unshift(new HumanMessage('start'));
        }

        const state = makeState({ messages: msgs });
        const res = await (agent as any).summarizeMessages(state);
        expect(res).toEqual(expectedResult);
      }
    );

    it('summarizeMessages handles model not found error', async () => {
      (agent as any).modelSelector = {
        getModels: () => ({}),
        selectModelForMessages: jest.fn(),
      };

      const msgs: any[] = [];
      for (let i = 0; i < 15; i++) {
        msgs.push(
          new AIMessageChunk({
            content: `exec-${i}`,
            additional_kwargs: { from: Agent.EXECUTOR },
            response_metadata: { usage: { completion_tokens: 100 } },
          })
        );
      }
      const state = makeState({ messages: msgs });

      await expect((agent as any).summarizeMessages(state)).rejects.toThrow(
        'Model not found in ModelSelector'
      );
    });

    it('summarizeMessages stops once token budget exceeds 11000', async () => {
      const msgs: any[] = [new HumanMessage('start')];
      for (let i = 0; i < 120; i++) {
        const m = new AIMessageChunk({
          content: `exec-${i}`,
          additional_kwargs: { from: Agent.EXECUTOR },
        });
        m.response_metadata = { usage: { completion_tokens: 100 } };
        msgs.push(m);
      }
      const res = await (agent as any).summarizeMessages(
        makeState({ messages: msgs })
      );

      expect(res.messages).toBeInstanceOf(Array);
      expect(res.messages!.length).toBeLessThan(msgs.length);

      const hasStartMessage = res.messages!.some(
        (msg: any) => msg instanceof HumanMessage && msg.content === 'start'
      );
      expect(hasStartMessage).toBe(true);

      const hasSummaryMessage = res.messages!.some(
        (msg: any) => msg.additional_kwargs?.from === Agent.SUMMARIZE
      );
      expect(hasSummaryMessage).toBe(true);

      const lastMessage = res.messages![res.messages!.length - 1];
      expect(lastMessage.additional_kwargs?.from).toBe(Agent.SUMMARIZE);
    });
  });

  describe('Configuration and compilation', () => {
    it.each([
      [
        'memory enabled',
        true,
        { checkpointer: expect.any(Object), configurable: {} },
      ],
      ['memory disabled', false, {}],
    ])(
      'getCompileOptions %s returns correct options',
      (_, memoryEnabled, expectedOptions) => {
        (agent as any).agentConfig = {
          ...snak.getAgentConfig(),
          memory: memoryEnabled,
        };

        const options = (agent as any).getCompileOptions();
        expect(options).toEqual(expectedOptions);
      }
    );

    it('buildWorkflow creates StateGraph with all required nodes', () => {
      (agent as any).agentConfig = snak.getAgentConfig();
      (agent as any).memoryAgent = snak.getMemoryAgent();

      const workflow = (agent as any).buildWorkflow();
      expect(workflow).toBeTruthy();
      expect(typeof workflow.addNode).toBe('function');
      expect(typeof workflow.addEdge).toBe('function');
      expect(typeof workflow.compile).toBe('function');
    });

    it('buildWorkflow throws error when memoryAgent is not setup', () => {
      (agent as any).agentConfig = snak.getAgentConfig();
      (agent as any).memoryAgent = null;

      expect(() => (agent as any).buildWorkflow()).toThrow(
        'MemoryAgent is not setup'
      );
    });
  });

  describe('Edge cases and limits', () => {
    it.each([
      ['0 max_graph_steps', { max_graph_steps: 0 }, 0, 'end'],
      ['1 max_graph_steps', { max_graph_steps: 1 }, 1, 'end'],
      ['high max_graph_steps', { max_graph_steps: 100 }, 50, 'validator'],
    ])(
      'shouldContinueAutonomous %s routes correctly',
      (_, configOverrides, graphStep, expectedRoute) => {
        const state = makeState({
          last_agent: Agent.TOOLS,
          currentGraphStep: graphStep,
          last_message: new ToolMessage(
            'toolA',
            'tool result',
            'test-tool-call'
          ),
        });
        const cfg = makeConfig({ configurable: configOverrides });

        const res = (agent as any).shouldContinueAutonomous(state, cfg);
        expect(res).toBe(expectedRoute);
      }
    );
  });

  describe('Integration scenarios', () => {
    it('complete autonomous workflow: plan → execute → validate → complete', async () => {
      await agent.initialize();

      const initialState = makeState({
        messages: [new HumanMessage('Create a simple plan with 2 steps')],
        plan: { steps: [], summary: '' },
        currentStepIndex: 0,
        currentGraphStep: 0,
      });

      const planState = await (agent as any).planExecution(
        initialState,
        makeConfig()
      );
      expect(planState.last_agent).toBe(Agent.PLANNER);
      expect(planState.plan.steps.length).toBeGreaterThan(0);

      const validationState = await (agent as any).validatorPlanner(planState);
      expect(validationState.last_agent).toBe(Agent.PLANNER_VALIDATOR);
      expect(validationState.currentGraphStep).toBe(
        planState.currentGraphStep + 1
      );
    });

    it('workflow with tool usage: plan → execute → tools → validate', async () => {
      await agent.initialize();

      const mockTool = {
        name: 'testTool',
        description: 'A test tool for testing',
        execute: jest.fn(async (args: any) => {
          return { result: `Tool executed with args: ${JSON.stringify(args)}` };
        }),
        handle: jest.fn(async (args: any) => {
          return { result: `Tool handled with args: ${JSON.stringify(args)}` };
        }),
      };

      const mockBoundModel = {
        invoke: jest.fn(async () => ({
          content: 'I will use the testTool',
          additional_kwargs: {},
          tool_calls: [
            {
              name: 'testTool',
              args: { param1: 'value1', param2: 'value2' },
              id: 'tool-call-1',
            },
          ],
          response_metadata: { usage: { completion_tokens: 2 } },
          toString: () => 'I will use the testTool',
        })),
      };

      const mockModelWithToolCalls = {
        withStructuredOutput() {
          return {
            invoke: jest.fn(async () => ({
              steps: [
                {
                  stepNumber: 1,
                  stepName: 'Test Step',
                  description: 'Use testTool',
                  status: 'pending',
                  type: 'tools',
                  result: '',
                },
              ],
              summary: 'Test plan',
            })),
          };
        },
        bindTools: jest.fn((tools: any[]) => {
          expect(tools).toEqual([mockTool]);
          return mockBoundModel;
        }),
        invoke: jest.fn(async () => ({
          content: 'Tool execution completed',
          additional_kwargs: {},
          response_metadata: { usage: { completion_tokens: 3 } },
        })),
      };

      const mockSelector = {
        getModels() {
          return { fast: mockModelWithToolCalls };
        },
        async selectModelForMessages() {
          return { model_name: 'fast', model: mockModelWithToolCalls };
        },
      };

      (agent as any).agentConfig = snak.getAgentConfig();
      (agent as any).toolsList = [mockTool];
      (agent as any).modelSelector = mockSelector;

      const initialState = makeState({
        messages: [new HumanMessage('Create a plan with tool usage')],
        plan: { steps: [], summary: '' },
        currentStepIndex: 0,
        currentGraphStep: 0,
      });

      const planState = await (agent as any).planExecution(
        initialState,
        makeConfig()
      );
      expect(planState.last_agent).toBe(Agent.PLANNER);
      expect(planState.plan.steps.length).toBeGreaterThan(0);

      const enrichedPlanState = {
        ...planState,
        messages: initialState.messages,
        currentStepIndex: 0,
        currentGraphStep: 0,
        retry: 0,
      };

      const executionState = await (agent as any).callModel(
        enrichedPlanState,
        makeConfig()
      );
      expect(executionState).toBeDefined();
      expect(executionState.last_message).toBeDefined();

      expect(mockModelWithToolCalls.bindTools).toHaveBeenCalledWith([mockTool]);
      expect(mockBoundModel.invoke).toHaveBeenCalled();

      expect(executionState.last_message.tool_calls).toBeDefined();
      expect(executionState.last_message.tool_calls).toHaveLength(1);
      expect(executionState.last_message.tool_calls[0].name).toBe('testTool');
      expect(executionState.last_message.tool_calls[0].args).toEqual({
        param1: 'value1',
        param2: 'value2',
      });

      expect(executionState.last_agent).toBe(Agent.EXECUTOR);

      const toolState = {
        ...executionState,
        last_message: executionState.last_message,
        currentGraphStep: executionState.currentGraphStep || 0,
      };

      const mockToolNode = {
        invoke: jest.fn(async (state: any, config: any) => {
          const toolCall = state.last_message.tool_calls?.[0];
          if (toolCall && toolCall.name === 'testTool') {
            const result = await mockTool.execute(toolCall.args);
            return {
              messages: [
                new ToolMessage(
                  toolCall.name,
                  JSON.stringify(result),
                  toolCall.id
                ),
              ],
            };
          }
          return { messages: [] };
        }),
      };

      const toolResult = await mockToolNode.invoke(toolState, makeConfig());

      expect(mockTool.execute).toHaveBeenCalledWith({
        param1: 'value1',
        param2: 'value2',
      });
      expect(mockTool.execute).toHaveBeenCalledTimes(1);

      expect(toolResult.messages).toHaveLength(1);
      expect(toolResult.messages[0]).toBeInstanceOf(ToolMessage);
      expect(toolResult.messages[0].name).toBe('testTool');
      expect(toolResult.messages[0].content).toContain(
        'Tool executed with args'
      );

      jest.clearAllMocks();
    });
  });

  describe('Failure scenario tests', () => {
    it.each([
      [
        'plan validation failure',
        'Plan validation failed: Plan is too complex',
        false,
        false,
      ],
      [
        'plan validation error',
        'Failed to validate plan: Model error occurred',
        true,
        false,
      ],
      [
        'plan execution failure',
        'Model invocation failed: Network error',
        true,
        false,
      ],
      [
        'tool execution failure',
        'Tool execution failed: Invalid parameters',
        true,
        false,
      ],
      ['max iterations reached', 'max-iter-100', false, false],
      [
        'validation routing error',
        'Routing logic error: Invalid state',
        false,
        false,
      ],
    ])(
      'handles %s correctly',
      async (_, errorMessage, hasError, isValidated) => {
        await agent.initialize();

        if (errorMessage.includes('max-iter')) {
          const mockCallModel = jest.fn(async (state: any) => ({
            last_message: { content: errorMessage, additional_kwargs: {} },
            last_agent: Agent.EXECUTOR,
            currentGraphStep: 100,
          }));
          (agent as any).callModel = mockCallModel;

          const state = makeState({ currentGraphStep: 99 });
          const res = await (agent as any).callModel(state, makeConfig());
          expect(res.currentGraphStep).toBe(100);
        } else if (errorMessage.includes('Tool execution')) {
          const mockCallModel = jest.fn(async (state: any) => ({
            messages: {
              content: errorMessage,
              additional_kwargs: {
                error: true,
                tool_error: 'Invalid parameters',
              },
            },
            last_message: {
              content: errorMessage,
              additional_kwargs: {
                error: true,
                tool_error: 'Invalid parameters',
              },
            },
            last_agent: Agent.EXECUTOR,
            currentGraphStep: state.currentGraphStep + 1,
          }));
          (agent as any).callModel = mockCallModel;

          const state = makeState();
          const res = await (agent as any).callModel(state, makeConfig());
          expect(res.last_agent).toBe(Agent.EXECUTOR);
          expect(res.last_message.additional_kwargs.error).toBe(true);
        } else if (errorMessage.includes('Model invocation failed')) {
          const mockPlanExecution = jest.fn(async () => {
            throw new Error('Model invocation failed: Network error');
          });
          (agent as any).planExecution = mockPlanExecution;

          const state = makeState();
          await expect(
            (agent as any).planExecution(state, makeConfig())
          ).rejects.toThrow('Model invocation failed: Network error');
        } else if (errorMessage.includes('Routing logic error')) {
          const mockHandleValidatorRouting = jest.fn(() => 'end');
          (agent as any).handleValidatorRouting = mockHandleValidatorRouting;

          const state = makeState({ last_agent: Agent.PLANNER_VALIDATOR });
          const res = mockHandleValidatorRouting();
          expect(res).toBe('end');
        } else {
          // Plan validation scenarios
          const mockValidatorPlanner = jest.fn(async (state: any) => ({
            last_message: {
              content: errorMessage,
              additional_kwargs: {
                error: hasError,
                validated: isValidated,
                from: 'planner_validator',
              },
            },
            last_agent: Agent.PLANNER_VALIDATOR,
            currentStepIndex: 0,
            retry: hasError ? 0 : 4,
            currentGraphStep: state.currentGraphStep + 1,
          }));
          (agent as any).validatorPlanner = mockValidatorPlanner;

          const state = makeState();
          const res = await (agent as any).validatorPlanner(state);
          expect(res.last_agent).toBe(Agent.PLANNER_VALIDATOR);
          expect(res.last_message.additional_kwargs.error).toBe(hasError);
          expect(res.last_message.additional_kwargs.validated).toBe(
            isValidated
          );
        }
      }
    );

    it('handles complete failure workflow: plan → validation error → end', async () => {
      await agent.initialize();

      const mockPlanExecution = jest.fn(async (state: any) => ({
        last_message: {
          content: 'Plan created successfully',
          additional_kwargs: {},
        },
        last_agent: Agent.PLANNER,
        plan: {
          steps: [
            {
              stepNumber: 1,
              stepName: 'Test Step',
              description: 'Test description',
              status: 'pending',
              type: 'message',
              result: '',
            },
          ],
          summary: 'Test plan',
        },
        currentStepIndex: 0,
        currentGraphStep: state.currentGraphStep + 1,
      }));

      const mockValidatorPlanner = jest.fn(async (state: any) => ({
        last_message: {
          content: 'Failed to validate plan: Critical error',
          additional_kwargs: {
            error: true,
            validated: false,
            from: 'planner_validator',
          },
        },
        last_agent: Agent.PLANNER_VALIDATOR,
        currentStepIndex: 0,
        retry: 0,
        currentGraphStep: state.currentGraphStep + 1,
      }));

      (agent as any).planExecution = mockPlanExecution;
      (agent as any).validatorPlanner = mockValidatorPlanner;

      const initialState = makeState({
        messages: [new HumanMessage('Create and validate a plan')],
        plan: { steps: [], summary: '' },
        currentStepIndex: 0,
        currentGraphStep: 0,
      });

      const planState = await (agent as any).planExecution(
        initialState,
        makeConfig()
      );
      expect(planState.last_agent).toBe(Agent.PLANNER);
      expect(planState.plan.steps.length).toBeGreaterThan(0);

      const validationState = await (agent as any).validatorPlanner(planState);
      expect(validationState.last_agent).toBe(Agent.PLANNER_VALIDATOR);
      expect(validationState.last_message.additional_kwargs.error).toBe(true);
      expect(validationState.last_message.additional_kwargs.validated).toBe(
        false
      );

      const mockHandleValidatorRouting = jest.fn((state: any) => {
        if (
          state.last_agent === Agent.PLANNER_VALIDATOR &&
          state.last_message.additional_kwargs.error === true
        ) {
          return 'end';
        }
        return 'executor';
      });

      (agent as any).handleValidatorRouting = mockHandleValidatorRouting;

      const routingResult = mockHandleValidatorRouting(validationState);
      expect(routingResult).toBe('end');
    });
  });
});
