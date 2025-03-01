"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveSignature = exports.approve = void 0;
const starknet_1 = require("starknet");
const interact_1 = require("../abis/interact");
const utils_1 = require("../utils/utils");
const approve = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const accountCredentials = agent.getAccountCredentials();
        const token = await (0, utils_1.validateToken)(provider, params.assetSymbol, params.assetAddress);
        const { address, amount } = (0, utils_1.validateAndFormatParams)(params.spenderAddress, params.amount, token.decimals);
        const spenderAddress = address;
        const account = new starknet_1.Account(provider, accountCredentials.accountPublicKey, accountCredentials.accountPrivateKey, undefined, starknet_1.constants.TRANSACTION_VERSION.V3);
        const contract = new starknet_1.Contract(interact_1.INTERACT_ERC20_ABI, token.address, provider);
        contract.connect(account);
        const calldata = contract.populate('approve', [spenderAddress, amount]);
        const txH = await (0, utils_1.executeV3Transaction)({
            call: calldata,
            account: account,
        });
        return JSON.stringify({
            status: 'success',
            amount: params.amount,
            symbol: token.symbol,
            spender_address: spenderAddress,
            transactionHash: txH,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
            step: 'transfer execution',
        });
    }
};
exports.approve = approve;
const approveSignature = async (params) => {
    try {
        const token = await (0, utils_1.validateToken)(new starknet_1.RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }), params.assetSymbol, params.assetAddress);
        const { address, amount } = (0, utils_1.validateAndFormatParams)(params.spenderAddress, params.amount, token.decimals);
        const spenderAddress = address;
        const result = {
            status: 'success',
            transactions: {
                contractAddress: token.address,
                entrypoint: 'approve',
                calldata: [spenderAddress, amount.low, amount.high],
            },
            additional_data: {
                symbol: token.symbol,
                amount: params.amount,
                spenderAddress: spenderAddress,
            },
        };
        return JSON.stringify({ transaction_type: 'INVOKE', results: [result] });
    }
    catch (error) {
        return JSON.stringify({
            status: 'error',
            error: {
                code: 'APPROVE_CALL_DATA_ERROR',
                message: error.message || 'Failed to generate approve call data',
            },
        });
    }
};
exports.approveSignature = approveSignature;
//# sourceMappingURL=approve.js.map