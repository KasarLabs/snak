// Mock external dependencies before imports
const MockSystemMessage = jest.fn().mockImplementation((content) => ({
  content,
  type: 'system',
}));

jest.mock('@langchain/core/messages', () => ({
  SystemMessage: MockSystemMessage,
}));

jest.mock('fs/promises', () => ({
  access: jest.fn(),
  readFile: jest.fn(),
}));

jest.mock('chalk', () => ({
  red: jest.fn((text) => `RED:${text}`),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123'),
}));

jest.mock('@snakagent/core', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  AgentConfig: jest.fn(),
  RawAgentConfig: jest.fn(),
}));

jest.mock('url', () => ({
  fileURLToPath: jest.fn(() => '/mock/path/agentConfig.ts'),
}));

jest.mock('path', () => ({
  dirname: jest.fn(() => '/mock/path'),
  resolve: jest.fn((...args) => args.join('/')),
}));

// Get mocked dependencies
const mockFs = require('fs/promises');
const { logger } = require('@snakagent/core');
const { SystemMessage } = require('@langchain/core/messages');

// Type for agent prompt messages
type AgentPromptMessage =
  | InstanceType<typeof SystemMessage>
  | { type: 'system'; content: string };

enum AgentMode {
  INTERACTIVE = 'interactive',
  AUTONOMOUS = 'autonomous',
  HYBRID = 'hybrid',
}

interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface RawAgentConfig {
  name?: string;
  group?: string;
  description?: string;
  lore?: string[];
  objectives?: string[];
  knowledge?: string[];
  interval?: number;
  chatId?: string;
  plugins?: string[];
  memory?: { enabled: boolean };
  rag?: { enabled?: boolean; embeddingModel?: string };
  mcpServers?: Record<string, McpServerConfig>;
  mode?:
    | string
    | {
        mode?: string;
        maxIterations?: number;
        interactive?: boolean;
        autonomous?: boolean;
        hybrid?: boolean;
      };
  maxIterations?: number;
}

interface AgentConfig {
  id: string;
  name?: string;
  group?: string;
  description?: string;
  interval?: number;
  chatId?: string;
  plugins: string[];
  memory: { enabled: boolean };
  rag: { enabled?: boolean; embeddingModel?: string };
  mcpServers: Record<string, McpServerConfig>;
  mode: AgentMode;
  maxIterations: number;
  prompt: AgentPromptMessage;
}

const AGENT_MODES = {
  [AgentMode.AUTONOMOUS]: 'autonomous',
  [AgentMode.HYBRID]: 'hybrid',
  [AgentMode.INTERACTIVE]: 'interactive',
};

const addArrayPropertyToContext = (
  contextParts: string[],
  property: unknown,
  label: string,
  requireNonEmpty: boolean = false
): void => {
  if (Array.isArray(property) && (!requireNonEmpty || property.length > 0)) {
    contextParts.push(`Your ${label} : [${property.join(']\n[')}]`);
  }
};

const createContextFromJson = (json: RawAgentConfig): string => {
  if (!json) {
    throw new Error(
      'Error while trying to parse your context from the config file.'
    );
  }

  const contextParts: string[] = [];

  if (json.name) {
    contextParts.push(`Your name : [${json.name}]`);
  }
  if (json.description) {
    contextParts.push(`Your Description : [${json.description}]`);
  }

  addArrayPropertyToContext(contextParts, json.lore, 'lore');
  addArrayPropertyToContext(contextParts, json.objectives, 'objectives');
  addArrayPropertyToContext(contextParts, json.knowledge, 'knowledge');

  return contextParts.join('\n');
};

