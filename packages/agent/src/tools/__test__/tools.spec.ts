import { StarknetToolRegistry, registerTools, createAllowedTools, StarknetTool } from '../tools.js';
import type { SnakAgentInterface } from '../tools.js';

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

// Mock plugins
const mockPluginRegister = jest.fn(async (tools: StarknetTool[], agent: any) => {
  tools.push({
    name: 'mockTool',
    plugins: 'mock',
    description: 'mock tool',
    execute: jest.fn(async () => 'ok'),
  });
});

// Mock dynamic imports for plugins
jest.mock('@snakagent/plugin-mock/dist/index.js', () => ({
  registerTools: mockPluginRegister,
}), { virtual: true });

const otherPluginRegister = jest.fn(async (tools: StarknetTool[], agent: any) => {
  tools.push({
    name: 'otherTool',
    plugins: 'other',
    description: 'other tool',
    execute: jest.fn(async () => 'other'),
  });
});

jest.mock('@snakagent/plugin-other/dist/index.js', () => ({
  registerTools: otherPluginRegister,
}), { virtual: true });

// Mock the dynamic import function
jest.doMock('@snakagent/plugin-mock/dist/index.js', () => ({
  registerTools: mockPluginRegister,
}));

jest.doMock('@snakagent/plugin-other/dist/index.js', () => ({
  registerTools: otherPluginRegister,
}));

// Minimal agent stub
const agentStub: SnakAgentInterface = {
  getAccountCredentials: () => ({ accountPublicKey: '0x0', accountPrivateKey: '0x1' }),
  getDatabaseCredentials: () => ({ user: '', password: '', host: '', port: 0, database: '' }),
  getProvider: () => ({} as any),
  getAgentConfig: () => ({ name: 'agent', id: 'test-agent', mode: 'interactive' } as any),
  getMemoryAgent: () => null,
  getRagAgent: () => null,
};

beforeEach(() => {
  jest.clearAllMocks();
  StarknetToolRegistry.clearTools();
});

describe('registerTools', () => {
  it('registers tools from allowed plugins', async () => {
    const tools: StarknetTool[] = [];
    await registerTools(agentStub, ['mock'], tools);

    expect(mockPluginRegister).toHaveBeenCalled();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('mockTool');
  });
});

describe('createAllowedTools', () => {
  it('returns only tools from allowed plugins', async () => {
    const allowed = await createAllowedTools(agentStub, ['mock']);

    expect(allowed).toHaveLength(1);
    expect(allowed[0].name).toBe('mockTool');
    expect(otherPluginRegister).not.toHaveBeenCalled();
  });
});