import {
  StarknetToolRegistry,
  registerTools,
  createAllowedTools,
  StarknetTool,
} from '../tools.js';
import type { SnakAgentInterface } from '../tools.js';

// Mock external dependencies
jest.mock('@snakagent/core', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@snakagent/metrics', () => ({
  metrics: {
    agentToolUseCount: jest.fn(),
  },
}));

// Import mocked dependencies
const { logger } = require('@snakagent/core');
const { metrics } = require('@snakagent/metrics');

// Plugin register factories
const createPluginRegister = (
  toolName: string,
  pluginName: string,
  result: any = `${pluginName} result`
) =>
  jest.fn(async (tools: StarknetTool[], agent: SnakAgentInterface) => {
    tools.push({
      name: toolName,
      plugins: pluginName,
      description: `A ${pluginName} tool for testing`,
      schema: undefined,
      responseFormat: undefined,
      execute: jest.fn(async () => result),
    });
  });

const createPluginRegisterWithSchema = (
  toolName: string,
  pluginName: string,
  result: any = `${pluginName} result`
) =>
  jest.fn(async (tools: StarknetTool[], agent: SnakAgentInterface) => {
    tools.push({
      name: toolName,
      plugins: pluginName,
      description: `A ${pluginName} tool with schema for testing`,
      schema: { input: 'string' } as any,
      responseFormat: 'json',
      execute: jest.fn(async () => result),
    });
  });

// Plugin mocks
const mockPluginRegister = createPluginRegister('mockTool', 'mock');
const otherPluginRegister = createPluginRegister('otherTool', 'other');
const schemaPluginRegister = createPluginRegisterWithSchema(
  'schemaTool',
  'schema'
);
const emptyPluginRegister = jest.fn(async (tools: StarknetTool[]) => {});
const crashingPluginRegister = jest.fn(async () => {
  throw new Error('Plugin execution failed');
});

// Mock dynamic imports for plugins
const pluginMocks = [
  ['mock', mockPluginRegister],
  ['other', otherPluginRegister],
  ['schema', schemaPluginRegister],
  ['invalid', null],
  ['error', new Error('Plugin loading error')],
  ['empty', emptyPluginRegister],
  ['crashing', crashingPluginRegister],
] as const;

pluginMocks.forEach(([plugin, register]) => {
  if (register instanceof Error) {
    jest.mock(
      `@snakagent/plugin-${plugin}/dist/index.js`,
      () => {
        throw register;
      },
      { virtual: true }
    );
  } else if (register) {
    jest.mock(
      `@snakagent/plugin-${plugin}/dist/index.js`,
      () => ({
        registerTools: register,
      }),
      { virtual: true }
    );
  } else {
    jest.mock(`@snakagent/plugin-${plugin}/dist/index.js`, () => ({}), {
      virtual: true,
    });
  }
});

// Agent factory
const createAgent = (
  overrides: Partial<SnakAgentInterface> = {}
): SnakAgentInterface => ({
  getAccountCredentials: () => ({
    accountPublicKey: '0x1234567890abcdef',
    accountPrivateKey: '0xfedcba0987654321',
  }),
  getDatabaseCredentials: () => ({
    user: 'testuser',
    password: 'testpass',
    host: 'localhost',
    port: 5432,
    database: 'testdb',
  }),
  getProvider: () => ({}) as any,
  getAgentConfig: () =>
    ({
      name: 'test-agent',
      id: 'test-agent-123',
      mode: 'interactive',
    }) as any,
  getMemoryAgent: () => null,
  getRagAgent: () => null,
  ...overrides,
});

// Tool factories
const createTool = (overrides: Partial<StarknetTool> = {}): StarknetTool => ({
  name: 'sampleTool',
  plugins: 'sample',
  description: 'A sample tool',
  execute: jest.fn(async () => 'sample result'),
  ...overrides,
});

