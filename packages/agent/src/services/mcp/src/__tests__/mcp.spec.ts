const MockSystemMessage = jest.fn().mockImplementation((content) => ({
  content,
  type: 'system',
}));

jest.mock('@langchain/core/messages', () => ({
  SystemMessage: MockSystemMessage,
}));

jest.mock('snak-mcps', () => ({
  MultiServerMCPClient: jest.fn(),
}));

jest.mock('@langchain/core/tools', () => ({
  StructuredTool: jest.fn(),
}));

jest.mock('@snakagent/core', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  AgentMode: {
    INTERACTIVE: 'interactive',
    AUTONOMOUS: 'autonomous',
    HYBRID: 'hybrid',
  },
}));

import { MCP_CONTROLLER } from '../mcp.js';
import { StructuredTool } from '@langchain/core/tools';
import { MultiServerMCPClient } from 'snak-mcps';
import { logger, AgentConfig, AgentMode } from '@snakagent/core';
import { SystemMessage } from '@langchain/core/messages';

describe('MCP_CONTROLLER', () => {
  let mockClient: jest.Mocked<MultiServerMCPClient>;
  let mockLogger: jest.Mocked<typeof logger>;

  // Factories
  const createMockTool = (name = 'test_tool'): StructuredTool => {
    const mockTool = {
      name,
      description: `${name} description`,
      schema: {},
    } satisfies Pick<StructuredTool, 'name' | 'description' | 'schema'>;

    return mockTool as StructuredTool;
  };

  const createMockServers = () => ({
    server1: { command: 'node', args: ['server1.js'] },
    server2: { command: 'python', args: ['server2.py'] },
  });

  const createMockConfig = (
    overrides: Partial<AgentConfig> = {}
  ): AgentConfig => ({
    id: 'test-agent',
    name: 'test_agent',
    group: 'test-group',
    description: 'Test agent description',
    interval: 1000,
    chatId: 'test-chat-id',
    plugins: [],
    memory: {
      enabled: true,
      shortTermMemorySize: 10,
      memorySize: 100,
    },
    mode: AgentMode.INTERACTIVE,
    maxIterations: 10,
    mcpServers: createMockServers(),
    prompt: new SystemMessage('Test prompt'),
    ...overrides,
  });

  const createMockToolsMap = () =>
    new Map([
      ['server1', [createMockTool('tool1'), createMockTool('tool2')]],
      ['server2', [createMockTool('tool3')]],
    ]);

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      initializeConnections: jest.fn().mockResolvedValue(undefined),
      getTools: jest.fn().mockReturnValue(createMockToolsMap()),
      close: jest.fn().mockResolvedValue(undefined),
    } as any;

    (
      MultiServerMCPClient as jest.MockedClass<typeof MultiServerMCPClient>
    ).mockImplementation(() => mockClient);

    mockLogger = logger as jest.Mocked<typeof logger>;
  });

  describe('constructor', () => {
    it('should initialize successfully with valid mcpServers', () => {
      const servers = createMockServers();
      const controller = new MCP_CONTROLLER(servers);

      expect(MultiServerMCPClient).toHaveBeenCalledWith(servers);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Initializing MCP_CONTROLLER with provided servers config'
      );
      expect(controller).toBeInstanceOf(MCP_CONTROLLER);
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['empty object', {}],
    ])('should throw error when mcpServers is %s', (_, servers) => {
      expect(() => new MCP_CONTROLLER(servers as any)).toThrow(
        'MCP servers configuration is required'
      );
    });

    it('should handle non-object mcpServers gracefully', () => {
      expect(() => new MCP_CONTROLLER('invalid' as any)).not.toThrow();
    });
  });

  describe('fromAgentConfig', () => {
    it('should create MCP_CONTROLLER from valid config', () => {
      const config = createMockConfig();
      const controller = MCP_CONTROLLER.fromAgentConfig(config);

      expect(controller).toBeInstanceOf(MCP_CONTROLLER);
      expect(MultiServerMCPClient).toHaveBeenCalledWith(config.mcpServers);
    });

    it.each([
      ['null config', null],
      ['undefined config', undefined],
      [
        'missing mcpServers',
        createMockConfig({ mcpServers: undefined as any }),
      ],
      ['empty mcpServers', createMockConfig({ mcpServers: {} })],
      ['null mcpServers', createMockConfig({ mcpServers: null as any })],
    ])('should throw error for %s', (_, config) => {
      expect(() => MCP_CONTROLLER.fromAgentConfig(config as any)).toThrow(
        'Agent configuration must include mcpServers'
      );
    });
  });

  describe('nominal behavior', () => {
    let controller: MCP_CONTROLLER;

    beforeEach(() => {
      controller = new MCP_CONTROLLER(createMockServers());
    });

    it('should initialize connections and parse tools successfully', async () => {
      await controller.initializeConnections();

      expect(mockClient.initializeConnections).toHaveBeenCalled();
      expect(mockClient.getTools).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'MCP connections initialized successfully'
      );
    });

    it('should return empty array before initialization', () => {
      expect(controller.getTools()).toEqual([]);
    });

    it('should return tools after initialization', async () => {
      await controller.initializeConnections();
      const tools = controller.getTools();

      expect(tools).toHaveLength(3);
      expect(tools[0]).toHaveProperty('name');
      expect(tools[0]).toHaveProperty('description');
      expect(tools[0]).toHaveProperty('schema');
    });

    it('should return same tools instance on multiple calls', async () => {
      await controller.initializeConnections();
      const tools1 = controller.getTools();
      const tools2 = controller.getTools();

      expect(tools1).toBe(tools2);
    });

    it('should close connections successfully', async () => {
      await controller.close();

      expect(mockClient.close).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('MCP connections closed');
    });

    it('should shutdown with proper logging', async () => {
      await controller.shutdown();

      expect(mockLogger.info).toHaveBeenCalledWith('MCP shutting down...');
      expect(mockClient.close).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('MCP shutdown complete.');
    });
  });

  describe('error handling', () => {
    let controller: MCP_CONTROLLER;

    beforeEach(() => {
      controller = new MCP_CONTROLLER(createMockServers());
    });

    it.each([
      [
        'initialization fails',
        'initializeConnections',
        new Error('Connection timeout'),
      ],
      ['close fails', 'close', new Error('Close failed')],
    ])('should propagate error when %s', async (_, method, error) => {
      (mockClient as any)[method].mockRejectedValue(error);

      const expected = `Error ${method === 'initializeConnections' ? 'initializing' : 'closing'} connections: Error: ${error.message}`;
      await expect((controller as any)[method]()).rejects.toThrow(expected);
    });

    it.each([
      ['null tools', null],
      ['undefined tools', undefined],
    ])('should throw when getTools returns %s', async (_, toolsValue) => {
      mockClient.getTools.mockReturnValue(toolsValue as any);

      await expect(controller.initializeConnections()).rejects.toThrow(
        'No tools found'
      );
    });

    it('should throw when getTools throws exception', async () => {
      mockClient.getTools.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      await expect(controller.initializeConnections()).rejects.toThrow(
        'Error getting tools: Error: Connection failed'
      );
    });

    it('should handle tools with null values', async () => {
      mockClient.getTools.mockReturnValue(new Map([['server1', null as any]]));

      await expect(controller.initializeConnections()).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty tools map', async () => {
      const controller = new MCP_CONTROLLER(createMockServers());
      mockClient.getTools.mockReturnValue(new Map());

      await expect(controller.initializeConnections()).resolves.toBeUndefined();
      expect(controller.getTools()).toEqual([]);
    });

    it('should handle multiple concurrent operations', async () => {
      const controller = new MCP_CONTROLLER(createMockServers());

      const initPromises = Array(3)
        .fill(null)
        .map(() => controller.initializeConnections());
      await Promise.all(initPromises);
      expect(mockClient.initializeConnections).toHaveBeenCalledTimes(3);

      const closePromises = Array(3)
        .fill(null)
        .map(() => controller.close());
      await Promise.all(closePromises);
      expect(mockClient.close).toHaveBeenCalledTimes(3);
    });

    it('should maintain state across multiple operations', async () => {
      const controller = new MCP_CONTROLLER(createMockServers());

      for (let i = 0; i < 3; i++) {
        await controller.initializeConnections();
        expect(controller.getTools().length).toBeGreaterThan(0);
        await controller.close();
      }
    });
  });

  describe('integration workflow', () => {
    it('should handle complete workflow successfully', async () => {
      const controller = new MCP_CONTROLLER(createMockServers());

      await controller.initializeConnections();
      expect(controller.getTools()).toHaveLength(3);
      await controller.shutdown();

      expect(mockClient.initializeConnections).toHaveBeenCalled();
      expect(mockClient.close).toHaveBeenCalled();
    });

    it('should handle error recovery', async () => {
      const controller = new MCP_CONTROLLER(createMockServers());

      mockClient.initializeConnections.mockRejectedValueOnce(
        new Error('Initial failure')
      );
      await expect(controller.initializeConnections()).rejects.toThrow();

      mockClient.initializeConnections.mockResolvedValueOnce(undefined as any);
      await expect(controller.initializeConnections()).resolves.toBeUndefined();
    });
  });
});
