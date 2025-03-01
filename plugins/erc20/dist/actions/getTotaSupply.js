"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTotalSupply = void 0;
const starknet_1 = require("starknet");
const interact_1 = require("../abis/interact");
const utils_1 = require("../utils/utils");
const getTotalSupply = async (agent, params) => {
    try {
        const token = await (0, utils_1.validateToken)(agent.getProvider(), params.assetSymbol, params.assetAddress);
        const provider = agent.getProvider();
        const tokenContract = new starknet_1.Contract(interact_1.INTERACT_ERC20_ABI, token.address, provider);
        const totalSupply = await tokenContract.total_supply();
        const formattedSupply = (0, utils_1.formatBalance)(totalSupply, token.decimals);
        return JSON.stringify({
            status: 'success',
            totalSupply: formattedSupply,
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
exports.getTotalSupply = getTotalSupply;
//# sourceMappingURL=getTotaSupply.js.map