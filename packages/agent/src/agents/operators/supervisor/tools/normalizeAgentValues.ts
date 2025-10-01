import {
  AgentConfig,
  MemoryStrategy,
  McpServerConfig,
  DEFAULT_AGENT_CONFIG,
} from '@snakagent/core';

interface NormalizationResult {
  normalizedConfig: AgentConfig.Input;
  appliedDefaults: string[];
}

/**
 * Checks if a value is a plain object (not null, array, date, etc.)
 */
function isPlainObject(value: any): value is Record<string, any> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

/**
 * Normalizes a numeric value with a default fallback
 */
function normalizeNumericValue(
  value: number | null | undefined,
  defaultValue: number,
  propertyName: string
): { value: number; appliedDefault: string | null } {
  if (value === null || value === undefined) {
    return {
      value: defaultValue,
      appliedDefault: `${propertyName} set to default value (${defaultValue})`,
    };
  }

  if (!Number.isFinite(value) || value <= 0) {
    return {
      value: defaultValue,
      appliedDefault: `${propertyName} set to default value (${defaultValue})`,
    };
  }

  return { value, appliedDefault: null };
}

/**
 * Normalizes a boolean value with a default fallback
 */
function normalizeBooleanValue(
  value: boolean | null | undefined,
  defaultValue: boolean,
  propertyName: string
): { value: boolean; appliedDefault: string | null } {
  if (value === null || value === undefined) {
    return {
      value: defaultValue,
      appliedDefault: `${propertyName} set to default value (${defaultValue})`,
    };
  }

  return { value, appliedDefault: null };
}

/**
 * Normalizes a string value with a default fallback
 */
function normalizeStringValue(
  value: string | null | undefined,
  defaultValue: string,
  propertyName: string
): { value: string; appliedDefault: string | null } {
  if (value === null || value === undefined || value === '') {
    return {
      value: defaultValue,
      appliedDefault: `${propertyName} set to default value (${defaultValue})`,
    };
  }

  return { value, appliedDefault: null };
}

/**
 * Normalizes model configuration
 */
function normalizeModelConfig(
  model: Partial<AgentConfig.Input['graph']['model']> | null | undefined
): {
  config: AgentConfig.Input['graph']['model'];
  appliedDefaults: string[];
} {
  const appliedDefaults: string[] = [];

  if (model && isPlainObject(model)) {
    const config: AgentConfig.Input['graph']['model'] = {
      provider: DEFAULT_AGENT_CONFIG.graph.model.provider,
      model_name: DEFAULT_AGENT_CONFIG.graph.model.model_name,
      temperature: DEFAULT_AGENT_CONFIG.graph.model.temperature,
      max_tokens: DEFAULT_AGENT_CONFIG.graph.model.max_tokens,
    };

    // Normalize provider
    const providerResult = normalizeStringValue(
      model.provider,
      DEFAULT_AGENT_CONFIG.graph.model.provider,
      'model.provider'
    );
    config.provider = providerResult.value;
    if (providerResult.appliedDefault) {
      appliedDefaults.push(providerResult.appliedDefault);
    }

    // Normalize model_name
    const modelNameResult = normalizeStringValue(
      model.model_name,
      DEFAULT_AGENT_CONFIG.graph.model.model_name,
      'model.model_name'
    );
    config.model_name = modelNameResult.value;
    if (modelNameResult.appliedDefault) {
      appliedDefaults.push(modelNameResult.appliedDefault);
    }

    // Normalize temperature
    const temperatureResult = normalizeNumericValue(
      model.temperature,
      DEFAULT_AGENT_CONFIG.graph.model.temperature,
      'model.temperature'
    );
    config.temperature = temperatureResult.value;
    if (temperatureResult.appliedDefault) {
      appliedDefaults.push(temperatureResult.appliedDefault);
    }

    // Normalize max_tokens
    const maxTokensResult = normalizeNumericValue(
      model.max_tokens,
      DEFAULT_AGENT_CONFIG.graph.model.max_tokens,
      'model.max_tokens'
    );
    config.max_tokens = maxTokensResult.value;
    if (maxTokensResult.appliedDefault) {
      appliedDefaults.push(maxTokensResult.appliedDefault);
    }

    return { config, appliedDefaults };
  } else {
    appliedDefaults.push(`model initialized with default values`);
    return { config: { ...DEFAULT_AGENT_CONFIG.graph.model }, appliedDefaults };
  }
}

/**
 * Normalizes graph configuration
 */
