import { StarknetToolRegistry, registerTools, createAllowedTools, StarknetTool } from '../tools.js';
import type { SnakAgentInterface } from '../tools.js';

// Mock external dependencies
jest.mock(
  '@snakagent/core',
  () => ({
    logger: {
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  }),
  { virtual: true }
);

jest.mock('@snakagent/metrics', () => ({
  metrics: {
    agentToolUseCount: jest.fn(),
  },
}), { virtual: true });

const mockPluginRegister = jest.fn(async (tools: StarknetTool[], agent: SnakAgentInterface) => {
  tools.push({
    name: 'mockTool',
    plugins: 'mock',
    description: 'A mock tool for testing',
    schema: undefined,
    responseFormat: undefined,
    execute: jest.fn(async () => 'mock result'),
  });
});

const otherPluginRegister = jest.fn(async (tools: StarknetTool[], agent: SnakAgentInterface) => {
  tools.push({
    name: 'otherTool',
    plugins: 'other',
    description: 'Another mock tool for testing',
    schema: undefined,
    responseFormat: undefined,
    execute: jest.fn(async () => 'other result'),
  });
});

const invalidPluginRegister = jest.fn(async (tools: StarknetTool[], agent: SnakAgentInterface) => {
  return;
});

// Mock dynamic imports for plugins
jest.mock('@snakagent/plugin-mock/dist/index.js', () => ({
  registerTools: mockPluginRegister,
}), { virtual: true });

jest.mock('@snakagent/plugin-other/dist/index.js', () => ({
  registerTools: otherPluginRegister,
}), { virtual: true });

jest.mock('@snakagent/plugin-invalid/dist/index.js', () => ({
}), { virtual: true });

jest.mock('@snakagent/plugin-error/dist/index.js', () => {
  throw new Error('Plugin loading error');
}, { virtual: true });

const createAgentStub = (overrides: Partial<SnakAgentInterface> = {}): SnakAgentInterface => ({
  getAccountCredentials: () => ({ 
    accountPublicKey: '0x1234567890abcdef', 
    accountPrivateKey: '0xfedcba0987654321' 
  }),
  getDatabaseCredentials: () => ({ 
    user: 'testuser', 
    password: 'testpass', 
    host: 'localhost', 
    port: 5432, 
    database: 'testdb' 
  }),
  getProvider: () => ({} as any),
  getAgentConfig: () => ({ 
    name: 'test-agent', 
    id: 'test-agent-123', 
    mode: 'interactive' 
  } as any),
  getMemoryAgent: () => null,
  getRagAgent: () => null,
  ...overrides,
});

// Test data
const sampleTool: StarknetTool = {
  name: 'sampleTool',
  plugins: 'sample',
  description: 'A sample tool',
  execute: jest.fn(async () => 'sample result'),
};

const sampleToolWithSchema: StarknetTool = {
  name: 'sampleToolWithSchema',
  plugins: 'sample',
  description: 'A sample tool with schema',
  schema: {} as any,
  responseFormat: 'json',
  execute: jest.fn(async () => ({ result: 'success' })),
};

describe('StarknetToolRegistry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetToolRegistry.clearTools();
  });

  describe('registerTool', () => {
    it('should register a tool successfully', () => {
      StarknetToolRegistry.registerTool(sampleTool);
      const tools = (StarknetToolRegistry as any).tools;
      expect(tools).toHaveLength(1);
      expect(tools[0]).toBe(sampleTool);
    });

    it('should register multiple tools', () => {
      StarknetToolRegistry.registerTool(sampleTool);
      StarknetToolRegistry.registerTool(sampleToolWithSchema);
      const tools = (StarknetToolRegistry as any).tools;
      expect(tools).toHaveLength(2);
    });
  });

  describe('clearTools', () => {
    it('should clear all registered tools', () => {
      StarknetToolRegistry.registerTool(sampleTool);
      StarknetToolRegistry.registerTool(sampleToolWithSchema);
      expect((StarknetToolRegistry as any).tools).toHaveLength(2);
      
      StarknetToolRegistry.clearTools();
      expect((StarknetToolRegistry as any).tools).toHaveLength(0);
    });
  });

  describe('createAllowedTools', () => {
    it('should return empty array when no tools allowed', async () => {
      const result = await StarknetToolRegistry.createAllowedTools(createAgentStub(), []);
      expect(result).toEqual([]);
    });

    it('should create allowed tools successfully', async () => {
      const result = await StarknetToolRegistry.createAllowedTools(createAgentStub(), ['mock']);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('mockTool');
      expect(mockPluginRegister).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple allowed tools', async () => {
      const result = await StarknetToolRegistry.createAllowedTools(createAgentStub(), ['mock', 'other']);
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('mockTool');
      expect(result[1].name).toBe('otherTool');
    });

    it('should clear existing tools before creating new ones', async () => {
      // First call
      await StarknetToolRegistry.createAllowedTools(createAgentStub(), ['mock']);
      expect((StarknetToolRegistry as any).tools).toHaveLength(1);
      
      // Second call should clear and recreate
      await StarknetToolRegistry.createAllowedTools(createAgentStub(), ['other']);
      expect((StarknetToolRegistry as any).tools).toHaveLength(1);
      expect((StarknetToolRegistry as any).tools[0].name).toBe('otherTool');
    });
  });
});

