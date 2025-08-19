import { logger, AgentMode } from '@snakagent/core';
import { ModelSelector } from '../../operators/modelSelector.js';
import { Agent } from '../types/index.js';
import { BaseMessage, AIMessageChunk, ToolMessage, HumanMessage } from '@langchain/core/messages';
import { InteractiveAgent, createInteractiveAgent } from '../interactive.js';

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
                result: '' 
              },
              { 
                stepNumber: 2, 
                stepName: 'Step 2', 
                description: 'Second step description', 
                status: 'pending', 
                result: '' 
              }
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
      getModels() { return { fast: this.model }; }
      async selectModelForMessages() { return { model_name: 'fast', model: this.model }; }
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
      addNode() { return this; }
      addEdge() { return this; }
      addConditionalEdges() { return this; }
      compile() { return { run: jest.fn() }; }
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

  return { BaseMessage, AIMessageChunk, ToolMessage, HumanMessage };
});

jest.mock('@langchain/core/prompts', () => ({
  MessagesPlaceholder: class { constructor(public _name: string) {} },
  ChatPromptTemplate: class {
    static fromMessages() { return new (require('@langchain/core/prompts').ChatPromptTemplate)(); }
    async formatMessages(vars: any) { return vars; }
  },
}));

jest.mock('../../../prompt/prompts.js', () => ({
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
    messages: result?.messages ?? [{ name: 'toolA', content: 'ok', tool_call_id: 'id-1' }],
  })),
}));

