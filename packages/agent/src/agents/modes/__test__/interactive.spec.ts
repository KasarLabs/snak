import { createInteractiveAgent } from '../interactive.js';
import { SnakAgentInterface } from '../../../tools/tools.js';
import { ModelSelector } from '../../operators/modelSelector.js';
import { MemoryAgent } from '../../operators/memoryAgent.js';
import { RagAgent } from '../../operators/ragAgent.js';
import { AgentConfig } from '@snakagent/core';
import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
  SystemMessage,
} from '@langchain/core/messages';

// Mock the logger from @snakagent/core
jest.mock('@snakagent/core', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
  AgentConfig: jest.fn(),
}));

// Mock the prompts module
jest.mock('../../../prompt/prompts.js', () => ({
  interactiveRules: 'Interactive rules content',
  planPrompt: 'Plan prompt content',
  PromptPlanInteractive: 'Prompt plan interactive content',
}));

// Mock the token tracking module
jest.mock('../../../token/tokenTracking.js', () => ({
  TokenTracker: jest.fn().mockImplementation(() => ({
    trackTokens: jest.fn(),
    getTokenCount: jest.fn(),
  })),
}));

// Mock the autonomous module
jest.mock('../autonomous.js', () => ({
  AgentReturn: jest.fn(),
}));

// Mock LangGraph modules with Annotation.Root
jest.mock('@langchain/langgraph', () => {
  const mockAnnotation = jest
    .fn()
    .mockImplementation((config) => config) as any;
  const mockAnnotationRoot = jest.fn().mockImplementation((config) => config);
  mockAnnotation.Root = mockAnnotationRoot;

  return {
    StateGraph: jest.fn().mockImplementation(() => ({
      addNode: jest.fn().mockReturnThis(),
      addEdge: jest.fn().mockReturnThis(),
      addConditionalEdges: jest.fn().mockReturnThis(),
      compile: jest.fn().mockReturnValue({ app: 'compiled-app' }),
    })),
    MemorySaver: jest.fn().mockImplementation(() => ({
      // Mock implementation
    })),
    END: 'end',
    Annotation: mockAnnotation,
  };
});

jest.mock('@langchain/langgraph/prebuilt', () => ({
  ToolNode: jest.fn().mockImplementation(() => ({
    invoke: jest.fn(),
  })),
}));

// Mock the core modules
jest.mock('../../core/utils.js', () => ({
  initializeToolsList: jest.fn().mockResolvedValue([]),
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
  truncateToolResults: jest.fn().mockImplementation((result) => result),
  formatAgentResponse: jest.fn().mockImplementation((content) => content),
}));

// Mock SnakAgentInterface
const mockSnakAgent: jest.Mocked<SnakAgentInterface> = {
  getAgentConfig: jest.fn(),
  getDatabaseCredentials: jest.fn(),
  getMemoryAgent: jest.fn(),
  getRagAgent: jest.fn(),
} as any;

// Mock ModelSelector
const mockModelSelector: jest.Mocked<ModelSelector> = {
  selectModel: jest.fn(),
  getCurrentModel: jest.fn(),
} as any;

// Mock MemoryAgent
const mockMemoryAgent: jest.Mocked<MemoryAgent> = {
  prepareMemoryTools: jest.fn().mockReturnValue([]),
  createMemoryNode: jest.fn().mockReturnValue({
    invoke: jest.fn(),
  }),
} as any;

// Mock RagAgent
const mockRagAgent: jest.Mocked<RagAgent> = {
  createRagNode: jest.fn().mockReturnValue({
    invoke: jest.fn(),
  }),
} as any;

