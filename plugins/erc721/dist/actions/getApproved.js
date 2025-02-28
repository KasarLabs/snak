"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApproved = void 0;
const starknet_1 = require("starknet");
const interact_1 = require("../abis/interact");
const utils_1 = require("../utils/utils");
const starknet_2 = require("starknet");
const getApproved = async (agent, params) => {
    try {
        if (!params?.tokenId || !params?.contractAddress) {
            throw new Error('Both token ID and contract address are required');
        }
        const provider = agent.getProvider();
        const contractAddress = (0, starknet_2.validateAndParseAddress)(params.contractAddress);
        const tokenId = (0, utils_1.validateAndFormatTokenId)(params.tokenId);
        const contract = new starknet_1.Contract(interact_1.INTERACT_ERC721_ABI, contractAddress, provider);
        const approvedResponse = await contract.getApproved(tokenId);
        return JSON.stringify({
            status: 'success',
            approved: approvedResponse.toString(),
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getApproved = getApproved;
//# sourceMappingURL=getApproved.js.map