describe('registerTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetToolRegistry.clearTools();
  });

  it('should register tools from allowed plugins successfully', async () => {
    const tools: StarknetTool[] = [];
    await registerTools(createAgentStub(), ['mock'], tools);

    expect(mockPluginRegister).toHaveBeenCalledTimes(1);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('mockTool');
  });

  it('should handle multiple plugins', async () => {
    const tools: StarknetTool[] = [];
    await registerTools(createAgentStub(), ['mock', 'other'], tools);

    expect(mockPluginRegister).toHaveBeenCalledTimes(1);
    expect(otherPluginRegister).toHaveBeenCalledTimes(1);
    expect(tools).toHaveLength(2);
  });

  it('should return early when no tools allowed', async () => {
    const tools: StarknetTool[] = [];
    await registerTools(createAgentStub(), [], tools);

    expect(tools).toHaveLength(0);
    expect(mockPluginRegister).not.toHaveBeenCalled();
  });

  it('should handle empty allowed_tools array', async () => {
    const tools: StarknetTool[] = [];
    await registerTools(createAgentStub(), [''], tools);

    expect(tools).toHaveLength(0);
  });

  it('should handle undefined tool in allowed_tools', async () => {
    const tools: StarknetTool[] = [];
    await registerTools(createAgentStub(), ['mock', undefined as any, 'other'], tools);

    expect(tools).toHaveLength(2);
    expect(mockPluginRegister).toHaveBeenCalledTimes(1);
    expect(otherPluginRegister).toHaveBeenCalledTimes(1);
  });

  it('should handle plugin without registerTools function', async () => {
    const tools: StarknetTool[] = [];
    await registerTools(createAgentStub(), ['invalid'], tools);

    expect(tools).toHaveLength(0);
  });

  it('should handle plugin loading errors gracefully', async () => {
    const tools: StarknetTool[] = [];
    await registerTools(createAgentStub(), ['error'], tools);

    expect(tools).toHaveLength(0);
  });

  it('should handle agent without ID or mode', async () => {
    const agentWithoutConfig = createAgentStub({
      getAgentConfig: () => ({ name: 'test', id: '', mode: '' } as any)
    });
    
    const tools: StarknetTool[] = [];
    await registerTools(agentWithoutConfig, ['mock'], tools);

    expect(tools).toHaveLength(0);
  });

  it('should call metrics.agentToolUseCount for each registered tool', async () => {
    const { metrics } = require('@snakagent/metrics');
    const tools: StarknetTool[] = [];
    
    await registerTools(createAgentStub(), ['mock'], tools);

    expect(metrics.agentToolUseCount).toHaveBeenCalledWith(
      'test-agent-123',
      'interactive',
      'mockTool'
    );
  });

  it('should handle concurrent tool registration', async () => {
    const tools: StarknetTool[] = [];
    const promises = [
      registerTools(createAgentStub(), ['mock'], tools),
      registerTools(createAgentStub(), ['other'], tools)
    ];
    
    await Promise.all(promises);
    
    expect(tools).toHaveLength(2);
    expect(mockPluginRegister).toHaveBeenCalledTimes(1);
    expect(otherPluginRegister).toHaveBeenCalledTimes(1);
  });
});