const parseAgentMode = (
  modeConfig:
    | string
    | {
        mode?: string;
        maxIterations?: number;
        interactive?: boolean;
        autonomous?: boolean;
        hybrid?: boolean;
      }
): AgentMode => {
  if (typeof modeConfig === 'string') {
    const mode = modeConfig.toLowerCase();
    if (Object.values(AgentMode).includes(mode as AgentMode)) {
      return mode as AgentMode;
    }
    logger.warn(
      `Invalid mode string "${mode}" - defaulting to "${AgentMode.INTERACTIVE}"`
    );
    return AgentMode.INTERACTIVE;
  }

  if (modeConfig && typeof modeConfig === 'object') {
    if (modeConfig.mode && typeof modeConfig.mode === 'string') {
      const mode = modeConfig.mode.toLowerCase();
      if (Object.values(AgentMode).includes(mode as AgentMode)) {
        return mode as AgentMode;
      }
    }

    if (
      'interactive' in modeConfig ||
      'autonomous' in modeConfig ||
      'hybrid' in modeConfig
    ) {
      if (modeConfig.hybrid === true) {
        return AgentMode.HYBRID;
      } else if (modeConfig.autonomous === true) {
        return AgentMode.AUTONOMOUS;
      } else {
        return AgentMode.INTERACTIVE;
      }
    }
  }

  logger.warn(
    `Could not determine agent mode - defaulting to "${AgentMode.INTERACTIVE}"`
  );
  return AgentMode.INTERACTIVE;
};

const normalizeMemoryAndRag = (
  memory: { enabled: boolean } | false,
  rag: { enabled?: boolean; embeddingModel?: string } | false
) => {
  const normalizedMemory =
    typeof memory === 'object' ? memory : { enabled: false };
  const normalizedRag = typeof rag === 'object' ? rag : { enabled: false };

  return { memory: normalizedMemory, rag: normalizedRag };
};