function normalizeGraphConfig(
  graph: Partial<AgentConfig.Input['graph']> | null | undefined
): {
  config: AgentConfig.Input['graph'];
  appliedDefaults: string[];
} {
  const appliedDefaults: string[] = [];

  if (graph && isPlainObject(graph)) {
    const config: AgentConfig.Input['graph'] = {
      max_steps: DEFAULT_AGENT_CONFIG.graph.max_steps,
      max_iterations: DEFAULT_AGENT_CONFIG.graph.max_iterations,
      max_retries: DEFAULT_AGENT_CONFIG.graph.max_retries,
      execution_timeout_ms: DEFAULT_AGENT_CONFIG.graph.execution_timeout_ms,
      max_token_usage: DEFAULT_AGENT_CONFIG.graph.max_token_usage,
      model: DEFAULT_AGENT_CONFIG.graph.model,
    };

    const properties = [
      {
        key: 'max_steps',
        value: graph.max_steps,
        default: DEFAULT_AGENT_CONFIG.graph.max_steps,
      },
      {
        key: 'max_iterations',
        value: graph.max_iterations,
        default: DEFAULT_AGENT_CONFIG.graph.max_iterations,
      },
      {
        key: 'max_retries',
        value: graph.max_retries,
        default: DEFAULT_AGENT_CONFIG.graph.max_retries,
      },
      {
        key: 'execution_timeout_ms',
        value: graph.execution_timeout_ms,
        default: DEFAULT_AGENT_CONFIG.graph.execution_timeout_ms,
      },
      {
        key: 'max_token_usage',
        value: graph.max_token_usage,
        default: DEFAULT_AGENT_CONFIG.graph.max_token_usage,
      },
    ];

    properties.forEach(({ key, value, default: defaultValue }) => {
      const result = normalizeNumericValue(value, defaultValue, `graph.${key}`);
      (config as any)[key] = result.value;
      if (result.appliedDefault) {
        appliedDefaults.push(result.appliedDefault);
      }
    });

    // Normalize model
    const modelResult = normalizeModelConfig(graph.model);
    config.model = modelResult.config;
    appliedDefaults.push(...modelResult.appliedDefaults);

    return { config, appliedDefaults };
  } else {
    appliedDefaults.push(`graph initialized with default values`);
    return { config: { ...DEFAULT_AGENT_CONFIG.graph }, appliedDefaults };
  }
}

/**
 * Normalizes memory size limits configuration
 */
function normalizeMemorySizeLimits(
  sizeLimits:
    | Partial<AgentConfig.Input['memory']['size_limits']>
    | null
    | undefined
): {
  config: AgentConfig.Input['memory']['size_limits'];
  appliedDefaults: string[];
} {
  const appliedDefaults: string[] = [];

  if (sizeLimits && isPlainObject(sizeLimits)) {
    const config: AgentConfig.Input['memory']['size_limits'] = {
      short_term_memory_size:
        DEFAULT_AGENT_CONFIG.memory.size_limits.short_term_memory_size,
      max_insert_episodic_size:
        DEFAULT_AGENT_CONFIG.memory.size_limits.max_insert_episodic_size,
      max_insert_semantic_size:
        DEFAULT_AGENT_CONFIG.memory.size_limits.max_insert_semantic_size,
      max_retrieve_memory_size:
        DEFAULT_AGENT_CONFIG.memory.size_limits.max_retrieve_memory_size,
      limit_before_summarization:
        DEFAULT_AGENT_CONFIG.memory.size_limits.limit_before_summarization,
    };

    const properties = [
      {
        key: 'short_term_memory_size',
        value: sizeLimits.short_term_memory_size,
        default: DEFAULT_AGENT_CONFIG.memory.size_limits.short_term_memory_size,
      },
      {
        key: 'max_insert_episodic_size',
        value: sizeLimits.max_insert_episodic_size,
        default:
          DEFAULT_AGENT_CONFIG.memory.size_limits.max_insert_episodic_size,
      },
      {
        key: 'max_insert_semantic_size',
        value: sizeLimits.max_insert_semantic_size,
        default:
          DEFAULT_AGENT_CONFIG.memory.size_limits.max_insert_semantic_size,
      },
      {
        key: 'max_retrieve_memory_size',
        value: sizeLimits.max_retrieve_memory_size,
        default:
          DEFAULT_AGENT_CONFIG.memory.size_limits.max_retrieve_memory_size,
      },
      {
        key: 'limit_before_summarization',
        value: sizeLimits.limit_before_summarization,
        default:
          DEFAULT_AGENT_CONFIG.memory.size_limits.limit_before_summarization,
      },
    ];

    properties.forEach(({ key, value, default: defaultValue }) => {
      const result = normalizeNumericValue(
        value,
        defaultValue,
        `memory.size_limits.${key}`
      );
      (config as any)[key] = result.value;
      if (result.appliedDefault) {
        appliedDefaults.push(result.appliedDefault);
      }
    });

    return { config, appliedDefaults };
  } else {
    appliedDefaults.push(`memory.size_limits initialized with default values`);
    return {
      config: { ...DEFAULT_AGENT_CONFIG.memory.size_limits },
      appliedDefaults,
    };
  }
}

