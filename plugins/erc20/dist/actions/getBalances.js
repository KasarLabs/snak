"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBalance = exports.getOwnBalance = void 0;
const starknet_1 = require("starknet");
const interact_1 = require("../abis/interact");
const utils_1 = require("../utils/utils");
const getOwnBalance = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const accountCredentials = agent.getAccountCredentials();
        const accountAddress = accountCredentials?.accountPublicKey;
        const accountPrivateKey = accountCredentials?.accountPrivateKey;
        const token = await (0, utils_1.validateToken)(provider, params.assetSymbol, params.assetAddress);
        if (!accountAddress) {
            throw new Error('Wallet address not configured');
        }
        const account = new starknet_1.Account(provider, accountAddress, accountPrivateKey);
        const tokenContract = new starknet_1.Contract(interact_1.INTERACT_ERC20_ABI, token.address, provider);
        const balanceResponse = await tokenContract.balanceOf(account.address);
        if (balanceResponse === undefined || balanceResponse === null) {
            throw new Error('No balance value received from contract');
        }
        const formattedBalance = (0, utils_1.formatBalance)(balanceResponse, token.decimals);
        return JSON.stringify({
            status: 'success',
            balance: formattedBalance,
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
exports.getOwnBalance = getOwnBalance;
const getBalance = async (agent, params) => {
    try {
        if (!params?.accountAddress) {
            throw new Error('Account address are required');
        }
        const token = await (0, utils_1.validateToken)(agent.getProvider(), params.assetSymbol, params.assetAddress);
        const provider = agent.getProvider();
        const tokenContract = new starknet_1.Contract(interact_1.INTERACT_ERC20_ABI, token.address, provider);
        const balanceResponse = await tokenContract.balanceOf(params.accountAddress);
        const balanceValue = typeof balanceResponse === 'object' && 'balance' in balanceResponse
            ? balanceResponse.balance
            : balanceResponse;
        const formattedBalance = (0, utils_1.formatBalance)(balanceValue, token.decimals);
        return JSON.stringify({
            status: 'success',
            balance: formattedBalance,
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
exports.getBalance = getBalance;
//# sourceMappingURL=getBalances.js.map