describe('StarknetToolRegistry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetToolRegistry.clearTools();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Tool registration', () => {
    it.each([
      [1, [createTool()]],
      [2, [createTool(), createTool({ name: 'tool2' })]],
      [
        3,
        [
          createTool(),
          createTool({ name: 'tool2' }),
          createTool({ name: 'tool3' }),
        ],
      ],
    ])('should register %i tool(s)', (count, tools) => {
      tools.forEach((tool) => StarknetToolRegistry.registerTool(tool));
      const registeredTools = (StarknetToolRegistry as any).tools;
      expect(registeredTools).toHaveLength(count);
    });

    it('should clear all registered tools', () => {
      [createTool(), createTool({ name: 'tool2' })].forEach((tool) =>
        StarknetToolRegistry.registerTool(tool)
      );
      expect((StarknetToolRegistry as any).tools).toHaveLength(2);

      StarknetToolRegistry.clearTools();
      expect((StarknetToolRegistry as any).tools).toHaveLength(0);
    });
  });

  describe('Tool creation', () => {
    it.each([
      ['empty array for no allowed tools', [], 0],
      ['single tool for one plugin', ['mock'], 1],
      ['multiple tools for multiple plugins', ['mock', 'other'], 2],
    ])(
      'should return %s',
      async (description, allowedTools, expectedLength) => {
        const result = await StarknetToolRegistry.createAllowedTools(
          createAgent(),
          allowedTools
        );
        expect(result).toHaveLength(expectedLength);
      }
    );

    it('should clear existing tools before creating new ones', async () => {
      await StarknetToolRegistry.createAllowedTools(createAgent(), ['mock']);
      expect((StarknetToolRegistry as any).tools).toHaveLength(1);

      await StarknetToolRegistry.createAllowedTools(createAgent(), ['other']);
      expect((StarknetToolRegistry as any).tools).toHaveLength(1);
      expect((StarknetToolRegistry as any).tools[0].name).toBe('otherTool');
    });

    it('should handle default parameter (empty array)', async () => {
      const result =
        await StarknetToolRegistry.createAllowedTools(createAgent());
      expect(result).toHaveLength(0);
    });

    it('should handle tools with schema correctly', async () => {
      const result = await StarknetToolRegistry.createAllowedTools(
        createAgent(),
        ['schema']
      );
      const tool = result[0];

      expect(tool).toHaveProperty('name', 'schemaTool');
      expect(tool).toHaveProperty(
        'description',
        'A schema tool with schema for testing'
      );
      expect(typeof tool.invoke).toBe('function');

      const executionResult = await tool.invoke({ input: 'test input' });
      expect(executionResult).toBe('schema result');
      expect(tool).toHaveProperty('schema');
    });
  });
});

describe('registerTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetToolRegistry.clearTools();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Successful registration', () => {
    it.each([
      ['single plugin', ['mock'], 1, [mockPluginRegister]],
      [
        'multiple plugins',
        ['mock', 'other'],
        2,
        [mockPluginRegister, otherPluginRegister],
      ],
    ])(
      'should register tools for %s',
      async (description, plugins, expectedCount, expectedCalls) => {
        const tools: StarknetTool[] = [];
        await registerTools(createAgent(), plugins, tools);

        expect(tools).toHaveLength(expectedCount);
        expectedCalls.forEach((mockFn) =>
          expect(mockFn).toHaveBeenCalledTimes(1)
        );
      }
    );

    it('should call metrics for registered tools', async () => {
      const { metrics } = require('@snakagent/metrics');
      const tools: StarknetTool[] = [];

      await registerTools(createAgent(), ['mock'], tools);

      expect(metrics.agentToolUseCount).toHaveBeenCalledWith(
        'test-agent-123',
        'interactive',
        'mockTool'
      );
    });
  });

  describe('Edge cases and errors', () => {
    it.each([
      ['empty array', []],
      ['empty strings', ['', '   ']],
      ['undefined values', ['mock', undefined, 'other']],
      ['null values', [null]],
    ])('should handle %s gracefully', async (description, allowedTools) => {
      const tools: StarknetTool[] = [];
      await registerTools(createAgent(), allowedTools as any, tools);

      const expectedLength = description === 'undefined values' ? 2 : 0;
      expect(tools).toHaveLength(expectedLength);
      if (description === 'undefined values') {
        expect(tools.map((t) => t.name)).toEqual(['mockTool', 'otherTool']);
      }
    });

    it.each([
      ['plugin without registerTools function', 'invalid'],
      ['plugin loading errors', 'error'],
    ])('should handle %s', async (description, plugin) => {
      const tools: StarknetTool[] = [];
      await registerTools(createAgent(), [plugin], tools);
      expect(tools).toHaveLength(0);
    });

    it('should handle agent without ID or mode', async () => {
      const invalidAgent = createAgent({
        getAgentConfig: () => ({ name: 'test', id: '', mode: '' }) as any,
      });

      const tools: StarknetTool[] = [];
      await registerTools(invalidAgent, ['mock'], tools);
      expect(tools).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle default parameter (empty array)', async () => {
      const tools: StarknetTool[] = [];
      await registerTools(createAgent(), undefined as any, tools);
      expect(tools).toHaveLength(0);
    });

    it.each([
      ['empty plugin', 'empty'],
      ['crashing plugin', 'crashing'],
      [
        'invalid agent config',
        'mock',
        createAgent({
          getAgentConfig: () => ({ name: 'test', id: '', mode: '' }) as any,
        }),
      ],
    ])(
      'should log warning when %s',
      async (description, plugin, agent = createAgent()) => {
        const tools: StarknetTool[] = [];

        await registerTools(agent, [plugin], tools);

        expect(tools).toHaveLength(0);
        expect(logger.warn).toHaveBeenCalledWith('No tools registered');
      }
    );

    it('should handle errors in the main try-catch block', async () => {
      const tools: StarknetTool[] = [];

      jest.doMock(
        '@snakagent/plugin-crash/dist/index.js',
        () => {
          throw new Error('Import crash');
        },
        { virtual: true }
      );

      await registerTools(createAgent(), ['crash'], tools);

      expect(tools).toHaveLength(0);
      expect(logger.error).toHaveBeenCalledWith(
        'Error loading plugin crash: Error: Import crash'
      );
    });

    it('should log outer error when a warning throws during processing', async () => {
      const tools: StarknetTool[] = [];

      (logger.warn as jest.Mock).mockImplementationOnce(() => {
        throw new Error('warn fail');
      });

      await registerTools(createAgent(), [undefined as any], tools);

      expect(logger.error).toHaveBeenCalledWith(
        'Error registering tools: Error: warn fail'
      );
    });
  });
});