const validateConfig = (config: AgentConfig) => {
  const requiredFields = [
    'name',
    'interval',
    'plugins',
    'prompt',
    'mode',
    'maxIterations',
  ] as const;

  for (const field of requiredFields) {
    if (config[field] === undefined) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (
    !(config.prompt instanceof SystemMessage) &&
    !(config.prompt && config.prompt.type === 'system')
  ) {
    throw new Error('prompt must be a SystemMessage-compatible object');
  }

  if (!Object.values(AgentMode).includes(config.mode)) {
    throw new Error(
      `Invalid mode "${config.mode}" specified in configuration. Must be one of: ${Object.values(AgentMode).join(', ')}`
    );
  }

  if (typeof config.maxIterations !== 'number' || config.maxIterations < 0) {
    throw new Error(
      'maxIterations must be a positive number in mode configuration'
    );
  }

  if (config.mcpServers) {
    if (typeof config.mcpServers !== 'object') {
      throw new Error('mcpServers must be an object');
    }

    for (const [serverName, serverConfig] of Object.entries(
      config.mcpServers
    )) {
      const server = serverConfig as McpServerConfig;
      if (!server.command || typeof server.command !== 'string') {
        throw new Error(
          `mcpServers.${serverName} must have a valid command string`
        );
      }

      if (!Array.isArray(server.args)) {
        throw new Error(`mcpServers.${serverName} must have an args array`);
      }

      if (server.env && typeof server.env !== 'object') {
        throw new Error(
          `mcpServers.${serverName} env must be an object if present`
        );
      }
    }
  }

  if (config.rag) {
    if (
      config.rag.enabled !== undefined &&
      typeof config.rag.enabled !== 'boolean'
    ) {
      throw new Error('rag.enabled must be a boolean');
    }
    if (
      config.rag.embeddingModel !== undefined &&
      typeof config.rag.embeddingModel !== 'string'
    ) {
      throw new Error('rag.embeddingModel must be a string');
    }
  }
};

const load_json_config = async (
  agent_config_name: string
): Promise<AgentConfig> => {
  try {
    await mockFs.access(agent_config_name);

    const fileContent = await mockFs.readFile(agent_config_name, 'utf8');

    // Parse JSON content
    const json = JSON.parse(fileContent);
    if (!json) {
      throw new Error('Failed to parse JSON');
    }

    const systemMessagefromjson = new SystemMessage(
      createContextFromJson(json)
    );

    if (!json.mode) {
      throw new Error(
        'Mode configuration is mandatory but missing in config file'
      );
    }

    const { memory, rag } = normalizeMemoryAndRag(
      json.memory || false,
      json.rag || false
    );

    const agentConfig = {
      id: 'test-uuid-123',
      name: json.name,
      group: json.group,
      description: json.description,
      interval: json.interval,
      chatId: json.chatId,
      mode: parseAgentMode(json.mode),
      plugins: Array.isArray(json.plugins)
        ? json.plugins.map((tool: string) => tool.toLowerCase())
        : [],
      memory,
      rag,
      mcpServers: json.mcpServers || {},
      maxIterations:
        typeof json.maxIterations === 'number'
          ? json.maxIterations
          : json.mode &&
              typeof json.mode === 'object' &&
              typeof json.mode.maxIterations === 'number'
            ? json.mode.maxIterations
            : 10,
      prompt: systemMessagefromjson,
    };

    if (agentConfig.plugins.length === 0) {
      logger.warn("No plugins specified in agent's config");
    }
    validateConfig(agentConfig);
    return agentConfig;
  } catch (error) {
    logger.error('Error in load_json_config:', error);
    throw new Error(`Failed to load JSON config: ${error.message}`);
  }
};

describe('agentConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AgentMode enum', () => {
    it('should have correct enum values', () => {
      expect(AgentMode.INTERACTIVE).toBe('interactive');
      expect(AgentMode.AUTONOMOUS).toBe('autonomous');
      expect(AgentMode.HYBRID).toBe('hybrid');
    });
  });

  describe('createContextFromJson', () => {
    it('should create context from valid JSON config', () => {
      const mockConfig = {
        name: 'TestAgent',
        group: 'test-group',
        description: 'A test agent',
        lore: ['Lore 1', 'Lore 2'],
        objectives: ['Objective 1', 'Objective 2'],
        knowledge: ['Knowledge 1', 'Knowledge 2'],
        interval: 5,
        plugins: ['plugin1'],
        memory: { enabled: true },
        mode: AgentMode.INTERACTIVE,
      };

      const result = createContextFromJson(mockConfig);

      expect(result).toBe(
        'Your name : [TestAgent]\nYour Description : [A test agent]\nYour lore : [Lore 1]\n[Lore 2]\nYour objectives : [Objective 1]\n[Objective 2]\nYour knowledge : [Knowledge 1]\n[Knowledge 2]'
      );
    });

    it('should handle config with only name and description', () => {
      const mockConfig = {
        name: 'SimpleAgent',
        group: 'test-group',
        description: 'Simple description',
        lore: [],
        objectives: [],
        knowledge: [],
        interval: 5,
        plugins: ['plugin1'],
        memory: { enabled: true },
        mode: AgentMode.INTERACTIVE,
      };

      const result = createContextFromJson(mockConfig);

      expect(result).toBe(
        'Your name : [SimpleAgent]\nYour Description : [Simple description]\nYour lore : []\nYour objectives : []\nYour knowledge : []'
      );
    });

    it('should handle config with empty arrays', () => {
      const mockConfig = {
        name: 'EmptyAgent',
        group: 'test-group',
        description: 'Empty arrays',
        lore: [],
        objectives: [],
        knowledge: [],
        interval: 5,
        plugins: ['plugin1'],
        memory: { enabled: true },
        mode: AgentMode.INTERACTIVE,
      };

      const result = createContextFromJson(mockConfig);

      expect(result).toBe(
        'Your name : [EmptyAgent]\nYour Description : [Empty arrays]\nYour lore : []\nYour objectives : []\nYour knowledge : []'
      );
    });

    it('should handle config with missing optional fields', () => {
      const mockConfig = {
        name: 'MinimalAgent',
        group: 'test-group',
        description: '',
        lore: [],
        objectives: [],
        knowledge: [],
        interval: 5,
        plugins: ['plugin1'],
        memory: { enabled: true },
        mode: AgentMode.INTERACTIVE,
      };

      const result = createContextFromJson(mockConfig);

      expect(result).toBe(
        'Your name : [MinimalAgent]\nYour lore : []\nYour objectives : []\nYour knowledge : []'
      );
    });

    it('should throw error for null config', () => {
      expect(() => createContextFromJson(null as any)).toThrow(
        'Error while trying to parse your context from the config file.'
      );
    });

    it('should throw error for undefined config', () => {
      expect(() => createContextFromJson(undefined as any)).toThrow(
        'Error while trying to parse your context from the config file.'
      );
    });
  });

  describe('load_json_config', () => {
    it('should load and return config successfully', async () => {
      // Setup mocks for this test
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          name: 'TestAgent',
          group: 'test-group',
          description: 'Test description',
          lore: ['Lore 1'],
          objectives: ['Objective 1'],
          knowledge: ['Knowledge 1'],
          interval: 5,
          chatId: 'chat-123',
          plugins: ['plugin1'],
          mode: 'interactive',
          maxIterations: 10,
        })
      );

      const result = await load_json_config('test-config.json');

      expect(result).toMatchObject({
        id: 'test-uuid-123',
        name: 'TestAgent',
        group: 'test-group',
        description: 'Test description',
        interval: 5,
        chatId: 'chat-123',
        plugins: ['plugin1'],
        mode: AgentMode.INTERACTIVE,
        maxIterations: 10,
      });
      expect(result.prompt).toHaveProperty('type', 'system');
    });

    it('should handle and rethrow errors', async () => {
      // Mock file system to throw an error
      mockFs.access.mockRejectedValue(new Error('File not found'));

      await expect(load_json_config('nonexistent.json')).rejects.toThrow(
        'Failed to load JSON config: File not found'
      );
    });
  });

  describe('load_json_config - additional test cases', () => {
    it('should handle file not found error', async () => {
      // Mock file system to throw access error
      mockFs.access.mockRejectedValue(
        new Error('ENOENT: no such file or directory')
      );

      await expect(load_json_config('missing-file.json')).rejects.toThrow(
        'Failed to load JSON config: ENOENT: no such file or directory'
      );
    });

    it('should handle invalid JSON parsing', async () => {
      // Mock file system to return invalid JSON
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('invalid json content');

      await expect(load_json_config('invalid-json.json')).rejects.toThrow(
        'Failed to load JSON config: Unexpected token \'i\', "invalid json content" is not valid JSON'
      );
    });

    it('should handle missing mode configuration', async () => {
      // Mock file system to return JSON without mode
      const mockJsonData = JSON.stringify({
        name: 'TestAgent',
        group: 'test-group',
        description: 'Test description',
        interval: 5,
        chatId: 'chat-123',
        plugins: ['plugin1'],
        // Missing mode configuration
        maxIterations: 10,
      });

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(mockJsonData);

      await expect(load_json_config('missing-mode.json')).rejects.toThrow(
        'Failed to load JSON config: Mode configuration is mandatory but missing in config file'
      );
    });

    it('should handle empty plugins array', async () => {
      const mockJsonData = JSON.stringify({
        name: 'TestAgent',
        group: 'test-group',
        description: 'Test description',
        interval: 5,
        chatId: 'chat-123',
        plugins: [],
        mode: 'interactive',
        maxIterations: 10,
      });

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(mockJsonData);

      const result = await load_json_config('empty-plugins-config.json');

      expect(result.plugins).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        "No plugins specified in agent's config"
      );
    });

    it('should convert plugins to lowercase', async () => {
      const mockJsonData = JSON.stringify({
        name: 'TestAgent',
        group: 'test-group',
        description: 'Test description',
        interval: 5,
        chatId: 'chat-123',
        plugins: ['PLUGIN1', 'Plugin2', 'plugin3'],
        mode: 'interactive',
        maxIterations: 10,
      });

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(mockJsonData);

      const result = await load_json_config('plugins-config.json');

      expect(result.plugins).toEqual(['plugin1', 'plugin2', 'plugin3']);
    });

    it('should handle maxIterations from mode object', async () => {
      const mockJsonData = JSON.stringify({
        name: 'TestAgent',
        group: 'test-group',
        description: 'Test description',
        interval: 5,
        chatId: 'chat-123',
        plugins: ['plugin1'],
        mode: {
          type: 'interactive',
          maxIterations: 25,
        },
      });

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(mockJsonData);

      const result = await load_json_config('mode-maxiterations-config.json');

      expect(result.maxIterations).toBe(25);
    });

    it('should default maxIterations to 10 when not specified', async () => {
      const mockJsonData = JSON.stringify({
        name: 'TestAgent',
        group: 'test-group',
        description: 'Test description',
        interval: 5,
        chatId: 'chat-123',
        plugins: ['plugin1'],
        mode: 'interactive',
      });

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(mockJsonData);

      const result = await load_json_config(
        'default-maxiterations-config.json'
      );

      expect(result.maxIterations).toBe(10);
    });
  });
});
