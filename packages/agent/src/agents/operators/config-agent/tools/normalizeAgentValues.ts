/**
 * Interface for memory configuration properties (input - can contain null)
 */
interface InputMemoryConfig {
  enabled?: boolean | null;
  shortTermMemorySize?: number | null;
  memorySize?: number | null;
}

/**
 * Interface for RAG configuration properties (input - can contain null)
 */
interface InputRagConfig {
  enabled?: boolean | null;
  topK?: number | null;
  embeddingModel?: string | null;
}

/**
 * Interface for the input configuration object (can contain null values)
 */
interface InputAgentConfig {
  max_iterations?: number | null;
  interval?: number | null;
  mode?: string | null;
  memory?: InputMemoryConfig | null;
  rag?: InputRagConfig | null;
  [key: string]: any; // Allow for additional properties
}

/**
 * Interface for memory configuration properties (output - guaranteed non-null)
 */
export interface OutputMemoryConfig {
  enabled: boolean;
  shortTermMemorySize: number;
  memorySize: number;
}

/**
 * Interface for RAG configuration properties (output - guaranteed non-null)
 */
export interface OutputRagConfig {
  enabled: boolean;
  topK: number;
  embeddingModel: string;
}

/**
 * Interface for the normalized configuration result (guaranteed non-null values)
 */
export interface OutputAgentConfig {
  max_iterations: number;
  interval: number;
  mode: string;
  memory: OutputMemoryConfig;
  rag: OutputRagConfig;
  [key: string]: any; // Allow for additional properties
}

/**
 * Interface for the function return value
 */
interface NormalizationResult {
  normalizedConfig: OutputAgentConfig;
  appliedDefaults: string[];
}

/**
 * Default configuration values
 */
const DEFAULT_VALUES = {
  max_iterations: 15,
  interval: 5,
  mode: 'interactive',
  memory: {
    enabled: false,
    shortTermMemorySize: 5,
    memorySize: 20,
  },
  rag: {
    enabled: false,
    topK: 4,
    embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  },
} as const;

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
 * Normalizes memory configuration
 */
function normalizeMemoryConfig(memory: InputMemoryConfig | null | undefined): {
  config: OutputMemoryConfig;
  appliedDefaults: string[];
} {
  const appliedDefaults: string[] = [];

  if (memory && isPlainObject(memory)) {
    // Start with default values and override with provided values
    const config: OutputMemoryConfig = {
      enabled: DEFAULT_VALUES.memory.enabled,
      shortTermMemorySize: DEFAULT_VALUES.memoryshort_term_memory_size,
      memorySize: DEFAULT_VALUES.memory.memorySize,
    };

    // Normalize shortTermMemorySize
    const shortTermResult = normalizeNumericValue(
      memoryshort_term_memory_size,
      DEFAULT_VALUES.memoryshort_term_memory_size,
      'memoryshort_term_memory_size'
    );
    configshort_term_memory_size = shortTermResult.value;
    if (shortTermResult.appliedDefault) {
      appliedDefaults.push(shortTermResult.appliedDefault);
    }

    // Normalize memorySize
    const memorySizeResult = normalizeNumericValue(
      memory.memorySize,
      DEFAULT_VALUES.memory.memorySize,
      'memory.memorySize'
    );
    config.memorySize = memorySizeResult.value;
    if (memorySizeResult.appliedDefault) {
      appliedDefaults.push(memorySizeResult.appliedDefault);
    }

    // Normalize enabled
    const enabledResult = normalizeBooleanValue(
      memory.enabled,
      DEFAULT_VALUES.memory.enabled,
      'memory.enabled'
    );
    config.enabled = enabledResult.value;
    if (enabledResult.appliedDefault) {
      appliedDefaults.push(enabledResult.appliedDefault);
    }

    return { config, appliedDefaults };
  } else {
    // Initialize with defaults
    appliedDefaults.push(
      `memory initialized with default values (enabled: ${DEFAULT_VALUES.memory.enabled}, shortTermMemorySize: ${DEFAULT_VALUES.memoryshort_term_memory_size}, memorySize: ${DEFAULT_VALUES.memory.memorySize})`
    );
    return { config: { ...DEFAULT_VALUES.memory }, appliedDefaults };
  }
}

/**
 * Normalizes RAG configuration
 */
