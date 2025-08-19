import {
  StarknetSignatureToolRegistry,
  RegisterSignatureTools,
  createSignatureTools,
} from '../signatureTools.js';
import type { SignatureTool } from '../signatureTools.js';

// Mock core logger only
jest.mock('@snakagent/core', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}), { virtual: true });

// Factory functions
const makeSignatureTool = (overrides: Partial<SignatureTool> = {}): SignatureTool => ({
  name: 'defaultTool',
  category: 'signature',
  description: 'A default test tool',
  execute: jest.fn(async () => 'default result'),
  ...overrides,
});

const makeInvalidTool = (field: keyof SignatureTool, value: any): SignatureTool => ({
  ...makeSignatureTool(),
  [field]: value,
});

// Helper function to create invalid tool plugin mocks
const createInvalidToolPluginMock = (field: keyof SignatureTool, value: any) => {
  return jest.fn(async (tools: SignatureTool[]) => {
    tools.push(makeInvalidTool(field, value));
    tools.push(makeSignatureTool({ name: 'validTool' }));
  });
};

// Helper function to create plugin mocks
const createPluginMock = (registerFunction: any) => ({
  registerSignatureTools: registerFunction
});

// Mock plugin behaviors
const mockPluginRegister = jest.fn(async (tools: SignatureTool[]) => {
  tools.push(makeSignatureTool({ name: 'mockSignatureTool' }));
});

const schemaPluginRegister = jest.fn(async (tools: SignatureTool[]) => {
  tools.push(makeSignatureTool({ 
    name: 'schemaTool', 
    schema: { type: 'object', properties: { param: { type: 'string' } } }
  }));
});

const otherPluginRegister = jest.fn(async (tools: SignatureTool[]) => {
  tools.push(makeSignatureTool({ name: 'otherSignatureTool' }));
});

const malformedPluginRegister = jest.fn(async (tools: SignatureTool[]) => {
  tools.push(makeInvalidTool('name', ''));
  tools.push(makeSignatureTool({ name: 'validTool' }));
});

// Create dedicated mock plugins for invalid tool testing using the helper
const emptyNamePluginRegister = createInvalidToolPluginMock('name', '');
const whitespaceNamePluginRegister = createInvalidToolPluginMock('name', '   ');
const nullNamePluginRegister = createInvalidToolPluginMock('name', null);
const emptyDescriptionPluginRegister = createInvalidToolPluginMock('description', '');
const whitespaceDescriptionPluginRegister = createInvalidToolPluginMock('description', '   ');
const nullDescriptionPluginRegister = createInvalidToolPluginMock('description', null);
const missingExecutePluginRegister = createInvalidToolPluginMock('execute', undefined);
const nonFunctionExecutePluginRegister = createInvalidToolPluginMock('execute', 'not a function');

// Plugin configuration for mocking
const pluginConfigs = [
  { name: 'mock', mock: createPluginMock(mockPluginRegister) },
  { name: 'schema', mock: createPluginMock(schemaPluginRegister) },
  { name: 'other', mock: createPluginMock(otherPluginRegister) },
  { name: 'malformed', mock: createPluginMock(malformedPluginRegister) },
  { name: 'invalid', mock: {} },
  { name: 'empty-name', mock: createPluginMock(emptyNamePluginRegister) },
  { name: 'whitespace-name', mock: createPluginMock(whitespaceNamePluginRegister) },
  { name: 'null-name', mock: createPluginMock(nullNamePluginRegister) },
  { name: 'empty-description', mock: createPluginMock(emptyDescriptionPluginRegister) },
  { name: 'whitespace-description', mock: createPluginMock(whitespaceDescriptionPluginRegister) },
  { name: 'null-description', mock: createPluginMock(nullDescriptionPluginRegister) },
  { name: 'missing-execute', mock: createPluginMock(missingExecutePluginRegister) },
  { name: 'non-function-execute', mock: createPluginMock(nonFunctionExecutePluginRegister) },
];

// Mock all plugins dynamically
pluginConfigs.forEach(({ name, mock: moduleMock }) => {
  jest.mock(`@snakagent/plugin-${name}/dist/index.js`, () => moduleMock, { virtual: true });
});

