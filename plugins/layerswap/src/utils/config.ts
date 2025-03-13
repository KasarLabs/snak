/**
 * Configuration utilities for Layerswap plugin
 */

/**
 * Gets the Layerswap API key from environment variables
 *
 * @returns {string} The Layerswap API key
 * @throws {Error} If the API key is not set
 */
export const getLayerswapApiKey = (): string => {
  const apiKey = process.env.LAYERSWAP_API_KEY;

  if (!apiKey) {
    throw new Error('LAYERSWAP_API_KEY environment variable is not set');
  }

  return apiKey;
};

/**
 * Gets the Layerswap base URL from environment variables or returns the default
 *
 * @returns {string} The Layerswap base URL
 */
export const getLayerswapBaseUrl = (): string => {
  console.log("getLayerswapbaseurl")
  return process.env.LAYERSWAP_BASE_URL || 'https://api.layerswap.io/api/v2';
};
