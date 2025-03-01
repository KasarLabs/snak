"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllowanceGivenToMe = exports.getMyGivenAllowance = exports.getAllowance = void 0;
const starknet_1 = require("starknet");
const interact_1 = require("../abis/interact");
const utils_1 = require("../utils/utils");
const getAllowance = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const token = await (0, utils_1.validateToken)(provider, params.assetSymbol, params.assetAddress);
        const tokenContract = new starknet_1.Contract(interact_1.INTERACT_ERC20_ABI, token.address, provider);
        const allowanceResponse = await tokenContract.allowance(params.ownerAddress, params.spenderAddress);
        return JSON.stringify({
            status: 'success',
            owner: params.ownerAddress,
            spender: params.spenderAddress,
            allowance: (0, utils_1.formatBalance)(allowanceResponse, token.decimals),
            symbol: token.symbol,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getAllowance = getAllowance;
const getMyGivenAllowance = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const ownerAddress = agent.getAccountCredentials().accountPublicKey;
        const token = await (0, utils_1.validateToken)(provider, params.assetSymbol, params.assetAddress);
        const tokenContract = new starknet_1.Contract(interact_1.INTERACT_ERC20_ABI, token.address, provider);
        const allowanceResponse = await tokenContract.allowance(ownerAddress, params.spenderAddress);
        return JSON.stringify({
            status: 'success',
            owner: ownerAddress,
            spender: params.spenderAddress,
            allowance: (0, utils_1.formatBalance)(allowanceResponse, token.decimals),
            symbol: token.symbol,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getMyGivenAllowance = getMyGivenAllowance;
const getAllowanceGivenToMe = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const spenderAddress = agent.getAccountCredentials().accountPublicKey;
        const token = await (0, utils_1.validateToken)(provider, params.assetSymbol, params.assetAddress);
        const tokenContract = new starknet_1.Contract(interact_1.INTERACT_ERC20_ABI, token.address, provider);
        const allowanceResponse = await tokenContract.allowance(params.ownerAddress, spenderAddress);
        return JSON.stringify({
            status: 'success',
            owner: params.ownerAddress,
            spender: spenderAddress,
            allowance: (0, utils_1.formatBalance)(allowanceResponse, token.decimals),
            symbol: token.symbol,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getAllowanceGivenToMe = getAllowanceGivenToMe;
//# sourceMappingURL=getAllowance.js.map