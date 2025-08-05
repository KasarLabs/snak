// Mock external dependencies BEFORE importing
jest.mock('@snakagent/core', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../../tools/tools', () => ({
  createAllowedTools: jest.fn().mockResolvedValue([
    {
      name: 'test_tool_1',
      description: 'Test tool 1',
      invoke: jest.fn().mockResolvedValue('Tool 1 result')
    },
    {
      name: 'test_tool_2',
      description: 'Test tool 2',
      invoke: jest.fn().mockResolvedValue('Tool 2 result')
    }
  ]),
  SnakAgentInterface: jest.fn()
}));

jest.mock('../../../services/mcp/src/mcp', () => ({
  MCP_CONTROLLER: {
    fromAgentConfig: jest.fn().mockReturnValue({
      initializeConnections: jest.fn().mockResolvedValue(undefined),
      getTools: jest.fn().mockReturnValue([
        {
          name: 'mcp_tool_1',
          description: 'MCP tool 1',
          invoke: jest.fn().mockResolvedValue('MCP tool 1 result')
        }
      ])
    })
  }
}));

jest.mock('@langchain/langgraph/prebuilt', () => ({
  ToolNode: jest.fn().mockImplementation((tools) => ({
    invoke: jest.fn().mockResolvedValue({
      messages: [
        {
          content: 'Tool execution result',
          _getType: () => 'tool'
        }
      ]
    })
  }))
}));

import { ToolsOrchestrator, ToolsOrchestratorConfig } from '../toolOrchestratorAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import { ModelSelector } from '../modelSelector.js';

// Get the mocked modules for testing
const mockLogger = jest.requireMock('@snakagent/core').logger;
const mockCreateAllowedTools = jest.requireMock('../../../tools/tools').createAllowedTools;
const mockMCPController = jest.requireMock('../../../services/mcp/src/mcp').MCP_CONTROLLER;
const mockToolNode = jest.requireMock('@langchain/langgraph/prebuilt').ToolNode;

