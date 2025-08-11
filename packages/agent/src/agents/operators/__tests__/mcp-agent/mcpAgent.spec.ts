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
  fast: {
    invoke: jest.fn(),
  },
  smart: {
    invoke: jest.fn(),
  },
  cheap: {
    invoke: jest.fn(),
  },
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
      description: 'Search for MCP servers on Smithery',
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
  createReactAgent: jest.fn(() => ({
    invoke: jest.fn(),
  })),
}));

// Mock the system prompt
jest.mock('../../../../prompt/mcpAgentPrompts.js', () => ({
  mcpAgentSystemPrompt: jest.fn(() => 'test system prompt'),
}));

describe('MCPAgent', () => {
  let agent: MCPAgent;
  let mockLogger: {
    debug: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
    info: jest.Mock;
  };
  let mockModelSelector: {
    getInstance: jest.Mock;
  };
  let mockCreateReactAgent: jest.Mock;
  let mockReactAgent: {
    invoke: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = require('@snakagent/core').logger;
    mockModelSelector = require('../../modelSelector.js').ModelSelector;
    mockCreateReactAgent =
      require('@langchain/langgraph/prebuilt').createReactAgent;

    mockReactAgent = {
      invoke: jest.fn(),
    };
    mockCreateReactAgent.mockReturnValue(mockReactAgent);

    // Reset mock functions
    mockRegister.mockClear();
    mockUnregister.mockClear();
    mockGetModels.mockClear();
  });

  afterEach(() => {
    // Clean up remaining timers
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create an MCPAgent with default config', () => {
      agent = new MCPAgent();

      expect(agent.id).toBe('mcp-agent');
      expect(agent.type).toBe(AgentType.OPERATOR);
      expect(agent.description).toContain(
        'managing MCP (Model Context Protocol) servers'
      );
    });

    it('should create an MCPAgent with custom config', () => {
      const config: MCPAgentConfig = {
        debug: false,
        modelType: 'smart',
      };

      agent = new MCPAgent(config);

      expect(agent.id).toBe('mcp-agent');
      expect(agent.type).toBe(AgentType.OPERATOR);
    });

    it('should initialize with correct debug setting', () => {
      agent = new MCPAgent({ debug: false });
      expect(mockLogger.debug).not.toHaveBeenCalled();

      agent = new MCPAgent({ debug: true });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('MCPAgent initialized with')
      );
    });

    it('should initialize with correct model type', () => {
      agent = new MCPAgent({ modelType: 'smart' });
    });
  });

  describe('init', () => {
    beforeEach(() => {
      agent = new MCPAgent();
    });

    it('should initialize successfully with default config', async () => {
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

    it('should initialize with custom model type', async () => {
      agent = new MCPAgent({ modelType: 'smart' });
      await agent.init();

      expect(mockCreateReactAgent).toHaveBeenCalledWith({
        llm: expect.any(Object),
        tools: expect.any(Array),
        stateModifier: 'test system prompt',
      });
    });

    it('should throw error if ModelSelector is not initialized', async () => {
      mockModelSelector.getInstance.mockReturnValue(null);

      await expect(agent.init()).rejects.toThrow(
        'MCPAgent initialization failed: Error: ModelSelector is not initialized'
      );
    });

    it('should handle initialization errors', async () => {
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
    beforeEach(async () => {
      agent = new MCPAgent();
      mockModelSelector.getInstance.mockReturnValue({
        getModels: mockGetModels,
      });
      await agent.init();
    });

    it('should execute with string input successfully', async () => {
      const mockResponse = {
        messages: [new AIMessage({ content: 'MCP server added successfully' })],
      };
      mockReactAgent.invoke.mockResolvedValue(mockResponse);

      const result = await agent.execute('Add a new MCP server');

      expect(mockReactAgent.invoke).toHaveBeenCalledWith({
        messages: [new HumanMessage('Add a new MCP server')],
      });
      expect(result).toBeInstanceOf(AIMessage);
      expect(result.content).toBe('MCP server added successfully');
      expect(result.additional_kwargs).toEqual({
        from: 'mcp-agent',
        final: true,
        success: true,
      });
    });

    it('should execute with BaseMessage input successfully', async () => {
      const mockResponse = {
        messages: [
          new AIMessage({ content: 'MCP server updated successfully' }),
        ],
      };
      mockReactAgent.invoke.mockResolvedValue(mockResponse);

      const input = new HumanMessage('Update MCP server test-server');
      const result = await agent.execute(input);

      expect(mockReactAgent.invoke).toHaveBeenCalledWith({
        messages: [new HumanMessage('Update MCP server test-server')],
      });
      expect(result.content).toBe('MCP server updated successfully');
    });

    it('should execute with message array input successfully', async () => {
      const mockResponse = {
        messages: [
          new AIMessage({ content: 'MCP servers listed successfully' }),
        ],
      };
      mockReactAgent.invoke.mockResolvedValue(mockResponse);

      const input = [new HumanMessage('List all MCP servers')];
      const result = await agent.execute(input);

      expect(mockReactAgent.invoke).toHaveBeenCalledWith({
        messages: [new HumanMessage('List all MCP servers')],
      });
      expect(result.content).toBe('MCP servers listed successfully');
    });

    it('should use originalUserQuery from config when provided', async () => {
      const mockResponse = {
        messages: [new AIMessage({ content: 'Operation completed' })],
      };
      mockReactAgent.invoke.mockResolvedValue(mockResponse);

      const result = await agent.execute('some input', false, {
        originalUserQuery: 'Add a new MCP server',
      });

      expect(mockReactAgent.invoke).toHaveBeenCalledWith({
        messages: [new HumanMessage('Add a new MCP server')],
      });
    });

    it('should use originalUserQuery from message additional_kwargs', async () => {
      const mockResponse = {
        messages: [new AIMessage({ content: 'Operation completed' })],
      };
      mockReactAgent.invoke.mockResolvedValue(mockResponse);

      const input = new HumanMessage('some content');
      input.additional_kwargs = { originalUserQuery: 'Remove MCP server test' };

      const result = await agent.execute(input);

      expect(mockReactAgent.invoke).toHaveBeenCalledWith({
        messages: [new HumanMessage('Remove MCP server test')],
      });
      expect(result.content).toBe('Operation completed');
    });

    it('should handle error when React agent is not initialized', async () => {
      agent = new MCPAgent();

      const result = await agent.execute('test');

      expect(result).toBeInstanceOf(AIMessage);
      expect(result.content).toContain(
        'MCP operation failed: React agent not initialized'
      );
      expect(result.additional_kwargs).toEqual({
        from: 'mcp-agent',
        final: true,
        success: false,
        error: 'React agent not initialized. Call init() first.',
      });
    });

    it('should handle execution errors gracefully', async () => {
      mockReactAgent.invoke.mockRejectedValue(new Error('Execution failed'));

      const result = await agent.execute('test input');

      expect(result).toBeInstanceOf(AIMessage);
      expect(result.content).toContain(
        'MCP operation failed: Execution failed'
      );
      expect(result.additional_kwargs).toEqual({
        from: 'mcp-agent',
        final: true,
        success: false,
        error: 'Execution failed',
      });
    });

    it('should handle empty response messages', async () => {
      mockReactAgent.invoke.mockResolvedValue({ messages: [] });

      const result = await agent.execute('test');

      expect(result).toBeInstanceOf(AIMessage);
      expect(result.content).toBe('MCP operation completed.');
      expect(result.additional_kwargs).toEqual({
        from: 'mcp-agent',
        final: true,
        success: true,
      });
    });

    it('should handle response with no content', async () => {
      mockReactAgent.invoke.mockResolvedValue({
        messages: [new AIMessage({ content: '' })],
      });

      const result = await agent.execute('test');

      expect(result).toBeInstanceOf(AIMessage);
      expect(result.content).toBe('MCP operation completed.');
      expect(result.additional_kwargs).toEqual({
        from: 'mcp-agent',
        final: true,
        success: true,
      });
    });
  });

  describe('getTools', () => {
    it('should return the tools array', () => {
      agent = new MCPAgent();
      const tools = agent.getTools();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(2); // Based on our mock
    });
  });

  describe('dispose', () => {
    it('should dispose and unregister successfully', async () => {
      agent = new MCPAgent();

      await agent.dispose();

      expect(mockUnregister).toHaveBeenCalledWith('mcp-agent');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'MCPAgent disposed and unregistered'
      );
    });

    it('should handle disposal errors gracefully', async () => {
      agent = new MCPAgent();
      mockUnregister.mockImplementation(() => {
        throw new Error('Unregister failed');
      });

      await agent.dispose();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error disposing MCPAgent')
      );
    });
  });

  describe('content extraction', () => {
    beforeEach(async () => {
      agent = new MCPAgent();
      mockModelSelector.getInstance.mockReturnValue({
        getModels: mockGetModels,
      });
      await agent.init();
    });

    it('should extract content from complex message structure', async () => {
      const mockResponse = {
        messages: [new AIMessage({ content: 'Extracted content' })],
      };
      mockReactAgent.invoke.mockResolvedValue(mockResponse);

      const input = [
        new HumanMessage('first message'),
        new AIMessage('second message'),
        new HumanMessage('third message'),
      ];

      const result = await agent.execute(input);

      expect(mockReactAgent.invoke).toHaveBeenCalledWith({
        messages: [new HumanMessage('first message')],
      });
    });

    it('should handle non-string content in messages', async () => {
      const mockResponse = {
        messages: [new AIMessage({ content: 'Handled non-string' })],
      };
      mockReactAgent.invoke.mockResolvedValue(mockResponse);
      // Create a message with non-string content
      const input = new HumanMessage({ content: 123 } as any);

      const result = await agent.execute(input);

      expect(mockReactAgent.invoke).toHaveBeenCalledWith({
        messages: [new HumanMessage('123')],
      });
    });
  });
});
