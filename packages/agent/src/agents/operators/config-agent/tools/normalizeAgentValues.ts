/**
 * Interface for memory configuration properties
 */
interface MemoryConfig {
  enabled?: boolean | null;
  shortTermMemorySize?: number | null;
  memorySize?: number | null;
}

/**
 * Interface for RAG configuration properties
 */
interface RagConfig {
  enabled?: boolean | null;
  topK?: number | null;
  embeddingModel?: string | null;
}

/**
 * Interface for the input configuration object
 */
interface AgentConfig {
  max_iterations?: number | null;
  interval?: number | null;
  memory?: MemoryConfig | null;
  rag?: RagConfig | null;
  [key: string]: any; // Allow for additional properties
}

/**
 * Interface for the normalized configuration result
 */
interface NormalizedAgentConfig extends AgentConfig {
  memory?: MemoryConfig;
  rag?: RagConfig;
}

/**
 * Interface for the function return value
 */
interface NormalizationResult {
  normalizedConfig: NormalizedAgentConfig;
  appliedDefaults: string[];
}

/**
 * Default configuration values
 */
const DEFAULT_VALUES = {
  max_iterations: 15,
  interval: 5,
  memory: {
    enabled: false,
    shortTermMemorySize: 5,
    memorySize: 20
  },
  rag: {
    enabled: false,
    topK: 4,
    embeddingModel: 'Xenova/all-MiniLM-L6-v2'
  }
} as const;

/**
 * Checks if a value is a plain object (not null, array, date, etc.)
 */
function isPlainObject(value: any): value is Record<string, any> {
  return value !== null && 
         typeof value === 'object' && 
         !Array.isArray(value) && 
         Object.prototype.toString.call(value) === '[object Object]';
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
    return { value: defaultValue, appliedDefault: `${propertyName} set to default value (${defaultValue})` };
  }
  
  if (!Number.isFinite(value) || value <= 0) {
    return { value: defaultValue, appliedDefault: `${propertyName} set to default value (${defaultValue})` };
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
    return { value: defaultValue, appliedDefault: `${propertyName} set to default value (${defaultValue})` };
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
  if (value === null || value === undefined) {
    return { value: defaultValue, appliedDefault: `${propertyName} set to default value (${defaultValue})` };
  }
  
  return { value, appliedDefault: null };
}

/**
 * Normalizes memory configuration
 */
function normalizeMemoryConfig(
  memory: MemoryConfig | null | undefined
): { config: MemoryConfig; appliedDefaults: string[] } {
  const appliedDefaults: string[] = [];
  
  if (memory && isPlainObject(memory)) {
    const config: MemoryConfig = { ...memory };
    
    // Normalize shortTermMemorySize
    const shortTermResult = normalizeNumericValue(
      memory.shortTermMemorySize,
      DEFAULT_VALUES.memory.shortTermMemorySize,
      'memory.shortTermMemorySize'
    );
    config.shortTermMemorySize = shortTermResult.value;
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
      `memory initialized with default values (enabled: ${DEFAULT_VALUES.memory.enabled}, shortTermMemorySize: ${DEFAULT_VALUES.memory.shortTermMemorySize}, memorySize: ${DEFAULT_VALUES.memory.memorySize})`
    );
    return { config: { ...DEFAULT_VALUES.memory }, appliedDefaults };
  }
}

/**
 * Normalizes RAG configuration
 */
function normalizeRagConfig(
  rag: RagConfig | null | undefined
): { config: RagConfig; appliedDefaults: string[] } {
  const appliedDefaults: string[] = [];
  
  if (rag && isPlainObject(rag)) {
    const config: RagConfig = { ...rag };
    
    // Normalize topK
    const topKResult = normalizeNumericValue(
      rag.topK,
      DEFAULT_VALUES.rag.topK,
      'rag.topK'
    );
    config.topK = topKResult.value;
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
      rag.embeddingModel,
      DEFAULT_VALUES.rag.embeddingModel,
      'rag.embeddingModel'
    );
    config.embeddingModel = embeddingModelResult.value;
    if (embeddingModelResult.appliedDefault) {
      appliedDefaults.push(embeddingModelResult.appliedDefault);
    }
    
    return { config, appliedDefaults };
  } else {
    // Initialize with defaults
    appliedDefaults.push(
      `rag initialized with default values (enabled: ${DEFAULT_VALUES.rag.enabled}, topK: ${DEFAULT_VALUES.rag.topK}, embeddingModel: ${DEFAULT_VALUES.rag.embeddingModel})`
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
  config: AgentConfig
): NormalizationResult {
  const normalizedConfig: NormalizedAgentConfig = { ...config } as NormalizedAgentConfig;
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
