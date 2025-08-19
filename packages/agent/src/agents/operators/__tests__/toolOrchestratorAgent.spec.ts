// Consolidated mocks - one per package
jest.mock('@snakagent/core', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../tools/tools', () => ({
  createAllowedTools: jest.fn(),
  SnakAgentInterface: jest.fn(),
}));

jest.mock('../../../services/mcp/src/mcp', () => ({
  MCP_CONTROLLER: {
    fromAgentConfig: jest.fn(),
  },
}));

jest.mock('@langchain/langgraph/prebuilt', () => ({
  ToolNode: jest.fn(),
}));

import {
  ToolsOrchestrator,
  ToolsOrchestratorConfig,
} from '../toolOrchestratorAgent.js';
import { HumanMessage } from '@langchain/core/messages';

const mockLogger = jest.requireMock('@snakagent/core').logger;
const mockCreateAllowedTools = jest.requireMock('../../../tools/tools').createAllowedTools;
const mockMCPController = jest.requireMock('../../../services/mcp/src/mcp').MCP_CONTROLLER;
const mockToolNode = jest.requireMock('@langchain/langgraph/prebuilt').ToolNode;

describe('ToolsOrchestrator', () => {
  // Factory functions
  const createMockTool = (name: string, result: string = `${name} result`) => ({
    name,
    description: `${name} description`,
    invoke: jest.fn().mockResolvedValue(result),
  });

  const createMockConfig = (overrides: Partial<ToolsOrchestratorConfig> = {}): ToolsOrchestratorConfig => ({
    snakAgent: { name: 'test-agent', description: 'Test agent' } as any,
    agentConfig: {
      plugins: ['test-plugin'],
      mcpServers: { testServer: { command: 'test-command', args: ['--test'] } },
    },
    modelSelector: {
      getModels: jest.fn().mockReturnValue({
        fast: {
          bindTools: jest.fn().mockReturnValue([createMockTool('bound_tool')]),
        },
      }),
    } as any,
    ...overrides,
  });

  const createMockMCPController = (tools = [createMockTool('mcp_tool')]) => ({
    initializeConnections: jest.fn().mockResolvedValue(undefined),
    getTools: jest.fn().mockReturnValue(tools),
  });

  const setupMocks = () => {
    mockCreateAllowedTools.mockResolvedValue([
      createMockTool('test_tool_1'),
      createMockTool('test_tool_2'),
    ]);
    mockMCPController.fromAgentConfig.mockReturnValue(createMockMCPController());
    mockToolNode.mockImplementation(() => ({
      invoke: jest.fn().mockResolvedValue({
        messages: [{ content: 'Tool execution result' }],
      }),
    }));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('initialization', () => {
    it.each([
      ['null values', { snakAgent: null, agentConfig: {}, modelSelector: null }],
      ['with agent and plugins', createMockConfig()],
    ])('should initialize with %s', (_, config) => {
      const orchestrator = new ToolsOrchestrator(config);
      expect(orchestrator).toBeDefined();
    });

    it('should initialize successfully with tools and MCP', async () => {
      const config = createMockConfig();
      const orchestrator = new ToolsOrchestrator(config);

      await orchestrator.init();

      expect(mockCreateAllowedTools).toHaveBeenCalledWith(config.snakAgent, ['test-plugin']);
      expect(mockLogger.debug).toHaveBeenCalledWith('ToolsOrchestrator: Starting initialization');
      expect(mockLogger.debug).toHaveBeenCalledWith('ToolsOrchestrator: Initialized with 3 tools');
    });

    it('should initialize with limited tools when no SnakAgent provided', async () => {
      const config = createMockConfig({ snakAgent: null });
      const orchestrator = new ToolsOrchestrator(config);

      await orchestrator.init();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'ToolsOrchestrator: No SnakAgent provided, initializing with limited tools set'
      );
      expect(mockCreateAllowedTools).not.toHaveBeenCalled();
    });

    it('should handle MCP initialization failure gracefully', async () => {
      mockMCPController.fromAgentConfig.mockReturnValue({
        initializeConnections: jest.fn().mockRejectedValue(new Error('MCP connection failed')),
        getTools: jest.fn().mockReturnValue([]),
      });

      const orchestrator = new ToolsOrchestrator(createMockConfig());
      await orchestrator.init();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ToolsOrchestrator: Failed to initialize MCP tools: Error: MCP connection failed'
      );
    });

    it('should throw error when tool initialization fails', async () => {
      mockCreateAllowedTools.mockRejectedValue(new Error('Tool initialization failed'));

      const orchestrator = new ToolsOrchestrator(createMockConfig());

      await expect(orchestrator.init()).rejects.toThrow(
        'ToolsOrchestrator initialization failed: Error: Tool initialization failed'
      );
    });
  });

  describe('tool execution', () => {
    let orchestrator: ToolsOrchestrator;

    beforeEach(async () => {
      orchestrator = new ToolsOrchestrator(createMockConfig());
      await orchestrator.init();
    });

    const toolCallData = { name: 'test_tool_1', args: { param1: 'value1' } };

    describe('successful execution', () => {
      it.each([
        ['string input', () => JSON.stringify(toolCallData)],
        ['object input', () => toolCallData],
        ['BaseMessage input', () => {
          const message = new HumanMessage('Execute tool');
          (message as any).tool_calls = [toolCallData];
          return message;
        }],
      ])('should execute tool with %s', async (_, inputFactory) => {
        const result = await orchestrator.execute(inputFactory());
        expect(result).toBe('Tool execution result');
      });

      it('should use model selector when available', async () => {
        const config = { modelType: 'fast' };

        await orchestrator.execute(toolCallData, false, config);

        expect(orchestrator['modelSelector']?.getModels).toHaveBeenCalled();
      });

      it('should handle execution without result', async () => {
        mockToolNode.mockImplementationOnce(() => ({
          invoke: jest.fn().mockResolvedValue({ messages: [] }),
        }));

        const result = await orchestrator.execute(toolCallData);
        expect(result).toBe('Tool execution completed without result');
      });
    });

    describe('error cases', () => {
      it.each([
        ['tool not found', { name: 'non_existent_tool', args: {} }, 'Tool "non_existent_tool" not found'],
        ['empty tool name', { name: '', args: {} }, 'Invalid tool call format'],
        ['missing args', { name: 'test_tool_1' }, 'Invalid tool call format'],
      ])('should throw error for %s', async (_, toolCall, expectedError) => {
        await expect(orchestrator.execute(toolCall)).rejects.toThrow(expectedError);
      });

      it('should throw error for invalid JSON input', async () => {
        await expect(orchestrator.execute('invalid json')).rejects.toThrow(
          'Input could not be parsed as a tool call'
        );
      });

      it('should throw error for message without tool calls', async () => {
        const message = new HumanMessage('No tool calls here');
        await expect(orchestrator.execute(message)).rejects.toThrow(
          'No tool calls found in message'
        );
      });

      it('should throw error when ToolNode is not initialized', async () => {
        const uninitializedOrchestrator = new ToolsOrchestrator(createMockConfig());
        await expect(uninitializedOrchestrator.execute(toolCallData)).rejects.toThrow(
          'ToolNode is not initialized'
        );
      });
    });
  });

  describe('tool management', () => {
    let orchestrator: ToolsOrchestrator;

    beforeEach(async () => {
      orchestrator = new ToolsOrchestrator(createMockConfig());
      await orchestrator.init();
    });

    it('should get all available tools including MCP tools', () => {
      const tools = orchestrator.getTools();

      expect(tools).toHaveLength(3); // 2 allowed + 1 MCP
      expect(tools.map((t) => t.name)).toEqual(['test_tool_1', 'test_tool_2', 'mcp_tool']);
    });

    it.each([
      ['existing tool', 'test_tool_1', true],
      ['non-existent tool', 'non_existent_tool', false],
    ])('should %s when searching by name', (_, toolName, shouldExist) => {
      const tool = orchestrator.getToolByName(toolName);

      if (shouldExist) {
        expect(tool).toBeDefined();
        expect(tool!.name).toBe(toolName);
      } else {
        expect(tool).toBeUndefined();
      }
    });
  });

  describe('edge cases and configuration handling', () => {
    it.each([
      ['empty mcpServers', { agentConfig: { plugins: ['test-plugin'], mcpServers: {} } }],
      ['null SnakAgent', { snakAgent: null, agentConfig: {} }],
      ['null model selector', { modelSelector: null }],
      ['empty plugins', { agentConfig: { plugins: [] } }],
    ])('should handle %s gracefully', async (_, configOverrides) => {
      const config = createMockConfig(configOverrides);
      const orchestrator = new ToolsOrchestrator(config);

      await orchestrator.init();

      expect(orchestrator).toBeDefined();
      if ('snakAgent' in configOverrides && configOverrides.snakAgent === null) {
        expect(mockCreateAllowedTools).not.toHaveBeenCalled();
      }
    });

    it('should handle model selector without bindTools method', async () => {
      const config = createMockConfig({
        modelSelector: {
          getModels: jest.fn().mockReturnValue({ fast: {} }), // No bindTools
        } as any,
      });

      const orchestrator = new ToolsOrchestrator(config);
      await orchestrator.init();

      const result = await orchestrator.execute(
        { name: 'test_tool_1', args: {} },
        false,
        { modelType: 'fast' }
      );
      expect(result).toBe('Tool execution result');
    });

    it('should use default toolNode when modelSelector is null', async () => {
      const config = createMockConfig({ modelSelector: null });
      const orchestrator = new ToolsOrchestrator(config);
      await orchestrator.init();

      const result = await orchestrator.execute(
        { name: 'test_tool_1', args: {} },
        false,
        { modelType: 'fast' }
      );
      expect(result).toBe('Tool execution result');
    });

    it('should handle tool execution errors gracefully', async () => {
      const orchestrator = new ToolsOrchestrator(createMockConfig());
      await orchestrator.init();

      mockToolNode.mockImplementationOnce(() => ({
        invoke: jest.fn().mockRejectedValue(new Error('Tool execution failed')),
      }));

      await expect(
        orchestrator.execute({ name: 'test_tool_1', args: {} })
      ).rejects.toThrow('Tool execution failed');
    });

    it('should log execution details', async () => {
      const orchestrator = new ToolsOrchestrator(createMockConfig());
      await orchestrator.init();

      await orchestrator.execute({
        name: 'test_tool_1',
        args: { param1: 'value1' },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/Tool "test_tool_1" execution completed in \d+ms/)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Executing tool "test_tool_1" with args:')
      );
    });
  });
});
