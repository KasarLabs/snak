import { ProviderInterface } from 'starknet';

/**
 * Base class for utility functions
 * @property {ProviderInterface} provider - The Starknet provider instance
 */
export interface BaseUtilityClass {
  provider: ProviderInterface;
}