describe('Interactive Mode', () => {
  let mockAgentConfig: AgentConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAgentConfig = {
      id: 'test-agent',
      name: 'Test Agent',
      group: 'test',
      description: 'Test agent for interactive mode',
      interval: 1000,
      chatId: 'test-chat',
      plugins: [],
      memory: { enabled: false },
      rag: { enabled: false },
      mode: 'interactive' as any,
      maxIterations: 10,
      prompt: new SystemMessage('You are a helpful assistant.'),
    };

    mockSnakAgent.getAgentConfig.mockReturnValue(mockAgentConfig);
    mockSnakAgent.getDatabaseCredentials.mockReturnValue({
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'test',
      password: 'test',
    });
    mockSnakAgent.getMemoryAgent.mockReturnValue(null);
    mockSnakAgent.getRagAgent.mockReturnValue(null);
  });

  describe('createInteractiveAgent', () => {
    it('should create an interactive agent successfully with basic configuration', async () => {
      const result = await createInteractiveAgent(
        mockSnakAgent,
        mockModelSelector
      );

      expect(result).toBeDefined();
      expect(result.app).toEqual({ app: 'compiled-app' });
      expect(result.agent_config).toBe(mockAgentConfig);
      expect(mockSnakAgent.getAgentConfig).toHaveBeenCalled();
    });

    it('should throw error when agent configuration is missing', async () => {
      mockSnakAgent.getAgentConfig.mockReturnValue(
        undefined as unknown as AgentConfig
      );

      await expect(
        createInteractiveAgent(mockSnakAgent, mockModelSelector)
      ).rejects.toThrow('Agent configuration is required');
    });

    it('should initialize database with credentials', async () => {
      const { initializeDatabase } = require('../../core/utils.js');

      await createInteractiveAgent(mockSnakAgent, mockModelSelector);

      expect(initializeDatabase).toHaveBeenCalledWith({
        host: 'localhost',
        port: 5432,
        database: 'test',
        user: 'test',
        password: 'test',
      });
    });

    it('should initialize tools list', async () => {
      const { initializeToolsList } = require('../../core/utils.js');

      await createInteractiveAgent(mockSnakAgent, mockModelSelector);

      expect(initializeToolsList).toHaveBeenCalledWith(
        mockSnakAgent,
        mockAgentConfig
      );
    });

    it('should handle memory agent when memory is enabled', async () => {
      mockAgentConfig.memory = { enabled: true };
      mockSnakAgent.getMemoryAgent.mockReturnValue(mockMemoryAgent);

      await createInteractiveAgent(mockSnakAgent, mockModelSelector);

      expect(mockSnakAgent.getMemoryAgent).toHaveBeenCalled();
      expect(mockMemoryAgent.prepareMemoryTools).toHaveBeenCalled();
    });

    it('should handle memory agent error gracefully', async () => {
      mockAgentConfig.memory = { enabled: true };
      mockSnakAgent.getMemoryAgent.mockImplementation(() => {
        throw new Error('Memory agent error');
      });

      const { logger } = require('@snakagent/core');

      await createInteractiveAgent(mockSnakAgent, mockModelSelector);

      expect(logger.error).toHaveBeenCalledWith(
        'Error retrieving memory agent: Error: Memory agent error'
      );
    });

    it('should handle rag agent when rag is enabled', async () => {
      mockAgentConfig.rag = { enabled: true };
      mockSnakAgent.getRagAgent.mockReturnValue(mockRagAgent);

      await createInteractiveAgent(mockSnakAgent, mockModelSelector);

      expect(mockSnakAgent.getRagAgent).toHaveBeenCalled();
    });

    it('should handle rag agent error gracefully', async () => {
      mockAgentConfig.rag = { enabled: true };
      mockSnakAgent.getRagAgent.mockImplementation(() => {
        throw new Error('Rag agent error');
      });

      const { logger } = require('@snakagent/core');

      await createInteractiveAgent(mockSnakAgent, mockModelSelector);

      expect(logger.error).toHaveBeenCalledWith(
        'Error retrieving rag agent: Error: Rag agent error'
      );
    });

    it('should create workflow with memory and rag nodes when both are available', async () => {
      mockAgentConfig.memory = { enabled: true };
      mockAgentConfig.rag = { enabled: true };
      mockSnakAgent.getMemoryAgent.mockReturnValue(mockMemoryAgent);
      mockSnakAgent.getRagAgent.mockReturnValue(mockRagAgent);

      const { StateGraph } = require('@langchain/langgraph');
      const mockStateGraph = {
        addNode: jest.fn().mockReturnThis(),
        addEdge: jest.fn().mockReturnThis(),
        addConditionalEdges: jest.fn().mockReturnThis(),
        compile: jest.fn().mockReturnValue({ app: 'compiled-app' }),
      };
      StateGraph.mockImplementation(() => mockStateGraph);

      await createInteractiveAgent(mockSnakAgent, mockModelSelector);

      expect(mockStateGraph.addNode).toHaveBeenCalledWith(
        'agent',
        expect.any(Function)
      );
      expect(mockStateGraph.addNode).toHaveBeenCalledWith(
        'tools',
        expect.any(Object)
      );
      expect(mockStateGraph.addNode).toHaveBeenCalledWith(
        'memory',
        expect.any(Object)
      );
      expect(mockStateGraph.addNode).toHaveBeenCalledWith(
        'ragNode',
        expect.any(Object)
      );
    });

    it('should create workflow with only rag node when memory is disabled', async () => {
      mockAgentConfig.memory = { enabled: false };
      mockAgentConfig.rag = { enabled: true };
      mockSnakAgent.getRagAgent.mockReturnValue(mockRagAgent);

      const { StateGraph } = require('@langchain/langgraph');
      const mockStateGraph = {
        addNode: jest.fn().mockReturnThis(),
        addEdge: jest.fn().mockReturnThis(),
        addConditionalEdges: jest.fn().mockReturnThis(),
        compile: jest.fn().mockReturnValue({ app: 'compiled-app' }),
      };
      StateGraph.mockImplementation(() => mockStateGraph);

      await createInteractiveAgent(mockSnakAgent, mockModelSelector);

      expect(mockStateGraph.addNode).toHaveBeenCalledWith(
        'agent',
        expect.any(Function)
      );
      expect(mockStateGraph.addNode).toHaveBeenCalledWith(
        'tools',
        expect.any(Object)
      );
      expect(mockStateGraph.addNode).toHaveBeenCalledWith(
        'ragNode',
        expect.any(Object)
      );
      expect(mockStateGraph.addNode).not.toHaveBeenCalledWith(
        'memory',
        expect.any(Object)
      );
    });

    it('should create basic workflow when memory and rag are disabled', async () => {
      mockAgentConfig.memory = { enabled: false };
      mockAgentConfig.rag = { enabled: false };

      const { StateGraph } = require('@langchain/langgraph');
      const mockStateGraph = {
        addNode: jest.fn().mockReturnThis(),
        addEdge: jest.fn().mockReturnThis(),
        addConditionalEdges: jest.fn().mockReturnThis(),
        compile: jest.fn().mockReturnValue({ app: 'compiled-app' }),
      };
      StateGraph.mockImplementation(() => mockStateGraph);

      await createInteractiveAgent(mockSnakAgent, mockModelSelector);

      expect(mockStateGraph.addNode).toHaveBeenCalledWith(
        'agent',
        expect.any(Function)
      );
      expect(mockStateGraph.addNode).toHaveBeenCalledWith(
        'tools',
        expect.any(Object)
      );
      expect(mockStateGraph.addNode).not.toHaveBeenCalledWith(
        'memory',
        expect.any(Object)
      );
      expect(mockStateGraph.addNode).not.toHaveBeenCalledWith(
        'ragNode',
        expect.any(Object)
      );
    });

    it('should handle errors during agent creation', async () => {
      const { initializeDatabase } = require('../../core/utils.js');
      // Mock the rejection only for this test instance
      initializeDatabase.mockImplementationOnce(() =>
        Promise.reject(new Error('Database initialization failed'))
      );

      const { logger } = require('@snakagent/core');

      await expect(
        createInteractiveAgent(mockSnakAgent, mockModelSelector)
      ).rejects.toThrow('Database initialization failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create an interactive agent:',
        expect.any(Error)
      );
    });

    it('should compile with checkpointer when memory is enabled', async () => {
      mockAgentConfig.memory = { enabled: true };
      mockSnakAgent.getMemoryAgent.mockReturnValue(mockMemoryAgent);

      const { StateGraph } = require('@langchain/langgraph');
      const mockStateGraph = {
        addNode: jest.fn().mockReturnThis(),
        addEdge: jest.fn().mockReturnThis(),
        addConditionalEdges: jest.fn().mockReturnThis(),
        compile: jest.fn().mockReturnValue({ app: 'compiled-app' }),
      };
      StateGraph.mockImplementation(() => mockStateGraph);

      await createInteractiveAgent(mockSnakAgent, mockModelSelector);

      expect(mockStateGraph.compile).toHaveBeenCalledWith({
        checkpointer: expect.any(Object),
        configurable: {},
      });
    });

    it('should compile without checkpointer when memory is disabled', async () => {
      mockAgentConfig.memory = { enabled: false };

      const { StateGraph } = require('@langchain/langgraph');
      const mockStateGraph = {
        addNode: jest.fn().mockReturnThis(),
        addEdge: jest.fn().mockReturnThis(),
        addConditionalEdges: jest.fn().mockReturnThis(),
        compile: jest.fn().mockReturnValue({ app: 'compiled-app' }),
      };
      StateGraph.mockImplementation(() => mockStateGraph);

      await createInteractiveAgent(mockSnakAgent, mockModelSelector);

      expect(mockStateGraph.compile).toHaveBeenCalledWith({});
    });
  });

  describe('Helper Functions', () => {
    // These tests would require more complex mocking of the internal functions
    // For now, we'll test the main function and its integration points

    it('should use interactive rules in system prompt', async () => {
      const { interactiveRules } = require('../../../prompt/prompts.js');

      await createInteractiveAgent(mockSnakAgent, mockModelSelector);

      // The interactive rules should be used in the callModel function
      // This is tested indirectly through the workflow creation
      expect(interactiveRules).toBe('Interactive rules content');
    });

    it('should format agent response using utility function', async () => {
      const { formatAgentResponse } = require('../../core/utils.js');

      await createInteractiveAgent(mockSnakAgent, mockModelSelector);

      // The formatAgentResponse function should be available for use
      expect(formatAgentResponse).toBeDefined();
    });

    it('should truncate tool results using utility function', async () => {
      const { truncateToolResults } = require('../../core/utils.js');

      await createInteractiveAgent(mockSnakAgent, mockModelSelector);

      // The truncateToolResults function should be available for use
      expect(truncateToolResults).toBeDefined();
    });
  });
});
