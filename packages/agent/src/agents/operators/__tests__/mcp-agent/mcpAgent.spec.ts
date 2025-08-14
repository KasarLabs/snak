import { MCPAgent, MCPAgentConfig } from '../../mcp-agent/mcpAgent.js';
import { BaseMessage, AIMessage, HumanMessage } from '@langchain/core/messages';
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
    { name: 'search_mcp_server', description: 'Search for MCP servers', schema: {}, func: jest.fn() },
    { name: 'add_mcp_server', description: 'Add an MCP server', schema: {}, func: jest.fn() },
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

  // Helpers
  const setupAgent = () => {
    const agent = new MCPAgent();
    mockModelSelector.getInstance.mockReturnValue({ getModels: mockGetModels });
    mockCreateReactAgent.mockReturnValue(mockReactAgent);
    return { agent, reactAgentInvoke: mockReactAgent.invoke };
  };

  const human = (content: string, ak?: any) => {
    const msg = new HumanMessage(content);
    if (ak) msg.additional_kwargs = ak;
    return msg;
  };

  const ai = (content: string) => new AIMessage({ content });

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = require('@snakagent/core').logger;
    mockModelSelector = require('../../modelSelector.js').ModelSelector;
    mockCreateReactAgent = require('@langchain/langgraph/prebuilt').createReactAgent;
    mockReactAgent = { invoke: jest.fn() };
  });

  describe('constructor', () => {
    it('should create with default values', () => {
      const agent = new MCPAgent();
      expect(agent.id).toBe('mcp-agent');
      expect(agent.type).toBe(AgentType.OPERATOR);
      expect(agent.description).toContain('managing MCP (Model Context Protocol) servers');
    });

    it('should not log debug when debug:false', () => {
      new MCPAgent({ debug: false });
      expect(mockLogger.debug).not.toHaveBeenCalled();
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
      const agent = new MCPAgent();
      mockModelSelector.getInstance.mockReturnValue(null);

      await expect(agent.init()).rejects.toThrow(
        'MCPAgent initialization failed: Error: ModelSelector is not initialized'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('MCPAgent initialization failed')
      );
    });
  });

  describe('execute', () => {
    it.each([
      ['string input', 'test input'],
      ['HumanMessage', human('test input')],
      ['BaseMessage array', [human('test input')]],
    ])('should execute with %s', async (_, input) => {
      const { agent, reactAgentInvoke } = setupAgent();
      await agent.init();
      
      reactAgentInvoke.mockResolvedValue({
        messages: [ai('success')],
      });

      const result = await agent.execute(input);

      expect(reactAgentInvoke).toHaveBeenCalledWith({
        messages: [human('test input')],
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
      
      reactAgentInvoke.mockResolvedValue({ messages: [ai('done')] });

      await agent.execute('some input', false, { originalUserQuery: 'config query' });

      expect(reactAgentInvoke).toHaveBeenCalledWith({
        messages: [human('config query')],
      });
    });

    it('should prioritize originalUserQuery from additional_kwargs', async () => {
      const { agent, reactAgentInvoke } = setupAgent();
      await agent.init();
      
      const message = human('some content', { originalUserQuery: 'kwargs query' });
      reactAgentInvoke.mockResolvedValue({ messages: [ai('done')] });

      await agent.execute(message);

      expect(reactAgentInvoke).toHaveBeenCalledWith({
        messages: [human('kwargs query')],
      });
    });

    it('should return error when agent not initialized', async () => {
      const agent = new MCPAgent();
      const result = await agent.execute('test');

      expect(result).toBeInstanceOf(AIMessage);
      expect(result.content).toContain('MCP operation failed: React agent not initialized');
      expect(result.additional_kwargs.success).toBe(false);
    });

    it('should handle invoke rejection', async () => {
      const { agent, reactAgentInvoke } = setupAgent();
      await agent.init();
      reactAgentInvoke.mockRejectedValue(new Error('Execution failed'));

      const result = await agent.execute('test');

      expect(result.additional_kwargs.success).toBe(false);
      expect(result.additional_kwargs.error).toBe('Execution failed');
    });

    it.each([
      ['empty messages', { messages: [] }],
      ['empty content', { messages: [ai('')] }],
    ])('should handle %s', async (_, response) => {
      const { agent, reactAgentInvoke } = setupAgent();
      await agent.init();
      reactAgentInvoke.mockResolvedValue(response);

      const result = await agent.execute('test');

      expect(result.content).toBe('MCP operation completed.');
      expect(result.additional_kwargs.success).toBe(true);
    });

    it('should convert non-string content to string', async () => {
      const { agent, reactAgentInvoke } = setupAgent();
      await agent.init();
      reactAgentInvoke.mockResolvedValue({ messages: [ai('done')] });

      // Create a message with non-string content
      const message = new HumanMessage({ content: 123 } as any);
      await agent.execute(message);

      expect(reactAgentInvoke).toHaveBeenCalledWith({
        messages: [human('123')],
      });
    });
  });

  describe('getTools', () => {
    it('should return tools array', () => {
      const agent = new MCPAgent();
      const tools = agent.getTools();
      expect(tools).toHaveLength(2);
    });
  });

  describe('dispose', () => {
    it('should unregister and log debug', async () => {
      const agent = new MCPAgent();
      await agent.dispose();

      expect(mockUnregister).toHaveBeenCalledWith('mcp-agent');
      expect(mockLogger.debug).toHaveBeenCalledWith('MCPAgent disposed and unregistered');
    });

    it('should log error on unregister failure', async () => {
      const agent = new MCPAgent();
      mockUnregister.mockImplementation(() => {
        throw new Error('Unregister failed');
      });

      await agent.dispose();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error disposing MCPAgent')
      );
    });
  });
});
