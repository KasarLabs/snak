import { MCPAgent, MCPAgentConfig } from '../../mcp-agent/mcpAgent.js';
import {
  BaseMessage,
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { AgentType } from '../../../core/baseAgent.js';

// Mock the logger from @snakagent/core
jest.mock('@snakagent/core', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the operator registry
const mockRegister = jest.fn();
const mockUnregister = jest.fn();
jest.mock('../../operatorRegistry.js', () => ({
  OperatorRegistry: {
    getInstance: jest.fn(() => ({
      register: mockRegister,
      unregister: mockUnregister,
    })),
  },
}));

// Mock the model selector
const mockGetModels = jest.fn(() => ({
  fast: { invoke: jest.fn() },
  smart: { invoke: jest.fn() },
  cheap: { invoke: jest.fn() },
}));
jest.mock('../../modelSelector.js', () => ({
  ModelSelector: {
    getInstance: jest.fn(() => ({
      getModels: mockGetModels,
    })),
  },
}));

// Mock the MCP agent tools
jest.mock('../../mcp-agent/mcpAgentTools.js', () => ({
  getMcpAgentTools: jest.fn(() => [
    {
      name: 'search_mcp_server',
      description: 'Search for MCP servers',
      schema: {},
      func: jest.fn(),
    },
    {
      name: 'add_mcp_server',
      description: 'Add an MCP server',
      schema: {},
      func: jest.fn(),
    },
  ]),
}));

// Mock the React agent creation
jest.mock('@langchain/langgraph/prebuilt', () => ({
  createReactAgent: jest.fn(() => ({ invoke: jest.fn() })),
}));

// Mock the system prompt
jest.mock('../../../../prompt/mcpAgentPrompts.js', () => ({
  mcpAgentSystemPrompt: jest.fn(() => 'test system prompt'),
}));

describe('MCPAgent', () => {
  let mockLogger: any;
  let mockModelSelector: any;
  let mockCreateReactAgent: any;
  let mockReactAgent: any;

  // Factory functions
  const makeAgent = (config: MCPAgentConfig = {}) => new MCPAgent(config);

  const makeHumanMessage = (content: string, additionalKwargs?: any) => {
    const msg = new HumanMessage(content);
    if (additionalKwargs) msg.additional_kwargs = additionalKwargs;
    return msg;
  };

  const makeAIMessage = (content: string) => new AIMessage({ content });
  const makeSystemMessage = (content: string) => new SystemMessage({ content });

  const setupAgent = () => {
    const agent = makeAgent();
    mockModelSelector.getInstance.mockReturnValue({ getModels: mockGetModels });
    mockCreateReactAgent.mockReturnValue(mockReactAgent);
    return { agent, reactAgentInvoke: mockReactAgent.invoke };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = require('@snakagent/core').logger;
    mockModelSelector = require('../../modelSelector.js').ModelSelector;
    mockCreateReactAgent =
      require('@langchain/langgraph/prebuilt').createReactAgent;
    mockReactAgent = { invoke: jest.fn() };
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create with default values', () => {
      const agent = makeAgent();
      expect(agent.id).toBe('mcp-agent');
      expect(agent.type).toBe(AgentType.OPERATOR);
      expect(agent.description).toContain(
        'managing MCP (Model Context Protocol) servers'
      );
    });

    it.each([
      [false, false],
      [true, true],
      [undefined, true],
    ])(
      'should set debug to %s when config.debug is %s',
      (configValue, expected) => {
        const agent = makeAgent({ debug: configValue });
        if (expected) {
          expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('MCPAgent initialized with 2 tools')
          );
        } else {
          expect(mockLogger.debug).not.toHaveBeenCalled();
        }
      }
    );

    it('should create with custom model type', () => {
      const agent = makeAgent({ modelType: 'fast' });
      expect(agent).toBeInstanceOf(MCPAgent);
    });
  });

  describe('init', () => {
    it('should initialize successfully', async () => {
      const { agent } = setupAgent();
      await agent.init();

      expect(mockModelSelector.getInstance).toHaveBeenCalled();
      expect(mockCreateReactAgent).toHaveBeenCalledWith({
        llm: expect.any(Object),
        tools: expect.any(Array),
        stateModifier: 'test system prompt',
      });
      expect(mockRegister).toHaveBeenCalledWith('mcp-agent', agent);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'MCPAgent initialized with React agent and registered successfully'
      );
    });

    it('should throw error if ModelSelector.getInstance returns null', async () => {
      const agent = makeAgent();
      mockModelSelector.getInstance.mockReturnValue(null);

      await expect(agent.init()).rejects.toThrow(
        'MCPAgent initialization failed: Error: ModelSelector is not initialized'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('MCPAgent initialization failed')
      );
    });

    it('should initialize with custom model type', async () => {
      const agent = makeAgent({ modelType: 'cheap' });
      mockModelSelector.getInstance.mockReturnValue({
        getModels: () => ({ cheap: { invoke: jest.fn() } }),
      });
      mockCreateReactAgent.mockReturnValue(mockReactAgent);

      await agent.init();
      expect(mockCreateReactAgent).toHaveBeenCalledWith({
        llm: expect.any(Object),
        tools: expect.any(Array),
        stateModifier: 'test system prompt',
      });
    });
  });

  describe('execute', () => {
    it.each([
      ['string input', 'test input'],
      ['HumanMessage', makeHumanMessage('test input')],
      ['BaseMessage array', [makeHumanMessage('test input')]],
    ])('should execute with %s', async (_, input) => {
      const { agent, reactAgentInvoke } = setupAgent();
      await agent.init();

      reactAgentInvoke.mockResolvedValue({
        messages: [makeAIMessage('success')],
      });

      const result = await agent.execute(input);

      expect(reactAgentInvoke).toHaveBeenCalledWith({
        messages: [makeHumanMessage('test input')],
      });
      expect(result).toBeInstanceOf(AIMessage);
      expect(result.content).toBe('success');
      expect(result.additional_kwargs).toEqual({
        from: 'mcp-agent',
        final: true,
        success: true,
      });
    });

    it('should prioritize originalUserQuery from config', async () => {
      const { agent, reactAgentInvoke } = setupAgent();
      await agent.init();

      reactAgentInvoke.mockResolvedValue({ messages: [makeAIMessage('done')] });

      await agent.execute('some input', false, {
        originalUserQuery: 'config query',
      });

      expect(reactAgentInvoke).toHaveBeenCalledWith({
        messages: [makeHumanMessage('config query')],
      });
    });

    it('should prioritize originalUserQuery from message additional_kwargs', async () => {
      const { agent, reactAgentInvoke } = setupAgent();
      await agent.init();

      const message = makeHumanMessage('some content', {
        originalUserQuery: 'kwargs query',
      });
      reactAgentInvoke.mockResolvedValue({ messages: [makeAIMessage('done')] });

      await agent.execute(message);

      expect(reactAgentInvoke).toHaveBeenCalledWith({
        messages: [makeHumanMessage('kwargs query')],
      });
    });

    it('should return error when agent not initialized', async () => {
      const agent = makeAgent();
      const result = await agent.execute('test');

      expect(result).toBeInstanceOf(AIMessage);
      expect(result.content).toContain(
        'MCP operation failed: React agent not initialized'
      );
      expect(result.additional_kwargs.success).toBe(false);
    });

    it.each([
      ['invoke rejection', new Error('Execution failed')],
      ['non-Error object', 'String error'],
    ])('should handle %s', async (_, error) => {
      const { agent, reactAgentInvoke } = setupAgent();
      await agent.init();
      reactAgentInvoke.mockRejectedValue(error);

      const result = await agent.execute('test');

      expect(result.additional_kwargs.success).toBe(false);
      expect(result.additional_kwargs.error).toBe(
        error instanceof Error ? error.message : String(error)
      );
    });

    it.each([
      ['empty messages', { messages: [] }],
      ['empty content', { messages: [makeAIMessage('')] }],
    ])('should handle %s', async (_, response) => {
      const { agent, reactAgentInvoke } = setupAgent();
      await agent.init();
      reactAgentInvoke.mockResolvedValue(response);

      const result = await agent.execute('test');

      expect(result.content).toBe('MCP operation completed.');
      expect(result.additional_kwargs.success).toBe(true);
    });

    it.each([
      ['non-string content in message', 123, '123'],
      ['complex object content', { nested: 'object' }, '{"nested":"object"}'],
    ])('should convert %s to string', async (_, content, expected) => {
      const { agent, reactAgentInvoke } = setupAgent();
      await agent.init();
      reactAgentInvoke.mockResolvedValue({ messages: [makeAIMessage('done')] });

      const message = new HumanMessage({ content } as any);
      await agent.execute(message);

      expect(reactAgentInvoke).toHaveBeenCalledWith({
        messages: [makeHumanMessage(expected)],
      });
    });

    it.each([
      [
        'array with originalUserQuery in additional_kwargs',
        [
          makeSystemMessage('system'),
          makeHumanMessage('some content', {
            originalUserQuery: 'priority query',
          }),
          makeAIMessage('ai response'),
        ],
        'priority query',
      ],
      [
        'array with first HumanMessage fallback',
        [
          makeSystemMessage('system'),
          makeHumanMessage('first human message'),
          makeAIMessage('ai response'),
        ],
        'first human message',
      ],
      [
        'array with last message content fallback',
        [
          makeSystemMessage('system'),
          makeAIMessage('ai response with content'),
        ],
        'ai response with content',
      ],
    ])('should handle %s', async (_, messages, expected) => {
      const { agent, reactAgentInvoke } = setupAgent();
      await agent.init();

      reactAgentInvoke.mockResolvedValue({ messages: [makeAIMessage('done')] });

      await agent.execute(messages);

      expect(reactAgentInvoke).toHaveBeenCalledWith({
        messages: [makeHumanMessage(expected)],
      });
    });

    it.each([
      [
        'single message with originalUserQuery',
        makeHumanMessage('some content', {
          originalUserQuery: 'single message query',
        }),
        'single message query',
      ],
      [
        'single message without originalUserQuery',
        makeHumanMessage('single message content'),
        'single message content',
      ],
    ])('should handle %s', async (_, message, expected) => {
      const { agent, reactAgentInvoke } = setupAgent();
      await agent.init();

      reactAgentInvoke.mockResolvedValue({ messages: [makeAIMessage('done')] });

      await agent.execute(message);

      expect(reactAgentInvoke).toHaveBeenCalledWith({
        messages: [makeHumanMessage(expected)],
      });
    });

    it('should handle string input directly', async () => {
      const { agent, reactAgentInvoke } = setupAgent();
      await agent.init();

      reactAgentInvoke.mockResolvedValue({ messages: [makeAIMessage('done')] });

      await agent.execute('direct string input');

      expect(reactAgentInvoke).toHaveBeenCalledWith({
        messages: [makeHumanMessage('direct string input')],
      });
    });

    it('should handle complex object input by throwing error', async () => {
      const { agent } = setupAgent();
      await agent.init();

      const complexInput = { type: 'complex', data: 'test' };

      const result = await agent.execute(complexInput as any);

      expect(result.additional_kwargs.success).toBe(false);
      expect(result.content).toContain('MCP operation failed');
    });

    it.each([
      [
        'array with non-string content in last message',
        [
          makeSystemMessage('system'),
          makeAIMessage('second message'),
          makeAIMessage({ content: { last: 'object' } } as any),
        ],
        '{"content":{"last":"object"}}',
      ],
      [
        'single message with non-string content',
        makeHumanMessage({ content: { nested: 'object' } } as any),
        '{"nested":"object"}',
      ],
    ])(
      'should test extractContent method for %s',
      async (_, input, expected) => {
        const { agent, reactAgentInvoke } = setupAgent();
        await agent.init();

        reactAgentInvoke.mockResolvedValue({
          messages: [makeAIMessage('done')],
        });

        await agent.execute(input);

        expect(reactAgentInvoke).toHaveBeenCalledWith({
          messages: [makeHumanMessage(expected)],
        });
      }
    );

    it('should handle debug logging when enabled', async () => {
      const { agent, reactAgentInvoke } = setupAgent();
      await agent.init();
      reactAgentInvoke.mockResolvedValue({ messages: [makeAIMessage('done')] });

      await agent.execute('test with debug');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'MCPAgent: Processing request: "test with debug"'
      );
    });
  });

  describe('getTools', () => {
    it('should return tools array with correct structure', () => {
      const agent = makeAgent();
      const tools = agent.getTools();

      expect(tools).toHaveLength(2);
      tools.forEach((tool) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('schema');
        expect(tool).toHaveProperty('func');
        expect(typeof tool.func).toBe('function');
      });
    });
  });

  describe('dispose', () => {
    it('should unregister and log debug', async () => {
      const agent = makeAgent();
      await agent.dispose();

      expect(mockUnregister).toHaveBeenCalledWith('mcp-agent');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'MCPAgent disposed and unregistered'
      );
    });

    it('should log error on unregister failure', async () => {
      const agent = makeAgent();
      mockUnregister.mockImplementation(() => {
        throw new Error('Unregister failed');
      });

      await agent.dispose();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error disposing MCPAgent')
      );
    });

    it('should handle dispose without throwing', async () => {
      const agent = makeAgent();
      mockUnregister.mockImplementation(() => {
        throw new Error('Registry error');
      });

      await expect(agent.dispose()).resolves.toBeUndefined();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty array input gracefully', async () => {
      const { agent } = setupAgent();
      await agent.init();

      const result = await agent.execute([]);

      expect(result.additional_kwargs.success).toBe(false);
      expect(result.content).toContain('MCP operation failed');
    });

    it('should handle array with only non-HumanMessage types', async () => {
      const { agent, reactAgentInvoke } = setupAgent();
      await agent.init();

      const messages = [
        makeSystemMessage('system'),
        makeAIMessage('ai message'),
      ];
      reactAgentInvoke.mockResolvedValue({ messages: [makeAIMessage('done')] });

      await agent.execute(messages);

      expect(reactAgentInvoke).toHaveBeenCalledWith({
        messages: [makeHumanMessage('ai message')],
      });
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
    ])(
      'should handle message with %s content in additional_kwargs',
      async (_, value) => {
        const { agent, reactAgentInvoke } = setupAgent();
        await agent.init();

        const message = makeHumanMessage('some content', {
          originalUserQuery: value,
        });
        reactAgentInvoke.mockResolvedValue({
          messages: [makeAIMessage('done')],
        });

        await agent.execute(message);

        expect(reactAgentInvoke).toHaveBeenCalledWith({
          messages: [makeHumanMessage('some content')],
        });
      }
    );
  });
});
