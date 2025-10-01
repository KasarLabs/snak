import * as ToolsModule from '../tools.js';
import { getSupervisorConfigTools } from '@agents/operators/supervisor/supervisorTools.js';

jest.mock('@agents/operators/supervisor/supervisorTools.js', () => ({
  getSupervisorConfigTools: jest.fn(),
}));

jest.mock('@agents/graphs/tools/core.tools.js', () => ({
  CoreToolRegistry: jest.fn().mockImplementation(() => ({
    getTools: () => [],
  })),
}));

jest.mock('@services/mcp/src/mcp.js', () => ({
  MCP_CONTROLLER: {
    fromAgentConfig: jest.fn(),
  },
}));

jest.mock('@snakagent/core', () => ({
  logger: {
    info: jest.fn(),
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

describe('initializeToolsList - supervisor integration', () => {
  const initializeToolsList = ToolsModule.initializeToolsList;
  let createAllowedToolsSpy: jest.SpiedFunction<
    typeof ToolsModule.createAllowedTools
  >;
  let initializeMcpToolsSpy: jest.SpiedFunction<
    typeof ToolsModule.initializeMcpTools
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    createAllowedToolsSpy = jest
      .spyOn(ToolsModule, 'createAllowedTools')
      .mockResolvedValue([{ name: 'base_tool' } as any]);
    initializeMcpToolsSpy = jest
      .spyOn(ToolsModule, 'initializeMcpTools')
      .mockResolvedValue([]);
  });

  afterEach(() => {
    createAllowedToolsSpy.mockRestore();
    initializeMcpToolsSpy.mockRestore();
  });

  it('appends supervisor configuration tools for supervisor agents', async () => {
    (getSupervisorConfigTools as jest.Mock).mockReturnValue([
      { name: 'create_agent' },
    ]);

    const tools = await initializeToolsList(
      {} as any,
      {
        plugins: [],
        profile: {
          group: 'system',
          name: 'Supervisor Agent 123456',
        },
      } as any
    );

    expect(getSupervisorConfigTools).toHaveBeenCalledTimes(1);
    expect(createAllowedToolsSpy).toHaveBeenCalledTimes(1);
    expect(initializeMcpToolsSpy).toHaveBeenCalledTimes(1);
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['base_tool', 'create_agent'])
    );
  });

  it('does not include supervisor tools for non-system agents', async () => {
    const supervisorMock = getSupervisorConfigTools as jest.Mock;
    supervisorMock.mockReturnValue([{ name: 'create_agent' }]);

    const tools = await initializeToolsList(
      {} as any,
      {
        plugins: [],
        profile: {
          group: 'trading',
          name: 'Market Maker',
        },
      } as any
    );

    expect(supervisorMock).not.toHaveBeenCalled();
    expect(tools.map((tool) => tool.name)).toEqual(['base_tool']);
  });
});
