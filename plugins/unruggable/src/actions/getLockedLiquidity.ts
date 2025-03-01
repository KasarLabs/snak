import { ContractAddressParams } from '../schema';
import { Contract } from 'starknet';
import { FACTORY_ABI } from '../abis/unruggableFactory';
import { FACTORY_ADDRESS } from '../constants';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

type LiquidityType =
  | { type: 'JediERC20'; address: string }
  | { type: 'StarkDeFiERC20'; address: string }
  | { type: 'EkuboNFT'; tokenId: number };

interface LockedLiquidityInfo {
  hasLockedLiquidity: boolean;
  liquidityType?: LiquidityType;
  liquidityContractAddress?: string;
}

/**
 * Retrieves locked liquidity information for a given token contract.
 *
 * This function checks if a token has locked liquidity in any of the supported DEXes
 * (Jediswap, StarkDeFi, or Ekubo) and returns detailed information about the
 * liquidity lock.
 *
 * @param {StarknetAgentInterface} agent - Starknet agent interface
 * @param {ContractAddressParams} params - Object containing the token contract address
 * @returns {Promise<GetLockedLiquiditySuccessResponse | GetLockedLiquidityErrorResponse>}
 *          Detailed information about locked liquidity or error response
 *
 * @example
 * ```typescript
 * // Check locked liquidity for a token
 * const result = await getLockedLiquidity({
 *   contractAddress: "0x123abc..."
 * });
 *
 * if (result.status === 'success') {
 *   if (result.data.hasLockedLiquidity) {
 *     console.log('Liquidity Contract:', result.data.liquidityContractAddress);
 *
 *     // Check liquidity type
 *     switch (result.data.liquidityType?.type) {
 *       case 'JediERC20':
 *         console.log('Jediswap LP Token:', result.data.liquidityType.address);
 *         break;
 *       case 'StarkDeFiERC20':
 *         console.log('StarkDeFi LP Token:', result.data.liquidityType.address);
 *         break;
 *       case 'EkuboNFT':
 *         console.log('Ekubo Position NFT ID:', result.data.liquidityType.tokenId);
 *         break;
 *     }
 *   } else {
 *     console.log('No locked liquidity found');
 *   }
 * } else {
 *   console.error('Check failed:', result.error);
 * }
 * ```
 *
 * @throws Will return error response if:
 * - Invalid contract address format
 * - Contract doesn't exist at the provided address
 * - RPC connection fails
 * - Contract call reverts
 *
 * @note
 * - This is a view function that doesn't modify state
 * - Different DEXes use different liquidity representations:
 *   * Jediswap: ERC20 LP tokens
 *   * StarkDeFi: ERC20 LP tokens
 *   * Ekubo: NFT position tokens
 * - Can be used to verify token safety before trading
 * - Useful for checking if a token's liquidity is locked
 */
export const getLockedLiquidity = async (
  agent: StarknetAgentInterface,
  params: ContractAddressParams
) => {
  try {
    const provider = agent.getProvider();
    const contract = new Contract(FACTORY_ABI, FACTORY_ADDRESS, provider);

    const result = await contract.locked_liquidity(params.contractAddress);
    const liquidityInfo: LockedLiquidityInfo = {
      hasLockedLiquidity: false,
    };

    if (result.length > 0) {
      const [contractAddress, liquidityData] = result;
      liquidityInfo.hasLockedLiquidity = true;
      liquidityInfo.liquidityContractAddress = contractAddress;

      if ('JediERC20' in liquidityData) {
        liquidityInfo.liquidityType = {
          type: 'JediERC20',
          address: liquidityData.JediERC20,
        };
      } else if ('StarkDeFiERC20' in liquidityData) {
        liquidityInfo.liquidityType = {
          type: 'StarkDeFiERC20',
          address: liquidityData.StarkDeFiERC20,
        };
      } else if ('EkuboNFT' in liquidityData) {
        liquidityInfo.liquidityType = {
          type: 'EkuboNFT',
          tokenId: Number(liquidityData.EkuboNFT),
        };
      }
    }

    return {
      status: 'success',
      data: liquidityInfo,
    };
  } catch (error) {
    console.error('Error getting locked liquidity:', error);
    return {
      status: 'failed',
      error: error.message,
    };
  }
};