/**
 * Normalizes memory thresholds configuration
 */
function normalizeMemoryThresholds(
  thresholds:
    | Partial<AgentConfig.Input['memory']['thresholds']>
    | null
    | undefined
): {
  config: AgentConfig.Input['memory']['thresholds'];
  appliedDefaults: string[];
} {
  const appliedDefaults: string[] = [];

  if (thresholds && isPlainObject(thresholds)) {
    const config: AgentConfig.Input['memory']['thresholds'] = {
      insert_semantic_threshold:
        DEFAULT_AGENT_CONFIG.memory.thresholds.insert_semantic_threshold,
      insert_episodic_threshold:
        DEFAULT_AGENT_CONFIG.memory.thresholds.insert_episodic_threshold,
      retrieve_memory_threshold:
        DEFAULT_AGENT_CONFIG.memory.thresholds.retrieve_memory_threshold,
      hitl_threshold: DEFAULT_AGENT_CONFIG.memory.thresholds.hitl_threshold,
    };

    // Normalize each property
    const properties = [
      {
        key: 'insert_semantic_threshold',
        value: thresholds.insert_semantic_threshold,
        default:
          DEFAULT_AGENT_CONFIG.memory.thresholds.insert_semantic_threshold,
      },
      {
        key: 'insert_episodic_threshold',
        value: thresholds.insert_episodic_threshold,
        default:
          DEFAULT_AGENT_CONFIG.memory.thresholds.insert_episodic_threshold,
      },
      {
        key: 'retrieve_memory_threshold',
        value: thresholds.retrieve_memory_threshold,
        default:
          DEFAULT_AGENT_CONFIG.memory.thresholds.retrieve_memory_threshold,
      },
      {
        key: 'hitl_threshold',
        value: thresholds.hitl_threshold,
        default: DEFAULT_AGENT_CONFIG.memory.thresholds.hitl_threshold,
      },
    ];

    properties.forEach(({ key, value, default: defaultValue }) => {
      const result = normalizeNumericValue(
        value,
        defaultValue,
        `memory.thresholds.${key}`
      );
      (config as any)[key] = result.value;
      if (result.appliedDefault) {
        appliedDefaults.push(result.appliedDefault);
      }
    });

    return { config, appliedDefaults };
  } else {
    appliedDefaults.push(`memory.thresholds initialized with default values`);
    return {
      config: { ...DEFAULT_AGENT_CONFIG.memory.thresholds },
      appliedDefaults,
    };
  }
}

/**
 * Normalizes memory timeouts configuration
 */
function normalizeMemoryTimeouts(
  timeouts: Partial<AgentConfig.Input['memory']['timeouts']> | null | undefined
): {
  config: AgentConfig.Input['memory']['timeouts'];
  appliedDefaults: string[];
} {
  const appliedDefaults: string[] = [];

  if (timeouts && isPlainObject(timeouts)) {
    const config: AgentConfig.Input['memory']['timeouts'] = {
      retrieve_memory_timeout_ms:
        DEFAULT_AGENT_CONFIG.memory.timeouts.retrieve_memory_timeout_ms,
      insert_memory_timeout_ms:
        DEFAULT_AGENT_CONFIG.memory.timeouts.insert_memory_timeout_ms,
    };

    // Normalize each property
    const properties = [
      {
        key: 'retrieve_memory_timeout_ms',
        value: timeouts.retrieve_memory_timeout_ms,
        default:
          DEFAULT_AGENT_CONFIG.memory.timeouts.retrieve_memory_timeout_ms,
      },
      {
        key: 'insert_memory_timeout_ms',
        value: timeouts.insert_memory_timeout_ms,
        default: DEFAULT_AGENT_CONFIG.memory.timeouts.insert_memory_timeout_ms,
      },
    ];

    properties.forEach(({ key, value, default: defaultValue }) => {
      const result = normalizeNumericValue(
        value,
        defaultValue,
        `memory.timeouts.${key}`
      );
      (config as any)[key] = result.value;
      if (result.appliedDefault) {
        appliedDefaults.push(result.appliedDefault);
      }
    });

    return { config, appliedDefaults };
  } else {
    appliedDefaults.push(`memory.timeouts initialized with default values`);
    return {
      config: { ...DEFAULT_AGENT_CONFIG.memory.timeouts },
      appliedDefaults,
    };
  }
}

