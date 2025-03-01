"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMemecoin = void 0;
const starknet_1 = require("starknet");
const helper_1 = require("../utils/helper");
const starknet_2 = require("starknet");
const createMemecoin = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const accountCredentials = agent.getAccountCredentials();
        const account = new starknet_2.Account(provider, accountCredentials.accountPublicKey, accountCredentials.accountPrivateKey);
        const salt = starknet_1.stark.randomAddress();
        const { transaction_hash } = await (0, helper_1.execute)('create_memecoin', agent, [
            params.owner,
            params.name,
            params.symbol,
            starknet_1.uint256.bnToUint256(BigInt(params.initialSupply) * BigInt((0, helper_1.decimalsScale)(18))),
            salt,
        ], provider);
        await provider.waitForTransaction(transaction_hash);
        return JSON.stringify({
            status: 'success',
            transactionHash: transaction_hash,
        });
    }
    catch (error) {
        console.error('Error creating memecoin:', error);
        return {
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
exports.createMemecoin = createMemecoin;
//# sourceMappingURL=createMemecoin.js.map