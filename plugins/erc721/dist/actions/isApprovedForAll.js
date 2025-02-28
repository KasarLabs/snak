"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isApprovedForAll = void 0;
const starknet_1 = require("starknet");
const interact_1 = require("../abis/interact");
const starknet_2 = require("starknet");
const isApprovedForAll = async (agent, params) => {
    try {
        if (!params?.ownerAddress ||
            !params?.operatorAddress ||
            !params?.contractAddress) {
            throw new Error('Owner address, operator address and contract address are required');
        }
        const provider = agent.getProvider();
        const ownerAddress = (0, starknet_2.validateAndParseAddress)(params.ownerAddress);
        const operatorAddress = (0, starknet_2.validateAndParseAddress)(params.operatorAddress);
        const contractAddress = (0, starknet_2.validateAndParseAddress)(params.contractAddress);
        const contract = new starknet_1.Contract(interact_1.INTERACT_ERC721_ABI, contractAddress, provider);
        const approvedResponse = await contract.isApprovedForAll(ownerAddress, operatorAddress);
        return JSON.stringify({
            status: 'success',
            isApproved: approvedResponse === true,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.isApprovedForAll = isApprovedForAll;
//# sourceMappingURL=isApprovedForAll.js.map