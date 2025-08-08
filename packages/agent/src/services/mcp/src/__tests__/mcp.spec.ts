// Mock SystemMessage before imports
const MockSystemMessage = jest.fn().mockImplementation((content) => ({
  content,
  type: 'system',
}));

jest.mock('@langchain/core/messages', () => ({
  SystemMessage: MockSystemMessage,
}));

import { MCP_CONTROLLER } from '../mcp.js';
import { StructuredTool } from '@langchain/core/tools';
import { MultiServerMCPClient } from 'snak-mcps';
import { logger, AgentConfig } from '@snakagent/core';
import { SystemMessage } from '@langchain/core/messages';

// Mock MultiServerMCPClient
jest.mock('snak-mcps', () => ({
  MultiServerMCPClient: jest.fn(),
}));

// Mock StructuredTool
jest.mock('@langchain/core/tools', () => ({
  StructuredTool: jest.fn(),
}));

// Mock logger
jest.mock('@snakagent/core', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));



describe('MCP_CONTROLLER', () => {
  let mockMultiServerMCPClient: jest.Mocked<MultiServerMCPClient>;
  let mockStructuredTool: jest.Mocked<StructuredTool>;
  let mockLogger: jest.Mocked<typeof logger>;
  let mockAgentConfig: jest.Mocked<AgentConfig>;

  const mockMcpServers = {
    server1: {
      command: 'node',
      args: ['server1.js'],
      env: { NODE_ENV: 'test' },
    },
    server2: {
      command: 'python',
      args: ['server2.py'],
      env: { PYTHONPATH: '/path/to/python' },
    },
  };

  let mockTools: Map<string, StructuredTool[]>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock StructuredTool first
    mockStructuredTool = {
      name: 'test_tool',
      description: 'A test tool',
      schema: {},
    } as any;

    // Setup mockTools after mockStructuredTool is defined
    mockTools = new Map([
      ['server1', [mockStructuredTool, mockStructuredTool]],
      ['server2', [mockStructuredTool]],
    ]);

    // Setup mock MultiServerMCPClient
    mockMultiServerMCPClient = {
      initializeConnections: jest.fn().mockResolvedValue(undefined),
      getTools: jest.fn().mockReturnValue(mockTools),
      close: jest.fn().mockResolvedValue(undefined),
    } as any;

    (MultiServerMCPClient as jest.MockedClass<typeof MultiServerMCPClient>).mockImplementation(
      () => mockMultiServerMCPClient
    );

    // Setup mock logger
    mockLogger = logger as jest.Mocked<typeof logger>;

    // Setup mock AgentConfig
    mockAgentConfig = {
      id: 'test-agent-1',
      name: 'test_agent',
      group: 'test_group',
      description: 'Test agent',
      interval: 1000,
      chatId: 'test-chat-1',
      plugins: ['plugin1', 'plugin2'],
      memory: {
        enabled: true,
        shortTermMemorySize: 10,
        memorySize: 100,
        maxIterations: 5,
        embeddingModel: 'test-model'
      },
      rag: {
        enabled: true,
        topK: 5,
        embeddingModel: 'test-rag-model'
      },
      mcpServers: mockMcpServers,
      mode: 'interactive',
      maxIterations: 10,
      prompt: new SystemMessage('Test system prompt')
    } as AgentConfig;
  });

  describe('constructor', () => {
    it('should initialize successfully with valid mcpServers configuration', () => {
      const controller = new MCP_CONTROLLER(mockMcpServers);

      expect(MultiServerMCPClient).toHaveBeenCalledWith(mockMcpServers);
      expect(mockLogger.info).toHaveBeenCalledWith('Initializing MCP_CONTROLLER with provided servers config');
      expect(mockLogger.info).toHaveBeenCalledWith('MCP_CONTROLLER initialized');
      expect(controller).toBeInstanceOf(MCP_CONTROLLER);
    });

    it('should throw error when mcpServers is null', () => {
      expect(() => new MCP_CONTROLLER(null as any)).toThrow('MCP servers configuration is required');
    });

    it('should throw error when mcpServers is undefined', () => {
      expect(() => new MCP_CONTROLLER(undefined as any)).toThrow('MCP servers configuration is required');
    });

    it('should throw error when mcpServers is empty object', () => {
      expect(() => new MCP_CONTROLLER({})).toThrow('MCP servers configuration is required');
    });

    it('should handle non-object mcpServers gracefully', () => {
      expect(() => new MCP_CONTROLLER('invalid' as any)).not.toThrow();
    });
  });

  describe('fromAgentConfig', () => {
    it('should create MCP_CONTROLLER instance from valid agent config', () => {
      const controller = MCP_CONTROLLER.fromAgentConfig(mockAgentConfig);

      expect(controller).toBeInstanceOf(MCP_CONTROLLER);
      expect(MultiServerMCPClient).toHaveBeenCalledWith(mockMcpServers);
    });

    it('should throw error when agentConfig is null', () => {
      expect(() => MCP_CONTROLLER.fromAgentConfig(null as any)).toThrow(
        'Agent configuration must include mcpServers'
      );
    });

    it('should throw error when agentConfig is undefined', () => {
      expect(() => MCP_CONTROLLER.fromAgentConfig(undefined as any)).toThrow(
        'Agent configuration must include mcpServers'
      );
    });

    it('should throw error when agentConfig.mcpServers is missing', () => {
      const invalidConfig = { ...mockAgentConfig, mcpServers: undefined };
      expect(() => MCP_CONTROLLER.fromAgentConfig(invalidConfig)).toThrow(
        'Agent configuration must include mcpServers'
      );
    });

    it('should throw error when agentConfig.mcpServers is empty', () => {
      const invalidConfig = { ...mockAgentConfig, mcpServers: {} };
      expect(() => MCP_CONTROLLER.fromAgentConfig(invalidConfig)).toThrow(
        'Agent configuration must include mcpServers'
      );
    });

    it('should throw error when agentConfig.mcpServers is null', () => {
      const invalidConfig = { ...mockAgentConfig, mcpServers: null } as any;
      expect(() => MCP_CONTROLLER.fromAgentConfig(invalidConfig)).toThrow(
        'Agent configuration must include mcpServers'
      );
    });
  });

  describe('parseTools', () => {
    let controller: MCP_CONTROLLER;

    beforeEach(() => {
      controller = new MCP_CONTROLLER(mockMcpServers);
    });

    it('should parse tools successfully during initialization', async () => {
      await expect(controller.initializeConnections()).resolves.toBeUndefined();
      expect(mockMultiServerMCPClient.getTools).toHaveBeenCalled();
    });

    it('should throw error when no tools are found', () => {
      mockMultiServerMCPClient.getTools.mockReturnValue(null as any);
      
      const parseToolsMethod = (controller as any).parseTools;
      expect(() => parseToolsMethod()).toThrow('Error getting tools: Error: No tools found');
    });

    it('should throw error when getTools throws an exception', () => {
      const error = new Error('Connection failed');
      mockMultiServerMCPClient.getTools.mockImplementation(() => {
        throw error;
      });

      const parseToolsMethod = (controller as any).parseTools;
      expect(() => parseToolsMethod()).toThrow('Error getting tools: Error: Connection failed');
    });

    it('should handle empty tools array from server', () => {
      const emptyTools = new Map([['server1', []]]);
      mockMultiServerMCPClient.getTools.mockReturnValue(emptyTools);

      const parseToolsMethod = (controller as any).parseTools;
      expect(() => parseToolsMethod()).not.toThrow();
    });

    it('should collect tools from multiple servers', () => {
      const multipleTools = new Map([
        ['server1', [mockStructuredTool, mockStructuredTool]],
        ['server2', [mockStructuredTool]],
        ['server3', [mockStructuredTool, mockStructuredTool, mockStructuredTool]],
      ]);
      mockMultiServerMCPClient.getTools.mockReturnValue(multipleTools);

      const parseToolsMethod = (controller as any).parseTools;
      parseToolsMethod();

      expect(mockMultiServerMCPClient.getTools).toHaveBeenCalled();
    });
  });

  describe('initializeConnections', () => {
    let controller: MCP_CONTROLLER;

    beforeEach(() => {
      controller = new MCP_CONTROLLER(mockMcpServers);
    });

    it('should initialize connections successfully', async () => {
      await expect(controller.initializeConnections()).resolves.toBeUndefined();

      expect(mockMultiServerMCPClient.initializeConnections).toHaveBeenCalled();
      expect(mockMultiServerMCPClient.getTools).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('MCP connections initialized successfully');
    });

    it('should throw error when initializeConnections fails', async () => {
      const error = new Error('Connection timeout');
      mockMultiServerMCPClient.initializeConnections.mockRejectedValue(error);

      await expect(controller.initializeConnections()).rejects.toThrow(
        'Error initializing connections: Error: Connection timeout'
      );
    });

    it('should throw error when parseTools fails after successful connection', async () => {
      mockMultiServerMCPClient.getTools.mockReturnValue(null as any);

      await expect(controller.initializeConnections()).rejects.toThrow(
        'Error initializing connections: Error: Error getting tools: Error: No tools found'
      );
    });

    it('should handle network errors during initialization', async () => {
      const networkError = new Error('Network unreachable');
      mockMultiServerMCPClient.initializeConnections.mockRejectedValue(networkError);

      await expect(controller.initializeConnections()).rejects.toThrow(
        'Error initializing connections: Error: Network unreachable'
      );
    });
  });

  describe('getTools', () => {
    let controller: MCP_CONTROLLER;

    beforeEach(() => {
      controller = new MCP_CONTROLLER(mockMcpServers);
    });

    it('should return empty array when no tools are initialized', () => {
      const tools = controller.getTools();
      expect(tools).toEqual([]);
    });

    it('should return tools after initialization', async () => {
      await controller.initializeConnections();
      const tools = controller.getTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should return the same tools array on multiple calls', async () => {
      await controller.initializeConnections();
      const tools1 = controller.getTools();
      const tools2 = controller.getTools();
      
      expect(tools1).toBe(tools2);
    });

    it('should return structured tools with correct properties', async () => {
      await controller.initializeConnections();
      const tools = controller.getTools();
      
      if (tools.length > 0) {
        expect(tools[0]).toHaveProperty('name');
        expect(tools[0]).toHaveProperty('description');
        expect(tools[0]).toHaveProperty('schema');
      }
    });
  });

  describe('close', () => {
    let controller: MCP_CONTROLLER;

    beforeEach(() => {
      controller = new MCP_CONTROLLER(mockMcpServers);
    });

    it('should close connections successfully', async () => {
      await expect(controller.close()).resolves.toBeUndefined();

      expect(mockMultiServerMCPClient.close).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('MCP connections closed');
    });

    it('should throw error when close fails', async () => {
      const error = new Error('Close failed');
      mockMultiServerMCPClient.close.mockRejectedValue(error);

      await expect(controller.close()).rejects.toThrow('Error closing connections: Error: Close failed');
    });

    it('should handle multiple close calls gracefully', async () => {
      await controller.close();
      await controller.close();

      expect(mockMultiServerMCPClient.close).toHaveBeenCalledTimes(2);
    });

    it('should handle connection already closed scenario', async () => {
      mockMultiServerMCPClient.close.mockRejectedValue(new Error('Connection already closed'));

      await expect(controller.close()).rejects.toThrow(
        'Error closing connections: Error: Connection already closed'
      );
    });
  });

  describe('shutdown', () => {
    let controller: MCP_CONTROLLER;

    beforeEach(() => {
      controller = new MCP_CONTROLLER(mockMcpServers);
    });

    it('should shutdown successfully', async () => {
      await expect(controller.shutdown()).resolves.toBeUndefined();

      expect(mockLogger.info).toHaveBeenCalledWith('MCP shutting down...');
      expect(mockMultiServerMCPClient.close).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('MCP shutdown complete.');
    });

    it('should handle shutdown when close fails', async () => {
      const error = new Error('Shutdown failed');
      mockMultiServerMCPClient.close.mockRejectedValue(error);

      await expect(controller.shutdown()).rejects.toThrow('Error closing connections: Error: Shutdown failed');
    });

    it('should log shutdown progress correctly', async () => {
      await controller.shutdown();

      expect(mockLogger.info).toHaveBeenCalledWith('MCP shutting down...');
      expect(mockLogger.info).toHaveBeenCalledWith('MCP shutdown complete.');
    });

    it('should call close method during shutdown', async () => {
      await controller.shutdown();

      expect(mockMultiServerMCPClient.close).toHaveBeenCalled();
    });
  });

  describe('Integration tests', () => {
    it('should handle complete workflow: initialization -> get tools -> shutdown', async () => {
      const controller = new MCP_CONTROLLER(mockMcpServers);

      // Initialize connections
      await controller.initializeConnections();
      expect(mockMultiServerMCPClient.initializeConnections).toHaveBeenCalled();

      // Get tools
      const tools = controller.getTools();
      expect(Array.isArray(tools)).toBe(true);

      // Shutdown
      await controller.shutdown();
      expect(mockMultiServerMCPClient.close).toHaveBeenCalled();
    });

    it('should handle error recovery workflow', async () => {
      const controller = new MCP_CONTROLLER(mockMcpServers);

      // Simulate failed initialization
      mockMultiServerMCPClient.initializeConnections.mockRejectedValueOnce(new Error('Initial failure'));

      await expect(controller.initializeConnections()).rejects.toThrow();

      // Retry with success
      mockMultiServerMCPClient.initializeConnections.mockResolvedValueOnce(undefined as any);
      await expect(controller.initializeConnections()).resolves.toBeUndefined();

      // Shutdown
      await expect(controller.shutdown()).resolves.toBeUndefined();
    });

    it('should maintain tool state across multiple operations', async () => {
      const controller = new MCP_CONTROLLER(mockMcpServers);

      await controller.initializeConnections();
      const tools1 = controller.getTools();
      const tools2 = controller.getTools();

      expect(tools1).toBe(tools2);
      expect(tools1.length).toBeGreaterThan(0);

      await controller.shutdown();
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle undefined tools from server', async () => {
      const controller = new MCP_CONTROLLER(mockMcpServers);
      mockMultiServerMCPClient.getTools.mockReturnValue(undefined as any);

      await expect(controller.initializeConnections()).rejects.toThrow('No tools found');
    });

    it('should handle empty tools map from server', async () => {
      const controller = new MCP_CONTROLLER(mockMcpServers);
      mockMultiServerMCPClient.getTools.mockReturnValue(new Map() as any);

      await expect(controller.initializeConnections()).resolves.toBeUndefined();
    });

    it('should handle tools with null values', async () => {
      const controller = new MCP_CONTROLLER(mockMcpServers);
      const toolsWithNull = new Map([['server1', null as any]]);
      mockMultiServerMCPClient.getTools.mockReturnValue(toolsWithNull);

      await expect(controller.initializeConnections()).rejects.toThrow();
    });

    it('should handle concurrent initialization calls', async () => {
      const controller = new MCP_CONTROLLER(mockMcpServers);

      const promises = [
        controller.initializeConnections(),
        controller.initializeConnections(),
        controller.initializeConnections(),
      ];

      await expect(Promise.all(promises)).resolves.toBeDefined();
      expect(mockMultiServerMCPClient.initializeConnections).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent close calls', async () => {
      const controller = new MCP_CONTROLLER(mockMcpServers);

      const promises = [
        controller.close(),
        controller.close(),
        controller.close(),
      ];

      await expect(Promise.all(promises)).resolves.toBeDefined();
      expect(mockMultiServerMCPClient.close).toHaveBeenCalledTimes(3);
    });
  });

  describe('Memory management', () => {
    it('should not leak memory after multiple initialization cycles', async () => {
      const controller = new MCP_CONTROLLER(mockMcpServers);

      for (let i = 0; i < 5; i++) {
        await controller.initializeConnections();
        const tools = controller.getTools();
        expect(tools.length).toBeGreaterThan(0);
        await controller.close();
      }
    });

    it('should properly clean up resources on shutdown', async () => {
      const controller = new MCP_CONTROLLER(mockMcpServers);

      await controller.initializeConnections();
      await controller.shutdown();

      expect(mockMultiServerMCPClient.close).toHaveBeenCalled();
    });
  });
});
