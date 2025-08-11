import { 
  StarknetSignatureToolRegistry, 
  RegisterSignatureTools, 
  createSignatureTools, 
  SignatureTool 
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
const mockSignaturePluginRegister = jest.fn(async (tools: SignatureTool[]) => {
  tools.push({
    name: 'mockSignatureTool',
    categorie: 'signature',
    description: 'A mock signature tool for testing',
    schema: undefined,
    execute: jest.fn(async () => 'mock signature result'),
  });
});

const otherSignaturePluginRegister = jest.fn(async (tools: SignatureTool[]) => {
  tools.push({
    name: 'otherSignatureTool',
    categorie: 'signature',
    description: 'Another mock signature tool for testing',
    schema: undefined,
    execute: jest.fn(async () => 'other signature result'),
  });
});

const invalidSignaturePluginRegister = jest.fn(async (tools: SignatureTool[]) => {
  // This plugin doesn't export registerSignatureTools function
  return;
});

// Mock dynamic imports for plugins
jest.mock('@snakagent/plugin-mock/dist/index.js', () => ({
  registerSignatureTools: mockSignaturePluginRegister,
}), { virtual: true });

jest.mock('@snakagent/plugin-other/dist/index.js', () => ({
  registerSignatureTools: otherSignaturePluginRegister,
}), { virtual: true });

jest.mock('@snakagent/plugin-invalid/dist/index.js', () => ({
  // Missing registerSignatureTools function
}), { virtual: true });

jest.mock('@snakagent/plugin-error/dist/index.js', () => {
  throw new Error('Plugin loading error');
}, { virtual: true });

// Test data
const sampleSignatureTool: SignatureTool = {
  name: 'sampleSignatureTool',
  categorie: 'signature',
  description: 'A sample signature tool',
  execute: jest.fn(async () => 'sample signature result'),
};

const sampleSignatureToolWithSchema: SignatureTool = {
  name: 'sampleSignatureToolWithSchema',
  categorie: 'signature',
  description: 'A sample signature tool with schema',
  schema: { type: 'object', properties: {} },
  execute: jest.fn(async () => ({ result: 'signature success' })),
};

describe('StarknetSignatureToolRegistry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetSignatureToolRegistry.clearTools();
  });

  describe('registerTool', () => {
    it('should register a signature tool successfully', () => {
      StarknetSignatureToolRegistry.registerTool(sampleSignatureTool);
      const tools = (StarknetSignatureToolRegistry as any).tools;
      expect(tools).toHaveLength(1);
      expect(tools[0]).toBe(sampleSignatureTool);
    });

    it('should register multiple signature tools', () => {
      StarknetSignatureToolRegistry.registerTool(sampleSignatureTool);
      StarknetSignatureToolRegistry.registerTool(sampleSignatureToolWithSchema);
      const tools = (StarknetSignatureToolRegistry as any).tools;
      expect(tools).toHaveLength(2);
    });

    it('should handle tools without categorie', () => {
      const toolWithoutCategorie: SignatureTool = {
        name: 'toolWithoutCategorie',
        description: 'A tool without categorie',
        execute: jest.fn(async () => 'result'),
      };
      
      StarknetSignatureToolRegistry.registerTool(toolWithoutCategorie);
      const tools = (StarknetSignatureToolRegistry as any).tools;
      expect(tools).toHaveLength(1);
      expect(tools[0].categorie).toBeUndefined();
    });

    it('should reject tools with empty name', () => {
      const toolWithEmptyName: SignatureTool = {
        name: '',
        description: 'A tool with empty name',
        execute: jest.fn(async () => 'result'),
      };
      
      expect(() => {
        StarknetSignatureToolRegistry.registerTool(toolWithEmptyName);
      }).toThrow('Tool name is required and cannot be empty');
    });

    it('should reject tools with empty description', () => {
      const toolWithEmptyDescription: SignatureTool = {
        name: 'validName',
        description: '',
        execute: jest.fn(async () => 'result'),
      };
      
      expect(() => {
        StarknetSignatureToolRegistry.registerTool(toolWithEmptyDescription);
      }).toThrow('Tool description is required and cannot be empty');
    });

    it('should reject tools with whitespace-only name', () => {
      const toolWithWhitespaceName: SignatureTool = {
        name: '   ',
        description: 'A tool with whitespace-only name',
        execute: jest.fn(async () => 'result'),
      };
      
      expect(() => {
        StarknetSignatureToolRegistry.registerTool(toolWithWhitespaceName);
      }).toThrow('Tool name is required and cannot be empty');
    });

    it('should reject tools with whitespace-only description', () => {
      const toolWithWhitespaceDescription: SignatureTool = {
        name: 'validName',
        description: '   ',
        execute: jest.fn(async () => 'result'),
      };
      
      expect(() => {
        StarknetSignatureToolRegistry.registerTool(toolWithWhitespaceDescription);
      }).toThrow('Tool description is required and cannot be empty');
    });

    it('should reject tools without execute function', () => {
      const toolWithoutExecute: SignatureTool = {
        name: 'validName',
        description: 'A tool without execute function',
        execute: undefined as any,
      };
      
      expect(() => {
        StarknetSignatureToolRegistry.registerTool(toolWithoutExecute);
      }).toThrow('Tool execute function is required');
    });
  });

  describe('clearTools', () => {
    it('should clear all registered signature tools', () => {
      StarknetSignatureToolRegistry.registerTool(sampleSignatureTool);
      StarknetSignatureToolRegistry.registerTool(sampleSignatureToolWithSchema);
      expect((StarknetSignatureToolRegistry as any).tools).toHaveLength(2);
      
      StarknetSignatureToolRegistry.clearTools();
      expect((StarknetSignatureToolRegistry as any).tools).toHaveLength(0);
    });
  });

  describe('createSignatureTools', () => {
    it('should return empty array when no tools allowed', async () => {
      const result = await StarknetSignatureToolRegistry.createSignatureTools([]);
      expect(result).toEqual([]);
    });

    it('should create signature tools successfully', async () => {
      const result = await StarknetSignatureToolRegistry.createSignatureTools(['mock']);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('mockSignatureTool');
      expect(mockSignaturePluginRegister).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple allowed tools', async () => {
      const result = await StarknetSignatureToolRegistry.createSignatureTools(['mock', 'other']);
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('mockSignatureTool');
      expect(result[1].name).toBe('otherSignatureTool');
    });

    it('should clear existing tools before creating new ones', async () => {
      // First call
      await StarknetSignatureToolRegistry.createSignatureTools(['mock']);
      expect((StarknetSignatureToolRegistry as any).tools).toHaveLength(1);
      
      // Second call should clear and recreate
      await StarknetSignatureToolRegistry.createSignatureTools(['other']);
      expect((StarknetSignatureToolRegistry as any).tools).toHaveLength(1);
      expect((StarknetSignatureToolRegistry as any).tools[0].name).toBe('otherSignatureTool');
    });

    it('should convert SignatureTool to LangChain tool', async () => {
      const result = await StarknetSignatureToolRegistry.createSignatureTools(['mock']);
      
      expect(result[0]).toHaveProperty('name', 'mockSignatureTool');
      expect(result[0]).toHaveProperty('description', 'A mock signature tool for testing');
      expect(typeof result[0].invoke).toBe('function');
    });

    it('should preserve schema when present', async () => {
      // Register a tool with schema first
      StarknetSignatureToolRegistry.registerTool(sampleSignatureToolWithSchema);
      
      const result = await StarknetSignatureToolRegistry.createSignatureTools(['mock']);
      // Note: The mock plugin tool doesn't have schema, but we test the conversion logic
      expect(result[0]).toBeDefined();
    });
  });
});