jest.mock('../../operators/memoryAgent.js', () => ({
  MemoryAgent: class {
    prepareMemoryTools() { return [{ name: 'memoryTool' }]; }
    createMemoryNode() { return jest.fn(); }
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
  formatParsedPlanSimple: (plan: any) => `plan(${(plan?.steps || []).length} steps)`,
  handleModelError: (err: any) => ({
    messages: { content: `error:${err.message}`, additional_kwargs: {} },
  }),
  isTerminalMessage: (msg: any) => String(msg?.content || '').includes('TERMINAL'),
  getLatestMessageForMessage: (messages: any[], type: any) => {
    const filtered = messages.filter(msg => msg instanceof type);
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
    fast: { provider: 'openai' as any, model_name: 'gpt-4o-mini', description: 'Fast model' },
    smart: { provider: 'openai' as any, model_name: 'gpt-4o-mini', description: 'Smart model' },
    cheap: { provider: 'openai' as any, model_name: 'gpt-4o-mini', description: 'Cheap model' },
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
  getMemoryAgent: () => new (require('../../operators/memoryAgent.js').MemoryAgent)(),
  getRagAgent: () => new (require('../../operators/ragAgent.js').RagAgent)(),
  ...overrides,
});

const makeState = (over: Partial<any> = {}) => ({
  messages: [],
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
        result: '' 
      }
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
    max_graph_steps: 15,
    short_term_memory: 15,
    memorySize: 20,
    ...(over.configurable || {}),
  },
});

describe('InteractiveAgent', () => {
  let agent: InteractiveAgent;
  let snak: any;
  let selector: ModelSelector;

  beforeEach(() => {
    snak = makeSnakAgent();
    selector = new ModelSelector(makeModelSelectorConfig());
    agent = new InteractiveAgent(snak as any, selector);
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
    it('createInteractiveAgent() uses initialize()', async () => {
      const res = await createInteractiveAgent(snak as any, selector);
      expect(res.app).toBeTruthy();
      expect(res.agent_config.prompt.content).toBe('SYS');
    });

    it('initialize() throws when getAgentConfig returns undefined', async () => {
      const invalidSnak = makeSnakAgent({ getAgentConfig: () => undefined });
      const invalidAgent = new InteractiveAgent(invalidSnak as any, selector);
      await expect(invalidAgent.initialize()).rejects.toThrow(/agent config/i);
      expect(logger.error).toHaveBeenCalled();
    });

    it('initializeMemoryAgent adds memory tools to toolsList', async () => {
      await (agent as any).initializeMemoryAgent();
      expect((agent as any).toolsList.length).toBeGreaterThan(0);
      expect((agent as any).toolsList.some((tool: any) => tool.name === 'memoryTool')).toBe(true);
    });

    it('initializeRagAgent sets ragAgent property', async () => {
      await (agent as any).initializeRagAgent();
      expect((agent as any).ragAgent).toBeTruthy();
    });
  });

  describe('Plan Execution', () => {
    beforeEach(async () => {
      await agent.initialize();
      (agent as any).agentConfig = snak.getAgentConfig();
      (agent as any).modelSelector = selector;
      (agent as any).toolsList = [{ name: 't1' }];
    });

    it.each([
      ['initial plan', Agent.PLANNER, { steps: [], summary: '' }],
      ['re-plan', Agent.PLANNER_VALIDATOR, { steps: [], summary: '' }],
    ])('%s creates plan successfully', async (_, lastAgent, plan) => {
      const state = makeState({
        messages: [new HumanMessage('hi')],
        plan,
        last_agent: lastAgent,
        last_message: lastAgent === Agent.PLANNER_VALIDATOR 
          ? new AIMessageChunk({ content: 'validator says fix', additional_kwargs: { from: Agent.PLANNER_VALIDATOR } })
          : new AIMessageChunk({ content: 'init', additional_kwargs: { from: Agent.PLANNER } }),
      });
      
      const res = await (agent as any).planExecution(state, makeConfig());
      expect(res.last_agent).toBe(Agent.PLANNER);
      expect(res.plan.steps.length).toBeGreaterThan(0);
      expect(res.currentGraphStep).toBe(state.currentGraphStep + 1);
    });

    it('planExecution handles model not found error gracefully', async () => {
      (agent as any).modelSelector = { getModels: () => ({}), selectModelForMessages: jest.fn() };
      
      const state = makeState({
        plan: { steps: [], summary: '' },
        messages: [new HumanMessage('test')],
      });
      
      const res = await (agent as any).planExecution(state, makeConfig());
      expect(res.messages.content).toContain('Failed to create plan');
      expect(res.last_agent).toBe(Agent.PLANNER);
    });

    it('planExecution uses correct system prompt for re-planning', async () => {
      const state = makeState({
        last_agent: Agent.PLANNER_VALIDATOR,
        messages: [
          new HumanMessage('test'),
          new AIMessageChunk({ content: 'validator feedback', additional_kwargs: { from: Agent.PLANNER_VALIDATOR } })
        ],
        plan: { steps: [], summary: '' },
      });
      
      const res = await (agent as any).planExecution(state, makeConfig());
      expect(res.last_agent).toBe(Agent.PLANNER);
      expect(res.plan.steps.length).toBeGreaterThan(0);
    });
  });

  describe('Validation Operations', () => {
    beforeEach(async () => {
      await agent.initialize();
      (agent as any).agentConfig = snak.getAgentConfig();
      (agent as any).modelSelector = selector;
    });

    it('validator routes PLANNER to validatorPlanner', async () => {
      const state = makeState({
        last_agent: Agent.PLANNER,
        plan: { steps: [{ stepNumber: 1, stepName: 'Test', description: 'test', status: 'pending', result: '' }], summary: 'test' },
      });
      
      const res = await (agent as any).validator(state);
      expect(res.last_agent).toBe(Agent.PLANNER_VALIDATOR);
      expect(res.currentGraphStep).toBe(state.currentGraphStep + 1);
    });

    it('validator routes EXECUTOR to validatorExecutor', async () => {
      const state = makeState({
        last_agent: Agent.EXECUTOR,
        plan: { steps: [{ stepNumber: 1, stepName: 'Test', description: 'test', status: 'pending', result: '' }], summary: 'test' },
      });
      
      const res = await (agent as any).validator(state);
      expect(res.last_agent).toBe(Agent.EXEC_VALIDATOR);
      expect(res.currentGraphStep).toBe(state.currentGraphStep + 1);
    });

    it('validatorPlanner validates plan successfully', async () => {
      const state = makeState({
        last_agent: Agent.PLANNER,
        plan: { steps: [{ stepNumber: 1, stepName: 'Test', description: 'test', status: 'pending', result: '' }], summary: 'test' },
        messages: [new HumanMessage('test')],
      });
      
      const res = await (agent as any).validatorPlanner(state);
      expect(res.last_agent).toBe(Agent.PLANNER_VALIDATOR);
      expect(res.currentGraphStep).toBe(state.currentGraphStep + 1);
      expect(res.retry).toBe(state.retry);
    });

    it('validatorPlanner handles validation failure', async () => {
      const mockModel = {
        withStructuredOutput: () => ({
          invoke: jest.fn(async () => ({
            isValidated: false,
            description: 'Plan is not feasible',
          })),
        }),
      };
      (agent as any).modelSelector = { getModels: () => ({ fast: mockModel }), selectModelForMessages: jest.fn() };
      
      const state = makeState({
        last_agent: Agent.PLANNER,
        plan: { steps: [{ stepNumber: 1, stepName: 'Test', description: 'test', status: 'pending', result: '' }], summary: 'test' },
        messages: [new HumanMessage('test')],
      });
      
      const res = await (agent as any).validatorPlanner(state);
      expect(res.last_agent).toBe(Agent.PLANNER_VALIDATOR);
      expect(res.retry).toBe(state.retry + 1);
    });

    it('validatorExecutor validates step successfully', async () => {
      const state = makeState({
        last_agent: Agent.EXECUTOR,
        last_message: new AIMessageChunk({ content: 'Step completed', additional_kwargs: {} }),
        plan: { steps: [{ stepNumber: 1, stepName: 'Test', description: 'test', status: 'pending', result: '' }], summary: 'test' },
        messages: [new HumanMessage('test'), new AIMessageChunk({ content: 'Step completed', additional_kwargs: {} })],
      });
      
      const res = await (agent as any).validatorExecutor(state);
      expect(res.last_agent).toBe(Agent.EXEC_VALIDATOR);
      expect(res.currentGraphStep).toBe(state.currentGraphStep + 1);
      expect(res.currentStepIndex).toBe(state.currentStepIndex);
    });

    it('validatorExecutor handles final step correctly', async () => {
      const mockModel = {
        withStructuredOutput: () => ({
          invoke: jest.fn(async () => ({
            validated: true,
            reason: 'step validated',
            isFinal: true,
          })),
        }),
      };
      (agent as any).modelSelector = { getModels: () => ({ fast: mockModel }), selectModelForMessages: jest.fn() };
      
      const state = makeState({
        last_agent: Agent.EXECUTOR,
        last_message: new AIMessageChunk({ content: 'Step completed', additional_kwargs: {} }),
        plan: { steps: [{ stepNumber: 1, stepName: 'Test', description: 'test', status: 'pending', result: '' }], summary: 'test' },
        currentStepIndex: 0,
        messages: [new HumanMessage('test'), new AIMessageChunk({ content: 'Step completed', additional_kwargs: {} })],
      });
      
      const res = await (agent as any).validatorExecutor(state);
      expect(res.last_agent).toBe(Agent.EXEC_VALIDATOR);
      expect(res.currentStepIndex).toBe(1);
    });

    it('validators handle model not found error gracefully', async () => {
      (agent as any).modelSelector = { getModels: () => ({}), selectModelForMessages: jest.fn() };
      
      const state = makeState({
        last_agent: Agent.PLANNER,
        plan: { steps: [{ stepNumber: 1, stepName: 'Test', description: 'test', status: 'pending', result: '' }], summary: 'test' },
        messages: [new HumanMessage('test')],
      });
      
      const res = await (agent as any).validatorPlanner(state);
      expect(res.messages.content).toContain('Failed to validate plan');
      expect(res.last_agent).toBe(Agent.PLANNER_VALIDATOR);
    });
  });

  describe('Executor Operations', () => {
    beforeEach(async () => {
      await agent.initialize();
      (agent as any).agentConfig = snak.getAgentConfig();
      (agent as any).modelSelector = selector;
      (agent as any).toolsList = [{ name: 't' }];
    });

    it.each([
      ['max_graph_steps limit', 15, 15, 'max-iter-15'],
      ['max_graph_steps exact', 14, 14, 'max-iter-14'],
    ])('%s returns correct response', async (_, currentStep, maxSteps, expectedContent) => {
      const state = makeState({ currentGraphStep: currentStep });
      const cfg = makeConfig({ configurable: { max_graph_steps: maxSteps } });
      
      const res = await (agent as any).callModel(state, cfg);
      expect(res.last_message.content).toContain(expectedContent);
      expect(res.last_agent).toBe(Agent.EXECUTOR);
    });

    it('callModel processes step successfully', async () => {
      const state = makeState({
        plan: {
          steps: [{ stepNumber: 1, stepName: 'Test Step', description: 'Test description', status: 'pending', result: '' }],
          summary: 'Test plan',
        },
        currentStepIndex: 0,
        messages: [new HumanMessage('test')],
      });
      
      const res = await (agent as any).callModel(state, makeConfig());
      expect(res.last_agent).toBe(Agent.EXECUTOR);
      expect(res.currentGraphStep).toBe(state.currentGraphStep + 1);
    });

    it('callModel handles model not found error gracefully', async () => {
      (agent as any).modelSelector = { getModels: () => ({}), selectModelForMessages: jest.fn() };
      
      const res = await (agent as any).callModel(makeState(), makeConfig());
      expect(res.messages.content).toContain('error:');
      expect(res.messages).toBeDefined();
    });
  });

  describe('Tool Operations', () => {
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
      
      const res = await (agent as any).toolNodeInvoke(state, undefined, toolNode.invoke.bind(toolNode));
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
        last_message: new AIMessageChunk({ content: 'x', tool_calls: [{ name: 'toolA', args: {} }] }),
      });
      
      await expect((agent as any).toolNodeInvoke(state, undefined, originalInvoke)).rejects.toThrow('boom');
    });
  });

  describe('Routing Logic', () => {
    it.each([
      ['terminal message', { content: '...TERMINAL...' }, 'end'],
      ['tool calls', { tool_calls: [{ name: 'toolA', args: {} }] }, 'tools'],
      ['default case', {}, 'validator'],
    ])('shouldContinue %s -> %s', (_, messageProps, expectedRoute) => {
      const state = makeState({
        last_agent: Agent.EXECUTOR,
        messages: [new HumanMessage('test'), new AIMessageChunk({ content: 'test', ...messageProps })],
      });
      
      const next = (agent as any).shouldContinue(state, makeConfig());
      expect(next).toBe(expectedRoute);
    });

    it.each([
      ['PLANNER_VALIDATOR validated', Agent.PLANNER_VALIDATOR, { validated: true, error: false }, 'executor'],
      ['PLANNER_VALIDATOR error', Agent.PLANNER_VALIDATOR, { error: true }, 'end'],
      ['PLANNER_VALIDATOR failed validation', Agent.PLANNER_VALIDATOR, { validated: false }, 're_planner', 1],
      ['PLANNER_VALIDATOR max retries', Agent.PLANNER_VALIDATOR, { validated: false }, 'end', 4],
      ['EXEC_VALIDATOR final', Agent.EXEC_VALIDATOR, { isFinal: true }, 'end'],
      ['EXEC_VALIDATOR max retries', Agent.EXEC_VALIDATOR, {}, 'end', 3],
      ['EXEC_VALIDATOR continue', Agent.EXEC_VALIDATOR, { isFinal: false }, 'executor', 1],
    ])('handleValidatorRouting %s -> %s', (_, agentType, kwargs, expectedRoute, retry = 0) => {
      const state = makeState({
        last_agent: agentType,
        messages: [
          new HumanMessage('test'), 
          new AIMessageChunk({ 
            content: 'test', 
            additional_kwargs: { 
              from: agentType === Agent.PLANNER_VALIDATOR ? 'planner_validator' : 'exec_validator', 
              ...kwargs 
            } 
          })
        ],
        retry,
      });
      
      const route = (agent as any).handleValidatorRouting(state);
      expect(route).toBe(expectedRoute);
    });

    it('handleToolMessageRouting routes to validator by default', () => {
      const messages = [
        new HumanMessage('test'),
        new AIMessageChunk({ content: 'ai response', additional_kwargs: {} }),
        new ToolMessage('toolA', 'tool result', 'call-1'),
      ];
      
      const route = (agent as any).handleToolMessageRouting(messages, makeConfig());
      expect(route).toBe('validator');
    });

    it('handleToolMessageRouting routes to end when max iterations reached', () => {
      const toolMessage = new ToolMessage('toolA', 'tool result', 'call-1');
      toolMessage.additional_kwargs = { graph_step: 15 };
      
      const messages = [
        new HumanMessage('test'),
        new AIMessageChunk({ content: 'ai response', additional_kwargs: {} }),
        toolMessage,
      ];
      
      const route = (agent as any).handleToolMessageRouting(messages, makeConfig({ configurable: { max_graph_steps: 15 } }));
      expect(route).toBe('end');
    });
  });

  describe('System Prompt Building', () => {
    it('buildSystemPrompt includes agent config and step rules', async () => {
      await agent.initialize();
      (agent as any).agentConfig = snak.getAgentConfig();
      
      const prompt = (agent as any).buildSystemPrompt(makeState());
      expect(prompt).toContain('SYS');
      expect(prompt).toContain('STEP_RULES');
    });
  });

  describe('Model Invocation', () => {
    beforeEach(async () => {
      await agent.initialize();
      (agent as any).agentConfig = snak.getAgentConfig();
      (agent as any).modelSelector = selector;
      (agent as any).toolsList = [{ name: 'toolA' }];
    });

    it('invokeModelWithMessages processes messages correctly', async () => {
      const state = makeState({
        plan: {
          steps: [{ stepNumber: 1, stepName: 'Test', description: 'Test description', status: 'pending', result: '' }],
          summary: 'Test plan',
        },
        currentStepIndex: 0,
        messages: [new HumanMessage('test')],
      });
      
      const filteredMessages = [new HumanMessage('test')];
      const systemPrompt = 'Test system prompt';
      
      const result = await (agent as any).invokeModelWithMessages(state, filteredMessages, systemPrompt);
      expect(result.additional_kwargs.from).toBe(Agent.EXECUTOR);
      expect(result.additional_kwargs.final).toBe(false);
      expect(result.additional_kwargs.error).toBe(false);
    });

    it('invokeModelWithMessages handles model selection correctly', async () => {
      const state = makeState({
        plan: {
          steps: [{ stepNumber: 1, stepName: 'Test', description: 'Test description', status: 'pending', result: '' }],
          summary: 'Test plan',
        },
        currentStepIndex: 0,
        messages: [new HumanMessage('test')],
      });
      
      const filteredMessages = [new HumanMessage('test')];
      const systemPrompt = 'Test system prompt';
      
      const result = await (agent as any).invokeModelWithMessages(state, filteredMessages, systemPrompt);
      expect(result).toBeDefined();
    });
  });

  describe('Configuration and Compilation', () => {
    it.each([
      ['memory enabled', true, { checkpointer: expect.any(Object), configurable: {} }],
      ['memory disabled', false, {}],
    ])('getCompileOptions %s returns correct options', (_, memoryEnabled, expectedOptions) => {
      (agent as any).agentConfig = { ...snak.getAgentConfig(), memory: memoryEnabled };
      
      const options = (agent as any).getCompileOptions();
      expect(options).toEqual(expectedOptions);
    });

    it('buildWorkflow creates StateGraph with all required nodes', () => {
      (agent as any).agentConfig = snak.getAgentConfig();
      (agent as any).memoryAgent = snak.getMemoryAgent();
      
      const workflow = (agent as any).buildWorkflow();
      expect(workflow).toBeTruthy();
      expect(typeof workflow.addNode).toBe('function');
      expect(typeof workflow.addEdge).toBe('function');
      expect(typeof workflow.compile).toBe('function');
    });
  });

  describe('End Graph Operations', () => {
    it('endGraph resets plan, index and retry', () => {
      const res = (agent as any).endGraph({});
      expect(res.plan.steps).toEqual([]);
      expect(res.currentStepIndex).toBe(0);
      expect(res.retry).toBe(0);
    });
  });

  describe('Edge Cases and Limits', () => {
    it.each([
      ['0 max_graph_steps', { max_graph_steps: 0 }, 0, 'end'],
      ['1 max_graph_steps', { max_graph_steps: 1 }, 1, 'end'],
      ['high max_graph_steps', { max_graph_steps: 100 }, 50, 'validator'],
    ])('shouldContinue %s routes correctly', (_, configOverrides, graphStep, expectedRoute) => {
      const toolMessage = new ToolMessage('toolA', 'tool result', 'test-tool-call');
      toolMessage.additional_kwargs = { graph_step: graphStep };
      
      const state = makeState({ 
        last_agent: Agent.TOOLS, 
        currentGraphStep: graphStep,
        messages: [new HumanMessage('test'), new AIMessageChunk({ content: 'ai response', additional_kwargs: {} }), toolMessage]
      });
      const cfg = makeConfig({ configurable: configOverrides });
      
      const res = (agent as any).shouldContinue(state, cfg);
      expect(res).toBe(expectedRoute);
    });

    it('handleValidatorRouting handles unknown agent state gracefully', () => {
      const state = makeState({
        last_agent: 'unknown_agent' as any,
        last_message: new AIMessageChunk({ content: 'test', additional_kwargs: {} }),
      });
      
      const route = (agent as any).handleValidatorRouting(state);
      expect(route).toBe('end');
    });
  });

  describe('Integration Scenarios', () => {
    it('should complete interactive workflow: plan → validate → execute → complete', async () => {
      await agent.initialize();
      
      const initialState = makeState({
        messages: [new HumanMessage('Create a simple plan with 2 steps')],
        plan: { steps: [], summary: '' },
        currentStepIndex: 0,
        currentGraphStep: 0,
      });
      
      const planState = await (agent as any).planExecution(initialState, makeConfig());
      expect(planState.last_agent).toBe(Agent.PLANNER);
      expect(planState.plan.steps.length).toBeGreaterThan(0);
      
      const validationState = await (agent as any).validatorPlanner(planState);
      expect(validationState.last_agent).toBe(Agent.PLANNER_VALIDATOR);
      expect(validationState.currentGraphStep).toBe(planState.currentGraphStep + 1);
    });
    it('workflow with tool usage: plan → validate → execute → tools → validate', async () => {
      await agent.initialize();
      
      const initialState = makeState({
        messages: [new HumanMessage('Create a plan with tool usage')],
        plan: { steps: [], summary: '' },
        currentStepIndex: 0,
        currentGraphStep: 0,
      });
      
      (agent as any).agentConfig = snak.getAgentConfig();
      (agent as any).toolsList = [{ name: 'toolA' }];
      (agent as any).modelSelector = selector;
      
      const executionState = await (agent as any).callModel(initialState, makeConfig());
      expect(executionState).toBeDefined();
      expect(executionState.messages).toBeDefined();
    });
    it('re-planning workflow: validation failure → re-plan → re-validate', async () => {
      await agent.initialize();
      
      const mockModel = {
        withStructuredOutput: () => ({
          invoke: jest.fn(async (input: any) => {
            if (input && Array.isArray(input)) {
              return { isValidated: false, description: 'Plan needs improvement' };
            }
            return {
              steps: [{ stepNumber: 1, stepName: 'Improved Step', description: 'Better description', status: 'pending', result: '' }],
              summary: 'Improved plan',
            };
          }),
        }),
      };
      (agent as any).modelSelector = { getModels: () => ({ fast: mockModel }), selectModelForMessages: jest.fn() };
      (agent as any).toolsList = [{ name: 't1' }];
      
      const initialState = makeState({
        messages: [new HumanMessage('Create a plan')],
        plan: { steps: [], summary: '' },
        currentStepIndex: 0,
        currentGraphStep: 0,
        retry: 0,
      });
      
      const planState = await (agent as any).planExecution(initialState, makeConfig());
      expect(planState.last_agent).toBe(Agent.PLANNER);
      
      const stateWithRetry = { ...planState, retry: 0 };
      const validationState = await (agent as any).validatorPlanner(stateWithRetry);
      expect(validationState.last_agent).toBe(Agent.PLANNER_VALIDATOR);
      expect(validationState.retry).toBe(1);
    });
  });
});