describe('createAllowedTools function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetToolRegistry.clearTools();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it.each([
    ['empty array for no tools', [], 0],
    ['tools from single plugin', ['mock'], 1],
    ['tools from multiple plugins', ['mock', 'other'], 2],
  ])('should return %s', async (description, allowedTools, expectedLength) => {
    const result = await createAllowedTools(createAgent(), allowedTools);
    expect(result).toHaveLength(expectedLength);
  });

  it('should convert StarknetTool to DynamicStructuredTool with correct properties', async () => {
    const result = await createAllowedTools(createAgent(), ['mock']);
    const tool = result[0];

    expect(tool).toHaveProperty('name', 'mockTool');
    expect(tool).toHaveProperty('description', 'A mock tool for testing');
    expect(typeof tool.invoke).toBe('function');
  });

  it('should handle default parameter (empty array)', async () => {
    const result = await createAllowedTools(createAgent());
    expect(result).toHaveLength(0);
  });
});

describe('Integration and end-to-end', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetToolRegistry.clearTools();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should work end-to-end with multiple plugins', async () => {
    const agent = createAgent();
    const allowedPlugins = ['mock', 'other'];

    const tools: StarknetTool[] = [];
    await registerTools(agent, allowedPlugins, tools);
    const allowedTools = await createAllowedTools(agent, allowedPlugins);

    expect(tools).toHaveLength(2);
    expect(allowedTools).toHaveLength(2);
    expect(allowedTools.map((t) => t.name)).toEqual(['mockTool', 'otherTool']);
  });

  it('should execute tools correctly through DynamicStructuredTool interface', async () => {
    const allowedTools = await createAllowedTools(createAgent(), ['mock']);
    const result = await allowedTools[0].invoke({});
    expect(result).toBe('mock result');
  });

  it('should handle concurrent tool registration without conflicts', async () => {
    const tools1: StarknetTool[] = [];
    const tools2: StarknetTool[] = [];

    await Promise.all([
      registerTools(createAgent(), ['mock'], tools1),
      registerTools(createAgent(), ['other'], tools2),
    ]);

    expect(tools1).toHaveLength(1);
    expect(tools2).toHaveLength(1);
    expect(tools1[0].name).toBe('mockTool');
    expect(tools2[0].name).toBe('otherTool');
  });
});
