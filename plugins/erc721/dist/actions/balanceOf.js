"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBalance = void 0;
const starknet_1 = require("starknet");
const interact_1 = require("../abis/interact");
const starknet_2 = require("starknet");
const getBalance = async (agent, params) => {
    try {
        if (!params?.accountAddress || !params?.contractAddress) {
            throw new Error('Both account address and contract address are required');
        }
        const provider = agent.getProvider();
        const accountAddress = (0, starknet_2.validateAndParseAddress)(params.accountAddress);
        const contractAddress = (0, starknet_2.validateAndParseAddress)(params.contractAddress);
        const contract = new starknet_1.Contract(interact_1.INTERACT_ERC721_ABI, contractAddress, provider);
        const balanceResponse = await contract.balanceOf(accountAddress);
        return JSON.stringify({
            status: 'success',
            balance: balanceResponse.toString(),
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getBalance = getBalance;
//# sourceMappingURL=balanceOf.js.map