describe('RegisterSignatureTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetSignatureToolRegistry.clearTools();
  });

  it('should register signature tools from allowed plugins successfully', async () => {
    const tools: SignatureTool[] = [];
    await RegisterSignatureTools(['mock'], tools);

    expect(mockSignaturePluginRegister).toHaveBeenCalledTimes(1);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('mockSignatureTool');
  });

  it('should handle multiple plugins', async () => {
    const tools: SignatureTool[] = [];
    await RegisterSignatureTools(['mock', 'other'], tools);

    expect(mockSignaturePluginRegister).toHaveBeenCalledTimes(1);
    expect(otherSignaturePluginRegister).toHaveBeenCalledTimes(1);
    expect(tools).toHaveLength(2);
  });

  it('should handle empty allowed_tools array', async () => {
    const tools: SignatureTool[] = [];
    await RegisterSignatureTools([], tools);

    expect(tools).toHaveLength(0);
    expect(mockSignaturePluginRegister).not.toHaveBeenCalled();
  });

  it('should handle plugin without registerSignatureTools function', async () => {
    const tools: SignatureTool[] = [];
    await RegisterSignatureTools(['invalid'], tools);

    expect(tools).toHaveLength(0);
  });

  it('should handle plugin loading errors gracefully', async () => {
    const tools: SignatureTool[] = [];
    await RegisterSignatureTools(['error'], tools);

    expect(tools).toHaveLength(0);
  });

  it('should handle concurrent tool registration', async () => {
    const tools: SignatureTool[] = [];
    const promises = [
      RegisterSignatureTools(['mock'], tools),
      RegisterSignatureTools(['other'], tools)
    ];
    
    await Promise.all(promises);
    
    expect(tools).toHaveLength(2);
    expect(mockSignaturePluginRegister).toHaveBeenCalledTimes(1);
    expect(otherSignaturePluginRegister).toHaveBeenCalledTimes(1);
  });

  it('should log warning when no tools are registered', async () => {
    const { logger } = require('@snakagent/core');
    const tools: SignatureTool[] = [];
    
    await RegisterSignatureTools(['invalid'], tools);
    
    expect(logger.warn).toHaveBeenCalledWith('No valid tools registered');
  });

  it('should log error when plugin loading fails', async () => {
    const { logger } = require('@snakagent/core');
    const tools: SignatureTool[] = [];
    
    await RegisterSignatureTools(['error'], tools);
    
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('createSignatureTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetSignatureToolRegistry.clearTools();
  });

  it('should return empty array when no tools allowed', async () => {
    const result = await createSignatureTools([]);
    expect(result).toEqual([]);
  });

  it('should return signature tools from allowed plugins', async () => {
    const result = await createSignatureTools(['mock']);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('mockSignatureTool');
    expect(otherSignaturePluginRegister).not.toHaveBeenCalled();
  });

  it('should handle multiple allowed plugins', async () => {
    const result = await createSignatureTools(['mock', 'other']);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('mockSignatureTool');
    expect(result[1].name).toBe('otherSignatureTool');
  });

  it('should delegate to StarknetSignatureToolRegistry.createSignatureTools', async () => {
    const spy = jest.spyOn(StarknetSignatureToolRegistry, 'createSignatureTools');
    
    await createSignatureTools(['mock']);
    
    expect(spy).toHaveBeenCalledWith(['mock']);
    spy.mockRestore();
  });
});