// Mock the error plugin separately since it needs special handling
jest.mock('@snakagent/plugin-error/dist/index.js', () => {
  throw new Error('Plugin loading error');
}, { virtual: true });

describe('StarknetSignatureToolRegistry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetSignatureToolRegistry.clearTools();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('registerTool', () => {
    it.each([
      ['valid tool', makeSignatureTool()],
      ['tool without optional properties', makeSignatureTool({ 
        category: undefined, 
        schema: undefined 
      })],
      ['tool with schema', makeSignatureTool({ 
        schema: { type: 'object', properties: {} } 
      })],
    ])('should register %s', (scenario, tool) => {
      expect(() => StarknetSignatureToolRegistry.registerTool(tool)).not.toThrow();
      
      const result = StarknetSignatureToolRegistry.createSignatureTools([]);
      expect(result).toBeDefined();
    });

    it.each([
      ['empty name', 'name' as keyof SignatureTool, ''],
      ['whitespace name', 'name' as keyof SignatureTool, '   '],
      ['null name', 'name' as keyof SignatureTool, null],
      ['empty description', 'description' as keyof SignatureTool, ''],
      ['whitespace description', 'description' as keyof SignatureTool, '   '],
      ['null description', 'description' as keyof SignatureTool, null],
      ['missing execute', 'execute' as keyof SignatureTool, undefined],
      ['non-function execute', 'execute' as keyof SignatureTool, 'not a function'],
    ])('should reject tools with %s', (scenario, field, value) => {
      const tool = makeInvalidTool(field, value);
      expect(() => StarknetSignatureToolRegistry.registerTool(tool)).toThrow();
    });
  });

  describe('createSignatureTools', () => {
    it.each([
      ['empty list', [], 0],
      ['single plugin', ['mock'], 1],
      ['multiple plugins', ['mock', 'other'], 2],
    ])('should handle %s', async (scenario, plugins, expectedCount) => {
      const result = await StarknetSignatureToolRegistry.createSignatureTools(plugins);
      expect(result).toHaveLength(expectedCount);
    });

    it('should convert to LangChain tools with correct properties', async () => {
      const result = await StarknetSignatureToolRegistry.createSignatureTools(['mock']);

      expect(result[0]).toHaveProperty('name', 'mockSignatureTool');
      expect(result[0]).toHaveProperty('description');
      expect(typeof result[0].invoke).toBe('function');
    });

    it('should clear and recreate tools on subsequent calls', async () => {
      await StarknetSignatureToolRegistry.createSignatureTools(['mock']);
      const result = await StarknetSignatureToolRegistry.createSignatureTools(['other']);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('otherSignatureTool');
    });
  });

  describe('clearTools', () => {
    it('should clear all registered tools', () => {
      const tool = makeSignatureTool();
      StarknetSignatureToolRegistry.registerTool(tool);
      
      expect(StarknetSignatureToolRegistry.getRegisteredToolsCount()).toBe(1);
      
      StarknetSignatureToolRegistry.clearTools();
      
      expect(StarknetSignatureToolRegistry.getRegisteredToolsCount()).toBe(0);
    });
  });

  describe('getRegisteredToolsCount', () => {
    it('should return 0 after clearTools()', () => {
      const tool = makeSignatureTool();
      StarknetSignatureToolRegistry.registerTool(tool);
      expect(StarknetSignatureToolRegistry.getRegisteredToolsCount()).toBeGreaterThan(0);
      
      StarknetSignatureToolRegistry.clearTools();
      expect(StarknetSignatureToolRegistry.getRegisteredToolsCount()).toBe(0);
    });

    it('should return count greater than 0 after RegisterSignatureTools()', async () => {
      StarknetSignatureToolRegistry.clearTools();
      expect(StarknetSignatureToolRegistry.getRegisteredToolsCount()).toBe(0);
      
      await StarknetSignatureToolRegistry.createSignatureTools(['mock']);
      
      expect(StarknetSignatureToolRegistry.getRegisteredToolsCount()).toBeGreaterThan(0);
    });
  });
});

