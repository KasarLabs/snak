import {
  StarknetToolRegistry,
  registerTools,
  createAllowedTools,
  StarknetTool,
} from '../tools.js';
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

jest.mock(
  '@snakagent/metrics',
  () => ({
    metrics: {
      agentToolUseCount: jest.fn(),
    },
  }),
  { virtual: true }
);

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

const mockPluginRegister = createPluginRegister('mockTool', 'mock');
const otherPluginRegister = createPluginRegister('otherTool', 'other');
const invalidPluginRegister = jest.fn(async () => {});

// Mock dynamic imports for plugins
const pluginMocks = [
  ['mock', mockPluginRegister],
  ['other', otherPluginRegister],
  ['invalid', null],
  ['error', new Error('Plugin loading error')],
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

const createToolWithSchema = (): StarknetTool =>
  createTool({
    name: 'sampleToolWithSchema',
    description: 'A sample tool with schema',
    schema: {} as any,
    responseFormat: 'json',
    execute: jest.fn(async () => ({ result: 'success' })),
  });

describe('StarknetToolRegistry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetToolRegistry.clearTools();
  });

  describe('Tool registration', () => {
    it.each([
      [1, [createTool()]],
      [2, [createTool(), createToolWithSchema()]],
      [
        3,
        [createTool(), createTool({ name: 'tool2' }), createToolWithSchema()],
      ],
    ])('should register %i tool(s)', (count, tools) => {
      tools.forEach((tool) => StarknetToolRegistry.registerTool(tool));
      const registeredTools = (StarknetToolRegistry as any).tools;
      expect(registeredTools).toHaveLength(count);
    });

    it('should clear all registered tools', () => {
      [createTool(), createToolWithSchema()].forEach((tool) =>
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
  });
});

describe('registerTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetToolRegistry.clearTools();
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

      if (description === 'undefined values') {
        expect(tools).toHaveLength(2); // mock and other should still register
      } else {
        expect(tools).toHaveLength(0);
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
    });
  });
});

describe('createAllowedTools function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetToolRegistry.clearTools();
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
});

describe('Integration and end-to-end', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetToolRegistry.clearTools();
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
    const tools: StarknetTool[] = [];
    const promises = [
      registerTools(createAgent(), ['mock'], tools),
      registerTools(createAgent(), ['other'], tools),
    ];

    await Promise.all(promises);
    expect(tools).toHaveLength(2);
  });
});
