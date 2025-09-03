/**
 * Default configurations for the agent system
 */

import {
  DEFAULT_MODELS,
  MEMORY_THRESHOLDS,
  MODEL_TIMEOUTS,
  VALIDATION_LIMITS,
} from '@agents/modes/constants.js';

/**
 * Default system configurations
 */
export const DEFAULT_CONFIG = {
  ...MODEL_TIMEOUTS,
  ...MEMORY_THRESHOLDS,
  ...DEFAULT_MODELS,
  ...VALIDATION_LIMITS,
} as const;

/**
 * Environment-specific configurations
 */
export const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development';

  const configs: Record<
    'development' | 'production' | 'test',
    typeof DEFAULT_CONFIG & { DEBUG: boolean; LOG_LEVEL: string }
  > = {
    development: {
      ...DEFAULT_CONFIG,
      DEBUG: true,
      LOG_LEVEL: 'debug',
    },
    production: {
      ...DEFAULT_CONFIG,
      DEBUG: false,
      LOG_LEVEL: 'info',
    },
    test: {
      ...DEFAULT_CONFIG,
      DEBUG: false,
      LOG_LEVEL: 'error',
    },
  };

  return configs[env as keyof typeof configs] || configs.development;
};