describe('RegisterSignatureTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetSignatureToolRegistry.clearTools();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it.each([
    ['empty list', [], 0],
    ['single valid plugin', ['mock'], 1],
    ['multiple valid plugins', ['mock', 'other'], 2],
    ['invalid plugin', ['invalid'], 0],
    ['error plugin', ['error'], 0],
  ])('should handle %s', async (scenario, plugins, expectedCount) => {
    const tools: SignatureTool[] = [];
    await RegisterSignatureTools(plugins, tools);

    expect(tools).toHaveLength(expectedCount);
  });

  it('should handle concurrent registration', async () => {
    const tools: SignatureTool[] = [];
    await Promise.all([
      RegisterSignatureTools(['mock'], tools),
      RegisterSignatureTools(['other'], tools),
    ]);

    expect(tools).toHaveLength(2);
    expect(mockPluginRegister).toHaveBeenCalledTimes(1);
    expect(otherPluginRegister).toHaveBeenCalledTimes(1);
  });

  it('should log appropriate messages', async () => {
    const { logger } = require('@snakagent/core');
    const tools: SignatureTool[] = [];

    await RegisterSignatureTools(['invalid'], tools);
    expect(logger.warn).toHaveBeenCalledWith('No valid tools registered');

    await RegisterSignatureTools(['error'], tools);
    expect(logger.error).toHaveBeenCalled();
  });

  it.each([
    ['empty name', 'empty-name', 'Skipping tool with empty name'],
    ['whitespace name', 'whitespace-name', 'Skipping tool with empty name'],
    ['empty description', 'empty-description', 'Skipping tool with empty description'],
    ['whitespace description', 'whitespace-description', 'Skipping tool with empty description'],
    ['null name', 'null-name', 'Skipping tool with empty name'],
    ['null description', 'null-description', 'Skipping tool with empty description'],
    ['missing execute', 'missing-execute', 'Skipping tool with invalid execute function'],
    ['invalid execute', 'non-function-execute', 'Skipping tool with invalid execute function'],
  ])('should filter out tools with %s and log warning', async (scenario, pluginName, expectedPrefix) => {
    const { logger } = require('@snakagent/core');
    const tools: SignatureTool[] = [];

    await RegisterSignatureTools([pluginName], tools);
    
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(expectedPrefix));
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('validTool');
  });

  it('should handle mixed valid and invalid tools correctly', async () => {
    const { logger } = require('@snakagent/core');
    const tools: SignatureTool[] = [];
    
    await RegisterSignatureTools(['malformed'], tools);
    
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('validTool');
  });
});

describe('createSignatureTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetSignatureToolRegistry.clearTools();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should delegate to registry and return correct results', async () => {
    const spy = jest.spyOn(StarknetSignatureToolRegistry, 'createSignatureTools');

    const result = await createSignatureTools(['mock']);

    expect(spy).toHaveBeenCalledWith(['mock']);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('mockSignatureTool');

    spy.mockRestore();
  });

  it.each([
    ['empty plugin list', [], 0],
    ['multiple plugins', ['mock', 'other'], 2],
  ])('should handle %s', async (scenario, plugins, expectedCount) => {
    const result = await createSignatureTools(plugins);
    expect(result).toHaveLength(expectedCount);
  });
});

describe('Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetSignatureToolRegistry.clearTools();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should work end-to-end with tool execution', async () => {
    const result = await createSignatureTools(['mock', 'other']);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('mockSignatureTool');
    expect(result[1].name).toBe('otherSignatureTool');

    const executeResult = await result[0].invoke({});
    expect(executeResult).toBe('default result');
  });

  it('should handle schema property in tools', async () => {
    const result = await StarknetSignatureToolRegistry.createSignatureTools(['schema']);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('name', 'schemaTool');
    expect(result[0]).toHaveProperty('schema', { type: 'object', properties: { param: { type: 'string' } } });
  });

  it('should handle tools without schema property', async () => {
    const result = await StarknetSignatureToolRegistry.createSignatureTools(['mock']);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('name', 'mockSignatureTool');
    // LangChain tools always have a schema, so we check that it's the default one
    expect(result[0]).toHaveProperty('schema');
  });
});
