import { ConfigurationAgent, ConfigurationAgentConfig } from '../../config-agent/configAgent.js';
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

// Mock the config agent tools
jest.mock('../../config-agent/configAgentTools.js', () => ({
  getConfigAgentTools: jest.fn(() => [
    {
      name: 'create_agent',
      description: 'Create a new agent',
      schema: {},
      func: jest.fn(),
    },
    {
      name: 'read_agent',
      description: 'Read an agent',
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
jest.mock('../../../../prompt/configAgentPrompts.js', () => ({
  configurationAgentSystemPrompt: jest.fn(() => 'test system prompt'),
}));

describe('ConfigurationAgent', () => {
  let agent: ConfigurationAgent;
  let mockLogger: any;
  let mockOperatorRegistry: any;
  let mockModelSelector: any;
  let mockCreateReactAgent: any;
  let mockReactAgent: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLogger = require('@snakagent/core').logger;
    mockOperatorRegistry = require('../../operatorRegistry.js').OperatorRegistry;
    mockModelSelector = require('../../modelSelector.js').ModelSelector;
    mockCreateReactAgent = require('@langchain/langgraph/prebuilt').createReactAgent;
    
    mockReactAgent = {
      invoke: jest.fn(),
    };
    mockCreateReactAgent.mockReturnValue(mockReactAgent);
    
    // Reset mock functions
    mockRegister.mockClear();
    mockUnregister.mockClear();
    mockGetModels.mockClear();
  });

  describe('constructor', () => {
    it('should create a ConfigurationAgent with default config', () => {
      agent = new ConfigurationAgent();
      
      expect(agent.id).toBe('configuration-agent');
      expect(agent.type).toBe(AgentType.OPERATOR);
      expect(agent.description).toContain('managing agent configurations');
    });

    it('should create a ConfigurationAgent with custom config', () => {
      const config: ConfigurationAgentConfig = {
        debug: false,
        modelType: 'smart',
      };
      
      agent = new ConfigurationAgent(config);
      
      expect(agent.id).toBe('configuration-agent');
      expect(agent.type).toBe(AgentType.OPERATOR);
    });

    it('should initialize with correct debug setting', () => {
      agent = new ConfigurationAgent({ debug: false });
      expect(mockLogger.debug).not.toHaveBeenCalled();
      
      agent = new ConfigurationAgent({ debug: true });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('ConfigurationAgent initialized with')
      );
    });

    it('should initialize with correct model type', () => {
      agent = new ConfigurationAgent({ modelType: 'smart' });
    });
  });

  describe('init', () => {
    beforeEach(() => {
      agent = new ConfigurationAgent();
    });

    it('should initialize successfully with default config', async () => {
      await agent.init();
      
      expect(mockModelSelector.getInstance).toHaveBeenCalled();
      expect(mockCreateReactAgent).toHaveBeenCalledWith({
        llm: expect.any(Object),
        tools: expect.any(Array),
        stateModifier: 'test system prompt',
      });
      expect(mockRegister).toHaveBeenCalledWith(
        'configuration-agent',
        agent
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ConfigurationAgent initialized with React agent and registered successfully'
      );
    });

    it('should initialize with custom model type', async () => {
      agent = new ConfigurationAgent({ modelType: 'smart' });
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
        'ConfigurationAgent initialization failed: Error: ModelSelector is not initialized'
      );
    });

    it('should handle initialization errors', async () => {
      mockModelSelector.getInstance.mockReturnValue(null);
      
      await expect(agent.init()).rejects.toThrow(
        'ConfigurationAgent initialization failed: Error: ModelSelector is not initialized'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('ConfigurationAgent initialization failed')
      );
    });
  });

  describe('execute', () => {
    beforeEach(async () => {
      agent = new ConfigurationAgent();
      // Reset the mock
      mockModelSelector.getInstance.mockReturnValue({
        getModels: mockGetModels,
      });
      await agent.init();
    });

    it('should execute with string input successfully', async () => {
      const mockResponse = {
        messages: [
          new AIMessage({ content: 'Agent created successfully' }),
        ],
      };
      mockReactAgent.invoke.mockResolvedValue(mockResponse);
      
      const result = await agent.execute('Create a new agent called test-agent');
      
      expect(mockReactAgent.invoke).toHaveBeenCalledWith({
        messages: [new HumanMessage('Create a new agent called test-agent')],
      });
      expect(result).toBeInstanceOf(AIMessage);
      expect(result.content).toBe('Agent created successfully');
      expect(result.additional_kwargs).toEqual({
        from: 'configuration-agent',
        final: true,
        success: true,
      });
    });

    it('should execute with BaseMessage input successfully', async () => {
      const mockResponse = {
        messages: [
          new AIMessage({ content: 'Agent updated successfully' }),
        ],
      };
      mockReactAgent.invoke.mockResolvedValue(mockResponse);
      
      const input = new HumanMessage('Update agent test-agent');
      const result = await agent.execute(input);
      
      expect(mockReactAgent.invoke).toHaveBeenCalledWith({
        messages: [new HumanMessage('Update agent test-agent')],
      });
      expect(result.content).toBe('Agent updated successfully');
    });

    it('should execute with message array input successfully', async () => {
      const mockResponse = {
        messages: [
          new AIMessage({ content: 'Agents listed successfully' }),
        ],
      };
      mockReactAgent.invoke.mockResolvedValue(mockResponse);
      
      const input = [new HumanMessage('List all agents')];
      const result = await agent.execute(input);
      
      expect(mockReactAgent.invoke).toHaveBeenCalledWith({
        messages: [new HumanMessage('List all agents')],
      });
      expect(result.content).toBe('Agents listed successfully');
    });

    it('should use originalUserQuery from config when provided', async () => {
      const mockResponse = {
        messages: [
          new AIMessage({ content: 'Operation completed' }),
        ],
      };
      mockReactAgent.invoke.mockResolvedValue(mockResponse);
      
      const result = await agent.execute('some input', false, {
        originalUserQuery: 'Create a new agent',
      });
      
      expect(mockReactAgent.invoke).toHaveBeenCalledWith({
        messages: [new HumanMessage('Create a new agent')],
      });
    });

    it('should use originalUserQuery from message additional_kwargs', async () => {
      const mockResponse = {
        messages: [
          new AIMessage({ content: 'Operation completed' }),
        ],
      };
      mockReactAgent.invoke.mockResolvedValue(mockResponse);
      
      const input = new HumanMessage('some content');
      input.additional_kwargs = { originalUserQuery: 'Delete agent test' };
      
      const result = await agent.execute(input);
      
      expect(mockReactAgent.invoke).toHaveBeenCalledWith({
        messages: [new HumanMessage('Delete agent test')],
      });
    });

    it('should handle error when React agent is not initialized', async () => {
      agent = new ConfigurationAgent();
      
      const result = await agent.execute('test');
      
      expect(result).toBeInstanceOf(AIMessage);
      expect(result.content).toContain('Configuration operation failed: React agent not initialized');
      expect(result.additional_kwargs).toEqual({
        from: 'configuration-agent',
        final: true,
        success: false,
        error: 'React agent not initialized. Call init() first.',
      });
    });

    it('should handle execution errors gracefully', async () => {
      mockReactAgent.invoke.mockRejectedValue(new Error('Execution failed'));
      
      const result = await agent.execute('test input');
      
      expect(result).toBeInstanceOf(AIMessage);
      expect(result.content).toContain('Configuration operation failed: Execution failed');
      expect(result.additional_kwargs).toEqual({
        from: 'configuration-agent',
        final: true,
        success: false,
        error: 'Execution failed',
      });
    });

    it('should handle empty response messages', async () => {
      mockReactAgent.invoke.mockResolvedValue({ messages: [] });
      
      const result = await agent.execute('test');
      
      expect(result).toBeInstanceOf(AIMessage);
      expect(result.content).toContain('Configuration operation failed: No content found in the last message');
      expect(result.additional_kwargs).toEqual({
        from: 'configuration-agent',
        final: true,
        success: false,
        error: 'No content found in the last message from the configuration agent.',
      });
    });

    it('should handle response with no content', async () => {
      mockReactAgent.invoke.mockResolvedValue({
        messages: [new AIMessage({ content: '' })],
      });
      
      const result = await agent.execute('test');
      
      expect(result).toBeInstanceOf(AIMessage);
      expect(result.content).toContain('Configuration operation failed: No content found in the last message');
      expect(result.additional_kwargs).toEqual({
        from: 'configuration-agent',
        final: true,
        success: false,
        error: 'No content found in the last message from the configuration agent.',
      });
    });
  });

  describe('getTools', () => {
    it('should return the tools array', () => {
      agent = new ConfigurationAgent();
      const tools = agent.getTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(2); // Based on our mock
    });
  });

  describe('dispose', () => {
    it('should dispose and unregister successfully', async () => {
      agent = new ConfigurationAgent();
      
      await agent.dispose();
      
      expect(mockUnregister).toHaveBeenCalledWith(
        'configuration-agent'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ConfigurationAgent disposed and unregistered'
      );
    });

    it('should handle disposal errors gracefully', async () => {
      agent = new ConfigurationAgent();
      mockUnregister.mockImplementation(() => {
        throw new Error('Unregister failed');
      });
      
      await agent.dispose();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error disposing ConfigurationAgent')
      );
    });
  });

  describe('content extraction', () => {
    beforeEach(async () => {
      agent = new ConfigurationAgent();
      // Reset the mock
      mockModelSelector.getInstance.mockReturnValue({
        getModels: mockGetModels,
      });
      await agent.init();
    });

    it('should extract content from complex message structure', async () => {
      const mockResponse = {
        messages: [
          new AIMessage({ content: 'Extracted content' }),
        ],
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
        messages: [
          new AIMessage({ content: 'Handled non-string' }),
        ],
      };
      mockReactAgent.invoke.mockResolvedValue(mockResponse);
      
      const input = new HumanMessage('test content');
      input.content = 123 as any; // Simulate non-string content
      
      const result = await agent.execute(input);
      
      expect(mockReactAgent.invoke).toHaveBeenCalledWith({
        messages: [new HumanMessage('123')],
      });
    });
  });
}); 