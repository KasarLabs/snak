/**
 * Interface for memory configuration properties
 */
interface MemoryConfig {
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
 * Normalizes numeric values in agent configuration by applying default values
 * for invalid (negative or zero) numeric values
 * @param config - The configuration object to normalize
 * @returns Normalized configuration object with default values applied where needed
 */
export function normalizeNumericValues(
  config: AgentConfig
): NormalizationResult {
  const normalizedConfig: NormalizedAgentConfig = JSON.parse(
    JSON.stringify(config)
  ) as NormalizedAgentConfig;
  const appliedDefaults: string[] = [];

  // Normalize max_iterations
  if (config.max_iterations !== undefined && config.max_iterations !== null) {
    if (!Number.isFinite(config.max_iterations) || config.max_iterations <= 0) {
      normalizedConfig.max_iterations = 15;
      appliedDefaults.push(`max_iterations set to default value (15)`);
    }
  }

  // Normalize interval
  if (config.interval !== undefined && config.interval !== null) {
    if (!Number.isFinite(config.interval) || config.interval <= 0) {
      normalizedConfig.interval = 5;
      appliedDefaults.push(`interval set to default value (5)`);
    }
  }

  // Normalize memory configuration
  if (config.memory && typeof config.memory === 'object') {
    normalizedConfig.memory = JSON.parse(JSON.stringify(config.memory));

    if (
      config.memory.shortTermMemorySize !== undefined &&
      config.memory.shortTermMemorySize !== null
    ) {
      if (
        typeof config.memory.shortTermMemorySize !== 'number' ||
        config.memory.shortTermMemorySize <= 0
      ) {
        normalizedConfig.memory!.shortTermMemorySize = 5;
        appliedDefaults.push(
          `memory.shortTermMemorySize set to default value (5)`
        );
      }
    }

    if (
      config.memory.memorySize !== undefined &&
      config.memory.memorySize !== null
    ) {
      if (
        typeof config.memory.memorySize !== 'number' ||
        config.memory.memorySize <= 0
      ) {
        normalizedConfig.memory!.memorySize = 20;
        appliedDefaults.push(`memory.memorySize set to default value (20)`);
      } else {
        normalizedConfig.memory!.memorySize = config.memory.memorySize;
      }
    }
  }

  // Normalize RAG configuration
  if (config.rag && typeof config.rag === 'object') {
    if (!normalizedConfig.rag) {
      normalizedConfig.rag = {};
    }

    if (config.rag.topK !== undefined && config.rag.topK !== null) {
      if (typeof config.rag.topK !== 'number' || config.rag.topK <= 0) {
        normalizedConfig.rag.topK = 10;
        appliedDefaults.push(`rag.topK set to default value (10)`);
      } else {
        normalizedConfig.rag.topK = config.rag.topK;
      }
    }

    // Handle enabled property
    if (config.rag.enabled !== undefined && config.rag.enabled !== null) {
      normalizedConfig.rag.enabled = config.rag.enabled;
    }

    // Handle embeddingModel property
    if (
      config.rag.embeddingModel !== undefined &&
      config.rag.embeddingModel !== null
    ) {
      normalizedConfig.rag.embeddingModel = config.rag.embeddingModel;
    }
  }
  return { normalizedConfig, appliedDefaults };
}