describe('createAllowedTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetToolRegistry.clearTools();
  });

  it('should return empty array when no tools allowed', async () => {
    const result = await createAllowedTools(createAgentStub(), []);
    expect(result).toEqual([]);
  });

  it('should return only tools from allowed plugins', async () => {
    const result = await createAllowedTools(createAgentStub(), ['mock']);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('mockTool');
    expect(otherPluginRegister).not.toHaveBeenCalled();
  });

  it('should handle multiple allowed plugins', async () => {
    const result = await createAllowedTools(createAgentStub(), ['mock', 'other']);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('mockTool');
    expect(result[1].name).toBe('otherTool');
  });

  it('should convert StarknetTool to DynamicStructuredTool', async () => {
    const result = await createAllowedTools(createAgentStub(), ['mock']);
    
    expect(result[0]).toHaveProperty('name', 'mockTool');
    expect(result[0]).toHaveProperty('description', 'A mock tool for testing');
    expect(typeof result[0].invoke).toBe('function');
  });

  it('should preserve schema when present', async () => {
    StarknetToolRegistry.registerTool(sampleToolWithSchema);
    
    const result = await createAllowedTools(createAgentStub(), ['mock']);
    expect(result[0]).toBeDefined();
  });
});

describe('Integration tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetToolRegistry.clearTools();
  });

  it('should work end-to-end with multiple plugins and tools', async () => {
    const agent = createAgentStub();
    const allowedPlugins = ['mock', 'other'];
    
    const tools: StarknetTool[] = [];
    await registerTools(agent, allowedPlugins, tools);
    
    const allowedTools = await createAllowedTools(agent, allowedPlugins);
    
    expect(tools).toHaveLength(2);
    expect(allowedTools).toHaveLength(2);
    expect(allowedTools[0].name).toBe('mockTool');
    expect(allowedTools[1].name).toBe('otherTool');
  });

  it('should handle tool execution through the created DynamicStructuredTool', async () => {
    const allowedTools = await createAllowedTools(createAgentStub(), ['mock']);
    
    const result = await allowedTools[0].invoke({});
    
    expect(result).toBe('mock result');
  });
});

describe('Error handling and edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetToolRegistry.clearTools();
  });

  it('should handle malformed plugin names', async () => {
    const tools: StarknetTool[] = [];
    await registerTools(createAgentStub(), ['', '   ', null as any], tools);
    
    expect(tools).toHaveLength(0);
  });

  it('should handle plugins that return no tools', async () => {
    const emptyPluginRegister = jest.fn(async (tools: StarknetTool[], agent: SnakAgentInterface) => {
    });
    
    jest.doMock('@snakagent/plugin-empty/dist/index.js', () => ({
      registerTools: emptyPluginRegister,
    }), { virtual: true });
    
    const tools: StarknetTool[] = [];
    await registerTools(createAgentStub(), ['empty'], tools);
    
    expect(tools).toHaveLength(0);
    expect(emptyPluginRegister).toHaveBeenCalled();
  });

  it('should handle tools with missing required properties', async () => {
    const malformedPluginRegister = jest.fn(async (tools: StarknetTool[], agent: SnakAgentInterface) => {
      tools.push({
        name: '', // Missing name
        plugins: 'malformed',
        description: '', // Missing description
        execute: jest.fn(async () => 'result'),
      } as any);
    });
    
    jest.doMock('@snakagent/plugin-malformed/dist/index.js', () => ({
      registerTools: malformedPluginRegister,
    }), { virtual: true });
    
    const tools: StarknetTool[] = [];
    await registerTools(createAgentStub(), ['malformed'], tools);
    
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('');
  });
});