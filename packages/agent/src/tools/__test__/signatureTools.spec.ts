import {
  StarknetSignatureToolRegistry,
  RegisterSignatureTools,
  createSignatureTools,
  SignatureTool,
} from '../signatureTools.js';

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

// Mock plugins with realistic behavior
const mockPluginRegister = jest.fn(async (tools: SignatureTool[]) => {
  tools.push(makeSignatureTool({ name: 'mockSignatureTool' }));
});

const otherPluginRegister = jest.fn(async (tools: SignatureTool[]) => {
  tools.push(makeSignatureTool({ name: 'otherSignatureTool' }));
});

// Mock dynamic imports for plugins
jest.mock('@snakagent/plugin-mock/dist/index.js', () => ({ registerSignatureTools: mockPluginRegister }), { virtual: true });
jest.mock('@snakagent/plugin-other/dist/index.js', () => ({ registerSignatureTools: otherPluginRegister }), { virtual: true });
jest.mock('@snakagent/plugin-invalid/dist/index.js', () => ({}), { virtual: true });
jest.mock('@snakagent/plugin-error/dist/index.js', () => { throw new Error('Plugin loading error'); }, { virtual: true });

const malformedPluginRegister = jest.fn(async (tools: SignatureTool[]) => {
  tools.push(makeInvalidTool('name', ''));
  tools.push(makeSignatureTool({ name: 'validTool' }));
});
jest.mock('@snakagent/plugin-malformed/dist/index.js', () => ({ registerSignatureTools: malformedPluginRegister }), { virtual: true });

// Test factories
const makeSignatureTool = (overrides: Partial<SignatureTool> = {}): SignatureTool => ({
  name: 'defaultTool',
  categorie: 'signature',
  description: 'A default test tool',
  execute: jest.fn(async () => 'default result'),
  ...overrides,
});

const makeInvalidTool = (invalidField: string, value: any): SignatureTool => {
  const base = makeSignatureTool();
  return { ...base, [invalidField]: value };
};

describe('StarknetSignatureToolRegistry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetSignatureToolRegistry.clearTools();
  });

  describe('registerTool - nominal', () => {
    it('should register valid signature tools', () => {
      const tool = makeSignatureTool();
      StarknetSignatureToolRegistry.registerTool(tool);
      
      // Test by creating tools - no internal structure inspection
      const result = StarknetSignatureToolRegistry.createSignatureTools([]);
      expect(result).toBeDefined();
    });

    it('should handle tools without optional properties', () => {
      const tool = makeSignatureTool({ categorie: undefined, schema: undefined });
      expect(() => StarknetSignatureToolRegistry.registerTool(tool)).not.toThrow();
    });
  });

  describe('registerTool - validation errors', () => {
    it.each([
      ['empty name', 'name', ''],
      ['whitespace name', 'name', '   '],
      ['empty description', 'description', ''],
      ['whitespace description', 'description', '   '],
      ['missing execute', 'execute', undefined],
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
});

describe('RegisterSignatureTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetSignatureToolRegistry.clearTools();
  });

  it.each([
    ['empty list', [], 0, 0],
    ['single valid plugin', ['mock'], 1, 1],
    ['multiple valid plugins', ['mock', 'other'], 2, 2],
    ['invalid plugin', ['invalid'], 0, 0],
    ['error plugin', ['error'], 0, 0],
  ])('should handle %s', async (scenario, plugins, expectedCount, expectedCalls) => {
    const tools: SignatureTool[] = [];
    await RegisterSignatureTools(plugins, tools);
    
    expect(tools).toHaveLength(expectedCount);
    if (expectedCalls > 0) {
      expect(mockPluginRegister).toHaveBeenCalledTimes(plugins.includes('mock') ? 1 : 0);
    }
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
});

describe('createSignatureTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetSignatureToolRegistry.clearTools();
  });

  it('should delegate to registry and return correct results', async () => {
    const spy = jest.spyOn(StarknetSignatureToolRegistry, 'createSignatureTools');
    
    const result = await createSignatureTools(['mock']);
    
    expect(spy).toHaveBeenCalledWith(['mock']);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('mockSignatureTool');
    
    spy.mockRestore();
  });
});

describe('Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetSignatureToolRegistry.clearTools();
  });

  it('should work end-to-end with tool execution', async () => {
    const result = await createSignatureTools(['mock', 'other']);
    
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('mockSignatureTool');
    expect(result[1].name).toBe('otherSignatureTool');
    
    // Execute tool to verify pass-through behavior
    const executeResult = await result[0].invoke({});
    expect(executeResult).toBe('default result');
  });

  it('should filter invalid tools during registration', async () => {
    const tools: SignatureTool[] = [];
    await RegisterSignatureTools(['malformed'], tools);
    
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('validTool');
  });
});