/**
 * Normalizes memory configuration
 */
function normalizeMemoryConfig(
  memory: Partial<AgentConfig.Input['memory']> | null | undefined
): {
  config: AgentConfig.Input['memory'];
  appliedDefaults: string[];
} {
  const appliedDefaults: string[] = [];

  if (memory && isPlainObject(memory)) {
    // Start with default values and override with provided values
    const config: AgentConfig.Input['memory'] = {
      ltm_enabled: DEFAULT_AGENT_CONFIG.memory.ltm_enabled,
      size_limits: DEFAULT_AGENT_CONFIG.memory.size_limits,
      thresholds: DEFAULT_AGENT_CONFIG.memory.thresholds,
      timeouts: DEFAULT_AGENT_CONFIG.memory.timeouts,
      strategy: DEFAULT_AGENT_CONFIG.memory.strategy,
    };

    // Normalize ltm_enabled
    const ltmEnabledResult = normalizeBooleanValue(
      memory.ltm_enabled,
      DEFAULT_AGENT_CONFIG.memory.ltm_enabled,
      'memory.ltm_enabled'
    );
    config.ltm_enabled = ltmEnabledResult.value;
    if (ltmEnabledResult.appliedDefault) {
      appliedDefaults.push(ltmEnabledResult.appliedDefault);
    }

    // Normalize strategy
    const strategyResult = normalizeStringValue(
      memory.strategy,
      DEFAULT_AGENT_CONFIG.memory.strategy,
      'memory.strategy'
    );
    config.strategy = strategyResult.value as MemoryStrategy;
    if (strategyResult.appliedDefault) {
      appliedDefaults.push(strategyResult.appliedDefault);
    }

    // Normalize size_limits
    const sizeLimitsResult = normalizeMemorySizeLimits(memory.size_limits);
    config.size_limits = sizeLimitsResult.config;
    appliedDefaults.push(...sizeLimitsResult.appliedDefaults);

    // Normalize thresholds
    const thresholdsResult = normalizeMemoryThresholds(memory.thresholds);
    config.thresholds = thresholdsResult.config;
    appliedDefaults.push(...thresholdsResult.appliedDefaults);

    // Normalize timeouts
    const timeoutsResult = normalizeMemoryTimeouts(memory.timeouts);
    config.timeouts = timeoutsResult.config;
    appliedDefaults.push(...timeoutsResult.appliedDefaults);

    return { config, appliedDefaults };
  } else {
    // Initialize with defaults
    appliedDefaults.push(`memory initialized with default values`);
    return { config: { ...DEFAULT_AGENT_CONFIG.memory }, appliedDefaults };
  }
}

/**
 * Normalizes RAG configuration
 */
function normalizeRagConfig(
  rag: Partial<AgentConfig.Input['rag']> | null | undefined
): {
  config: AgentConfig.Input['rag'];
  appliedDefaults: string[];
} {
  const appliedDefaults: string[] = [];

  if (rag && isPlainObject(rag)) {
    // Start with default values and override with provided values
    const config: AgentConfig.Input['rag'] = {
      enabled: DEFAULT_AGENT_CONFIG.rag.enabled,
      top_k: DEFAULT_AGENT_CONFIG.rag.top_k,
    };

    // Normalize enabled
    const enabledResult = normalizeBooleanValue(
      rag.enabled,
      DEFAULT_AGENT_CONFIG.rag.enabled || true,
      'rag.enabled'
    );
    config.enabled = enabledResult.value;
    if (enabledResult.appliedDefault) {
      appliedDefaults.push(enabledResult.appliedDefault);
    }

    // Normalize top_k
    const topKResult = normalizeNumericValue(
      rag.top_k,
      DEFAULT_AGENT_CONFIG.rag.top_k || 4,
      'rag.top_k'
    );
    config.top_k = topKResult.value;
    if (topKResult.appliedDefault) {
      appliedDefaults.push(topKResult.appliedDefault);
    }

    return { config, appliedDefaults };
  } else {
    // Initialize with defaults
    appliedDefaults.push(
      `rag initialized with default values (enabled: ${DEFAULT_AGENT_CONFIG.rag.enabled}, top_k: ${DEFAULT_AGENT_CONFIG.rag.top_k})`
    );
    return { config: { ...DEFAULT_AGENT_CONFIG.rag }, appliedDefaults };
  }
}

