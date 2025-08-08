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
    metrics: {
      metricsAgentToolUseCount: jest.fn(),
    },
  }),
  { virtual: true }
);

// Mock plugins
const mockPluginRegister = jest.fn(async (tools: StarknetTool[]) => {
  tools.push({
    name: 'mockTool',
    plugins: 'mock',
    description: 'mock tool',
    execute: jest.fn(async () => 'ok'),
  });
});

jest.mock('@snakagent/plugin-mock/dist/index.js', () => ({
  registerTools: mockPluginRegister,
}), { virtual: true });

const otherPluginRegister = jest.fn(async (tools: StarknetTool[]) => {
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

// Minimal agent stub
const agentStub: SnakAgentInterface = {
  getAccountCredentials: () => ({ accountPublicKey: '0x0', accountPrivateKey: '0x1' }),
  getDatabaseCredentials: () => ({ user: '', password: '', host: '', port: 0, database: '' }),
  getProvider: () => ({} as any),
  getAgentConfig: () => ({ name: 'agent' } as any),
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