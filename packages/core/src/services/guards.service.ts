import { loadGuardsConfig } from '../config/guards/guardLoader.js';
import { GuardsConfig } from '../config/guards/guardsSchema.js';
import logger from '../logger/logger.js';

/**
 * Global guards configuration and state
 */
let guardsConfig: GuardsConfig | null = null;
let configPath: string | null = null;

/**
 * Service for managing guards configuration
 * Provides a centralized way to access and manage guards configuration
 */
export class GuardsService {
  private static instance: GuardsService | null = null;

  private constructor() {}

  /**
   * Get the singleton instance of GuardsService
   * @returns GuardsService instance
   */
  public static getInstance(): GuardsService {
    if (!GuardsService.instance) {
      GuardsService.instance = new GuardsService();
    }
    return GuardsService.instance;
  }

  /**
   * Initialize the guards service with a configuration file path
   * @param configPath - Path to the guards configuration file
   * @throws Error if the configuration cannot be loaded
   */
  public initialize(configPathParam: string): void {
    try {
      configPath = configPathParam;
      guardsConfig = loadGuardsConfig(configPathParam);
      logger.debug('GuardsService initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize GuardsService: ${error}`);
      throw error;
    }
  }

  /**
   * Get the guards configuration
   * @returns GuardsConfig object
   * @throws Error if the service is not initialized
   */
  public getGuardsConfig(): GuardsConfig {
    if (!guardsConfig) {
      throw new Error(
        'GuardsService is not initialized. Call initialize() first.'
      );
    }
    return guardsConfig;
  }

  /**
   * Check if the service is initialized
   * @returns boolean indicating if the service is initialized
   */
  public isInitialized(): boolean {
    return guardsConfig !== null;
  }

  /**
   * Reload the configuration from the file
   * @throws Error if the configuration cannot be reloaded
   */
  public reload(): void {
    if (!configPath) {
      throw new Error(
        'Cannot reload: no config path was provided during initialization'
      );
    }
    this.initialize(configPath);
  }

  /**
   * Get a specific guard configuration by path
   * @param path - Dot-separated path to the guard configuration (e.g., 'agents.name_max_length')
   * @returns The value at the specified path
   * @throws Error if the path is invalid or service is not initialized
   */
  public getGuardValue(path: string): any {
    if (!guardsConfig) {
      throw new Error(
        'GuardsService is not initialized. Call initialize() first.'
      );
    }

    const keys = path.split('.');
    let current: any = guardsConfig;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        throw new Error(`Invalid guard path: ${path}`);
      }
    }

    return current;
  }
}

// ============================================================================
// GLOBAL FUNCTIONS - Direct access to guards without class instantiation
// ============================================================================

/**
 * Initialize the global guards service
 * @param configPath - Path to the guards configuration file
 * @throws Error if the configuration cannot be loaded
 */
export function initializeGuards(configPath: string): void {
  GuardsService.getInstance().initialize(configPath);
}

/**
 * Get the guards configuration globally
 * @returns GuardsConfig object
 * @throws Error if the service is not initialized
 */
export function getGuardsConfig(): GuardsConfig {
  if (!guardsConfig) {
    throw new Error(
      'GuardsService is not initialized. Call initializeGuards() first.'
    );
  }
  return guardsConfig;
}

/**
 * Check if the guards service is initialized globally
 * @returns boolean indicating if the service is initialized
 */
export function isGuardsInitialized(): boolean {
  return guardsConfig !== null;
}

/**
 * Reload the guards configuration from the file
 * @throws Error if the configuration cannot be reloaded
 */
export function reloadGuards(): void {
  GuardsService.getInstance().reload();
}

/**
 * Get a specific guard configuration by path (global function)
 * @param path - Dot-separated path to the guard configuration (e.g., 'agents.name_max_length')
 * @returns The value at the specified path
 * @throws Error if the path is invalid or service is not initialized
 */
export function getGuardValue(path: string): any {
  if (!guardsConfig) {
    throw new Error(
      'GuardsService is not initialized. Call initializeGuards() first.'
    );
  }

  const keys = path.split('.');
  let current: any = guardsConfig;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      throw new Error(`Invalid guard path: ${path}`);
    }
  }

  return current;
}