/**
 * Normalizes MCP servers configuration
 */
function normalizeMcpServersConfig(
  mcpServers: Partial<AgentConfig.Input['mcp_servers']> | null | undefined
): {
  config: AgentConfig.Input['mcp_servers'];
  appliedDefaults: string[];
} {
  const appliedDefaults: string[] = [];

  if (mcpServers && isPlainObject(mcpServers)) {
    const normalizedConfig: AgentConfig.Input['mcp_servers'] = {};

    for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
      if (
        serverConfig &&
        typeof serverConfig === 'object' &&
        !Array.isArray(serverConfig)
      ) {
        const configObj = serverConfig;
        const normalizedServerConfig: McpServerConfig = {};

        // Normalize command
        if (typeof configObj.command === 'string') {
          normalizedServerConfig.command = configObj.command;
        } else if (configObj.command !== undefined) {
          appliedDefaults.push(
            `mcp_servers.${serverName}.command normalized from invalid type to undefined`
          );
        }

        // Normalize args
        if (Array.isArray(configObj.args)) {
          normalizedServerConfig.args = configObj.args;
        } else if (configObj.args !== undefined) {
          appliedDefaults.push(
            `mcp_servers.${serverName}.args normalized from invalid type to undefined`
          );
        }

        // Normalize env
        if (
          configObj.env &&
          typeof configObj.env === 'object' &&
          !Array.isArray(configObj.env)
        ) {
          normalizedServerConfig.env = configObj.env as Record<string, string>;
        } else if (configObj.env !== undefined) {
          appliedDefaults.push(
            `mcp_servers.${serverName}.env normalized from invalid type to undefined`
          );
        }

        normalizedConfig[serverName] = normalizedServerConfig;
      } else {
        appliedDefaults.push(
          `mcp_servers.${serverName} skipped due to invalid configuration`
        );
      }
    }

    return { config: normalizedConfig, appliedDefaults };
  } else {
    appliedDefaults.push(`mcp_servers initialized with default values`);
    return { config: { ...DEFAULT_AGENT_CONFIG.mcp_servers }, appliedDefaults };
  }
}

/**
 * Normalizes agent configuration by applying default values
 * for invalid (negative or zero) numeric values, null, or undefined values
 * @param config - The configuration object to normalize (can be partial)
 * @returns Normalized configuration object with default values applied where needed
 */
export function normalizeNumericValues(
  config: Partial<AgentConfig.Input>
): NormalizationResult {
  // Start with default values - will be overridden by normalization logic
  const normalizedConfig: AgentConfig.Input = {
    profile: config.profile || DEFAULT_AGENT_CONFIG.profile,
    mcp_servers: { ...DEFAULT_AGENT_CONFIG.mcp_servers },
    plugins: config.plugins || [],
    graph: { ...DEFAULT_AGENT_CONFIG.graph },
    memory: { ...DEFAULT_AGENT_CONFIG.memory },
    rag: { ...DEFAULT_AGENT_CONFIG.rag },
  };
  const appliedDefaults: string[] = [];

  // Normalize MCP servers configuration
  const mcpServersResult = normalizeMcpServersConfig(config.mcp_servers);
  normalizedConfig.mcp_servers = mcpServersResult.config;
  appliedDefaults.push(...mcpServersResult.appliedDefaults);

  // Normalize graph configuration
  const graphResult = normalizeGraphConfig(config.graph);
  normalizedConfig.graph = graphResult.config;
  appliedDefaults.push(...graphResult.appliedDefaults);

  // Normalize memory configuration
  const memoryResult = normalizeMemoryConfig(config.memory);
  normalizedConfig.memory = memoryResult.config;
  appliedDefaults.push(...memoryResult.appliedDefaults);

  // Normalize RAG configuration
  const ragResult = normalizeRagConfig(config.rag);
  normalizedConfig.rag = ragResult.config;
  appliedDefaults.push(...ragResult.appliedDefaults);

  return { normalizedConfig, appliedDefaults };
}