describe('ToolsOrchestrator', () => {
  let toolsOrchestrator: ToolsOrchestrator;
  let mockConfig: ToolsOrchestratorConfig;
  let mockSnakAgent: any;
  let mockModelSelector: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations
    mockCreateAllowedTools.mockResolvedValue([
      {
        name: 'test_tool_1',
        description: 'Test tool 1',
        invoke: jest.fn().mockResolvedValue('Tool 1 result')
      },
      {
        name: 'test_tool_2',
        description: 'Test tool 2',
        invoke: jest.fn().mockResolvedValue('Tool 2 result')
      }
    ]);

    mockSnakAgent = {
      name: 'test-agent',
      description: 'Test agent'
    };

    mockModelSelector = {
      getModels: jest.fn().mockReturnValue({
        fast: {
          bindTools: jest.fn().mockReturnValue([
            {
              name: 'bound_tool_1',
              description: 'Bound tool 1'
            }
          ])
        }
      })
    };

    // Create default configuration
    mockConfig = {
      snakAgent: mockSnakAgent,
      agentConfig: {
        plugins: ['test-plugin'],
        mcpServers: {
          testServer: {
            command: 'test-command',
            args: ['--test']
          }
        }
      },
      modelSelector: mockModelSelector
    };

    // Create tools orchestrator instance
    toolsOrchestrator = new ToolsOrchestrator(mockConfig);
  });

  describe('initialization', () => {
    it('should initialize with default configuration values', () => {
      const config: ToolsOrchestratorConfig = {
        snakAgent: null,
        agentConfig: {},
        modelSelector: null
      };
      
      const agent = new ToolsOrchestrator(config);
      expect(agent).toBeDefined();
    });

    it('should initialize with custom configuration', () => {
      const customConfig: ToolsOrchestratorConfig = {
        snakAgent: mockSnakAgent,
        agentConfig: {
          plugins: ['custom-plugin'],
          mcpServers: {}
        },
        modelSelector: mockModelSelector
      };
      
      const agent = new ToolsOrchestrator(customConfig);
      expect(agent).toBeDefined();
    });

    it('should initialize tools orchestrator successfully', async () => {
      await toolsOrchestrator.init();
      
      expect(mockCreateAllowedTools).toHaveBeenCalledWith(
        mockSnakAgent,
        ['test-plugin']
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ToolsOrchestrator: Starting initialization'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ToolsOrchestrator: Initialized with 3 tools'
      );
    });

    it('should initialize with limited tools when no SnakAgent provided', async () => {
      const limitedConfig: ToolsOrchestratorConfig = {
        snakAgent: null,
        agentConfig: {},
        modelSelector: null
      };
      
      const limitedOrchestrator = new ToolsOrchestrator(limitedConfig);
      await limitedOrchestrator.init();
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ToolsOrchestrator: No SnakAgent provided, initializing with limited tools set'
      );
    });

    it('should initialize MCP tools when mcpServers are configured', async () => {
      await toolsOrchestrator.init();
      
      expect(mockMCPController.fromAgentConfig).toHaveBeenCalledWith(
        mockConfig.agentConfig
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ToolsOrchestrator: Added 1 MCP tools'
      );
    });

    it('should handle MCP initialization failure gracefully', async () => {
      const mcpError = new Error('MCP connection failed');
      mockMCPController.fromAgentConfig.mockReturnValue({
        initializeConnections: jest.fn().mockRejectedValue(mcpError),
        getTools: jest.fn().mockReturnValue([])
      });

      await toolsOrchestrator.init();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'ToolsOrchestrator: Failed to initialize MCP tools: Error: MCP connection failed'
      );
    });

    it('should throw error when initialization fails', async () => {
      const initError = new Error('Tool initialization failed');
      mockCreateAllowedTools.mockRejectedValue(initError);

      await expect(toolsOrchestrator.init()).rejects.toThrow(
        'ToolsOrchestrator initialization failed: Error: Tool initialization failed'
      );
    });
  });

  describe('tool execution', () => {
    beforeEach(async () => {
      await toolsOrchestrator.init();
    });

    it('should execute tool with string input successfully', async () => {
      const toolCall = {
        name: 'test_tool_1',
        args: { param1: 'value1' }
      };

      const result = await toolsOrchestrator.execute(JSON.stringify(toolCall));
      
      expect(result).toBe('Tool execution result');
    });

    it('should execute tool with BaseMessage input successfully', async () => {
      const toolCall = {
        name: 'test_tool_1',
        args: { param1: 'value1' }
      };

      const message = new HumanMessage('Execute tool');
      (message as any).tool_calls = [toolCall];

      const result = await toolsOrchestrator.execute(message);
      
      expect(result).toBe('Tool execution result');
    });

    it('should execute tool with object input successfully', async () => {
      const toolCall = {
        name: 'test_tool_1',
        args: { param1: 'value1' }
      };

      const result = await toolsOrchestrator.execute(toolCall);
      
      expect(result).toBe('Tool execution result');
    });

    it('should throw error when tool is not found', async () => {
      const toolCall = {
        name: 'non_existent_tool',
        args: { param1: 'value1' }
      };

      await expect(
        toolsOrchestrator.execute(JSON.stringify(toolCall))
      ).rejects.toThrow('ToolsOrchestrator: Tool "non_existent_tool" not found');
    });

    it('should throw error when ToolNode is not initialized', async () => {
      const uninitializedOrchestrator = new ToolsOrchestrator(mockConfig);
      const toolCall = {
        name: 'test_tool_1',
        args: { param1: 'value1' }
      };

      await expect(
        uninitializedOrchestrator.execute(JSON.stringify(toolCall))
      ).rejects.toThrow('ToolsOrchestrator: ToolNode is not initialized');
    });

    it('should throw error for invalid JSON input', async () => {
      await expect(
        toolsOrchestrator.execute('invalid json')
      ).rejects.toThrow('ToolsOrchestrator: Input could not be parsed as a tool call');
    });

    it('should throw error for message without tool calls', async () => {
      const message = new HumanMessage('No tool calls here');

      await expect(
        toolsOrchestrator.execute(message)
      ).rejects.toThrow('ToolsOrchestrator: No tool calls found in message');
    });

    it('should throw error for invalid tool call format', async () => {
      const invalidToolCall = {
        name: '', // Empty name
        args: { param1: 'value1' }
      };

      await expect(
        toolsOrchestrator.execute(invalidToolCall)
      ).rejects.toThrow('ToolsOrchestrator: Invalid tool call format');
    });

    it('should use model selector for tool execution when available', async () => {
      const toolCall = {
        name: 'test_tool_1',
        args: { param1: 'value1' }
      };

      const config = { modelType: 'fast' };

      await toolsOrchestrator.execute(JSON.stringify(toolCall), false, config);
      
      expect(mockModelSelector.getModels).toHaveBeenCalled();
    });

    it('should handle tool execution without result', async () => {
      mockToolNode.mockImplementationOnce(() => ({
        invoke: jest.fn().mockResolvedValue({
          messages: []
        })
      }));

      const toolCall = {
        name: 'test_tool_1',
        args: { param1: 'value1' }
      };

      const result = await toolsOrchestrator.execute(JSON.stringify(toolCall));
      
      expect(result).toBe('Tool execution completed without result');
    });
  });

  describe('tool management', () => {
    beforeEach(async () => {
      await toolsOrchestrator.init();
    });

    it('should get all available tools', () => {
      const tools = toolsOrchestrator.getTools();
      
      // Should have 2 allowed tools + 1 MCP tool = 3 total
      expect(tools.length).toBeGreaterThanOrEqual(2);
      expect(tools[0].name).toBe('test_tool_1');
      expect(tools[1].name).toBe('test_tool_2');
      // Explicitly check for MCP tool presence by searching for the tool name
      const mcpTool = tools.find(tool => tool.name === 'mcp_tool_1');
      expect(mcpTool).toBeDefined();
      expect(mcpTool!.name).toBe('mcp_tool_1');
    });

    it('should get tool by name', () => {
      const tool = toolsOrchestrator.getToolByName('test_tool_1');
      
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('test_tool_1');
    });

    it('should return undefined for non-existent tool', () => {
      const tool = toolsOrchestrator.getToolByName('non_existent_tool');
      
      expect(tool).toBeUndefined();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty mcpServers configuration', async () => {
      const configWithoutMCP: ToolsOrchestratorConfig = {
        snakAgent: mockSnakAgent,
        agentConfig: {
          plugins: ['test-plugin'],
          mcpServers: {}
        },
        modelSelector: mockModelSelector
      };

      const orchestrator = new ToolsOrchestrator(configWithoutMCP);
      await orchestrator.init();
      
      expect(mockMCPController.fromAgentConfig).not.toHaveBeenCalled();
    });

    it('should handle model selector without bindTools method', async () => {
      const configWithoutBindTools: ToolsOrchestratorConfig = {
        snakAgent: mockSnakAgent,
        agentConfig: {
          plugins: ['test-plugin']
        },
        modelSelector: {
          getModels: jest.fn().mockReturnValue({
            fast: {} // No bindTools method
          })
        } as any
      };

      const orchestrator = new ToolsOrchestrator(configWithoutBindTools);
      await orchestrator.init();

      const toolCall = {
        name: 'test_tool_1',
        args: { param1: 'value1' }
      };

      const config = { modelType: 'fast' };
      const result = await orchestrator.execute(JSON.stringify(toolCall), false, config);
      
      expect(result).toBe('Tool execution result');
    });

    it('should handle tool execution errors gracefully', async () => {
      await toolsOrchestrator.init();

      mockToolNode.mockImplementationOnce(() => ({
        invoke: jest.fn().mockRejectedValue(new Error('Tool execution failed'))
      }));

      const toolCall = {
        name: 'test_tool_1',
        args: { param1: 'value1' }
      };

      await expect(
        toolsOrchestrator.execute(JSON.stringify(toolCall))
      ).rejects.toThrow('Tool execution failed');
    });

    it('should log tool execution time', async () => {
      await toolsOrchestrator.init();

      const toolCall = {
        name: 'test_tool_1',
        args: { param1: 'value1' }
      };

      await toolsOrchestrator.execute(JSON.stringify(toolCall));
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/ToolsOrchestrator: Tool "test_tool_1" execution completed in \d+ms/)
      );
    });

    it('should log tool execution details', async () => {
      await toolsOrchestrator.init();

      const toolCall = {
        name: 'test_tool_1',
        args: { param1: 'value1', param2: 'value2' }
      };

      await toolsOrchestrator.execute(JSON.stringify(toolCall));
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ToolsOrchestrator: Executing tool "test_tool_1" with args: {"param1":"value1","param2":"value2"}...'
      );
    });
  });

  describe('configuration handling', () => {
    it('should handle null SnakAgent gracefully', async () => {
      const configWithNullAgent: ToolsOrchestratorConfig = {
        snakAgent: null,
        agentConfig: {},
        modelSelector: null
      };

      const orchestrator = new ToolsOrchestrator(configWithNullAgent);
      await orchestrator.init();
      
      expect(mockCreateAllowedTools).not.toHaveBeenCalled();
    });

    it('should handle null model selector gracefully', async () => {
      const configWithoutModelSelector: ToolsOrchestratorConfig = {
        snakAgent: mockSnakAgent,
        agentConfig: {
          plugins: ['test-plugin']
        },
        modelSelector: null
      };

      const orchestrator = new ToolsOrchestrator(configWithoutModelSelector);
      await orchestrator.init();

      const toolCall = {
        name: 'test_tool_1',
        args: { param1: 'value1' }
      };

      const result = await orchestrator.execute(JSON.stringify(toolCall));
      expect(result).toBe('Tool execution result');
    });

    it('should handle empty plugins configuration', async () => {
      const configWithEmptyPlugins: ToolsOrchestratorConfig = {
        snakAgent: mockSnakAgent,
        agentConfig: {
          plugins: []
        },
        modelSelector: mockModelSelector
      };

      const orchestrator = new ToolsOrchestrator(configWithEmptyPlugins);
      await orchestrator.init();
      
      expect(mockCreateAllowedTools).toHaveBeenCalledWith(mockSnakAgent, []);
    });
  });
}); 