function normalizeRagConfig(rag: InputRagConfig | null | undefined): {
  config: OutputRagConfig;
  appliedDefaults: string[];
} {
  const appliedDefaults: string[] = [];

  if (rag && isPlainObject(rag)) {
    // Start with default values and override with provided values
    const config: OutputRagConfig = {
      enabled: DEFAULT_VALUES.rag.enabled,
      topK: DEFAULT_VALUES.rag.top_k,
      embeddingModel: DEFAULT_VALUES.rag.embedding_model,
    };

    // Normalize topK
    const topKResult = normalizeNumericValue(
      rag.top_k,
      DEFAULT_VALUES.rag.top_k,
      'rag.top_k'
    );
    config.top_k = topKResult.value;
    if (topKResult.appliedDefault) {
      appliedDefaults.push(topKResult.appliedDefault);
    }

    // Normalize enabled
    const enabledResult = normalizeBooleanValue(
      rag.enabled,
      DEFAULT_VALUES.rag.enabled,
      'rag.enabled'
    );
    config.enabled = enabledResult.value;
    if (enabledResult.appliedDefault) {
      appliedDefaults.push(enabledResult.appliedDefault);
    }

    // Normalize embeddingModel
    const embeddingModelResult = normalizeStringValue(
      rag.embedding_model,
      DEFAULT_VALUES.rag.embedding_model,
      'rag.embedding_model'
    );
    config.embedding_model = embeddingModelResult.value;
    if (embeddingModelResult.appliedDefault) {
      appliedDefaults.push(embeddingModelResult.appliedDefault);
    }

    return { config, appliedDefaults };
  } else {
    // Initialize with defaults
    appliedDefaults.push(
      `rag initialized with default values (enabled: ${DEFAULT_VALUES.rag.enabled}, topK: ${DEFAULT_VALUES.rag.top_k}, embeddingModel: ${DEFAULT_VALUES.rag.embedding_model})`
    );
    return { config: { ...DEFAULT_VALUES.rag }, appliedDefaults };
  }
}

/**
 * Normalizes numeric values in agent configuration by applying default values
 * for invalid (negative or zero) numeric values, null, or undefined values
 * @param config - The configuration object to normalize
 * @returns Normalized configuration object with default values applied where needed
 */
export function normalizeNumericValues(
  config: InputAgentConfig
): NormalizationResult {
  // Start with default values - will be overridden by normalization logic
  const normalizedConfig: OutputAgentConfig = {
    max_iterations: DEFAULT_VALUES.max_iterations,
    interval: DEFAULT_VALUES.interval,
    mode: DEFAULT_VALUES.mode,
    memory: {
      enabled: DEFAULT_VALUES.memory.enabled,
      shortTermMemorySize: DEFAULT_VALUES.memoryshort_term_memory_size,
      memorySize: DEFAULT_VALUES.memory.memorySize,
    },
    rag: {
      enabled: DEFAULT_VALUES.rag.enabled,
      topK: DEFAULT_VALUES.rag.top_k,
      embeddingModel: DEFAULT_VALUES.rag.embedding_model,
    },
  };
  const appliedDefaults: string[] = [];

  // Normalize max_iterations
  const maxIterationsResult = normalizeNumericValue(
    config.max_iterations,
    DEFAULT_VALUES.max_iterations,
    'max_iterations'
  );
  normalizedConfig.max_iterations = maxIterationsResult.value;
  if (maxIterationsResult.appliedDefault) {
    appliedDefaults.push(maxIterationsResult.appliedDefault);
  }

  // Normalize interval
  const intervalResult = normalizeNumericValue(
    config.interval,
    DEFAULT_VALUES.interval,
    'interval'
  );
  normalizedConfig.interval = intervalResult.value;
  if (intervalResult.appliedDefault) {
    appliedDefaults.push(intervalResult.appliedDefault);
  }

  // Normalize mode
  const modeResult = normalizeStringValue(
    config.mode,
    DEFAULT_VALUES.mode,
    'mode'
  );
  normalizedConfig.mode = modeResult.value;
  if (modeResult.appliedDefault) {
    appliedDefaults.push(modeResult.appliedDefault);
  }

  // Normalize memory configuration
  const memoryResult = normalizeMemoryConfig(config.memory);
  normalizedConfig.memory = memoryResult.config;
  appliedDefaults.push(...memoryResult.appliedDefaults);

  // Normalize RAG configuration
  const ragResult = normalizeRagConfig(config.rag);
  normalizedConfig.rag = ragResult.config;
  appliedDefaults.push(...ragResult.appliedDefaults);

  // Copy any additional properties from the input config
  Object.keys(config).forEach((key) => {
    if (
      !['max_iterations', 'interval', 'mode', 'memory', 'rag'].includes(key)
    ) {
      (normalizedConfig as any)[key] = config[key];
    }
  });

  return { normalizedConfig, appliedDefaults };
}