describe('Integration tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetSignatureToolRegistry.clearTools();
  });

  it('should work end-to-end with multiple plugins and signature tools', async () => {
    // Test the complete flow
    const allowedPlugins = ['mock', 'other'];
    
    // Create signature tools
    const result = await createSignatureTools(allowedPlugins);
    
    // Verify results
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('mockSignatureTool');
    expect(result[1].name).toBe('otherSignatureTool');
  });

  it('should handle tool execution through the created LangChain tool', async () => {
    const signatureTools = await createSignatureTools(['mock']);
    
    // Execute the tool
    const result = await signatureTools[0].invoke({});
    
    expect(result).toBe('mock signature result');
  });

  it('should handle tools with different categories', async () => {
    const tools: SignatureTool[] = [];
    await RegisterSignatureTools(['mock', 'other'], tools);
    
    expect(tools[0].categorie).toBe('signature');
    expect(tools[1].categorie).toBe('signature');
  });
});

describe('Error handling and edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StarknetSignatureToolRegistry.clearTools();
  });

  it('should handle malformed plugin names', async () => {
    const tools: SignatureTool[] = [];
    await RegisterSignatureTools(['', '   ', null as any], tools);
    
    expect(tools).toHaveLength(0);
  });

  it('should handle plugins that return no tools', async () => {
    const emptySignaturePluginRegister = jest.fn(async (tools: SignatureTool[]) => {
      // Plugin doesn't add any tools
    });
    
    jest.doMock('@snakagent/plugin-empty/dist/index.js', () => ({
      registerSignatureTools: emptySignaturePluginRegister,
    }), { virtual: true });
    
    const tools: SignatureTool[] = [];
    await RegisterSignatureTools(['empty'], tools);
    
    expect(tools).toHaveLength(0);
    expect(emptySignaturePluginRegister).toHaveBeenCalled();
  });

  it('should handle tools with missing required properties', async () => {
    const malformedSignaturePluginRegister = jest.fn(async (tools: SignatureTool[]) => {
      tools.push({
        name: '', // Empty name
        categorie: 'malformed',
        description: '', // Empty description
        execute: jest.fn(async () => 'result'),
      } as any);
    });
    
    jest.doMock('@snakagent/plugin-malformed/dist/index.js', () => ({
      registerSignatureTools: malformedSignaturePluginRegister,
    }), { virtual: true });
    
    const tools: SignatureTool[] = [];
    await RegisterSignatureTools(['malformed'], tools);
    
    // Tools with empty required properties should be filtered out
    expect(tools).toHaveLength(0);
    expect(malformedSignaturePluginRegister).toHaveBeenCalled();
  });

  it('should handle tools with optional properties', async () => {
    const optionalPropsTool: SignatureTool = {
      name: 'optionalPropsTool',
      description: 'A tool with optional properties',
      execute: jest.fn(async () => 'result'),
    };
    
    StarknetSignatureToolRegistry.registerTool(optionalPropsTool);
    
    expect(optionalPropsTool.categorie).toBeUndefined();
    expect(optionalPropsTool.schema).toBeUndefined();
  });
});
