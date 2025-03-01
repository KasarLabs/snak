"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLockedLiquidity = void 0;
const starknet_1 = require("starknet");
const unruggableFactory_1 = require("../abis/unruggableFactory");
const constants_1 = require("../constants");
const getLockedLiquidity = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const contract = new starknet_1.Contract(unruggableFactory_1.FACTORY_ABI, constants_1.FACTORY_ADDRESS, provider);
        const result = await contract.locked_liquidity(params.contractAddress);
        const liquidityInfo = {
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
            }
            else if ('StarkDeFiERC20' in liquidityData) {
                liquidityInfo.liquidityType = {
                    type: 'StarkDeFiERC20',
                    address: liquidityData.StarkDeFiERC20,
                };
            }
            else if ('EkuboNFT' in liquidityData) {
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
    }
    catch (error) {
        console.error('Error getting locked liquidity:', error);
        return {
            status: 'failed',
            error: error.message,
        };
    }
};
exports.getLockedLiquidity = getLockedLiquidity;
//# sourceMappingURL=getLockedLiquidity.js.map