// import axios from 'axios';
// import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
// import { GetAvailableRoutesParams } from '../schema/index.js';
// import { getLayerswapApiKey, getLayerswapBaseUrl } from '../utils/config';

// /**
//  * Gets available routes for bridging
//  *
//  * @param {StarknetAgentInterface} agent - Starknet agent
//  * @param {GetAvailableRoutesParams} params - Request parameters
//  * @returns {Promise<{status: string, routes?: any[], error?: any}>} Available routes
//  */
// export const layerswap_get_available_routes = async (
//   agent: StarknetAgentInterface,
//   params: GetAvailableRoutesParams
// ) => {
//   try {
//     const apiKey = getLayerswapApiKey();
//     const baseUrl = getLayerswapBaseUrl();

//     const response = await axios.get(`${baseUrl}/networks`, {
//       headers: {
//         'X-LS-APIKEY': apiKey,
//         Accept: 'application/json',
//       },
//     });

//     if (
//       !response.data ||
//       !response.data.data ||
//       !Array.isArray(response.data.data)
//     ) {
//       throw new Error('Unexpected API response format');
//     }

//     const networks = response.data.data;

//     const sourceNetworkUpper = params.source_network.toUpperCase();

//     // Filter by source network
//     let routes = networks.filter(
//       (network: any) => network.name.toUpperCase() === sourceNetworkUpper
//     );

//     // Filter the results

//     return {
//       status: 'success',
//       routes,
//     };
//   } catch (error) {
//     console.error('Error getting available routes:', error);
//     return {
//       status: 'error',
//       error,
//     };
//   }
// };
