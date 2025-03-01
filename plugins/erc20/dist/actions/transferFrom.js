"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferFromSignature = exports.transferFrom = void 0;
const starknet_1 = require("starknet");
const interact_1 = require("../abis/interact");
const utils_1 = require("../utils/utils");
const starknet_2 = require("starknet");
const transferFrom = async (agent, params) => {
    try {
        const credentials = agent.getAccountCredentials();
        const provider = agent.getProvider();
        const token = await (0, utils_1.validateToken)(provider, params.assetSymbol, params.assetAddress);
        const { address, amount } = (0, utils_1.validateAndFormatParams)(params.fromAddress, params.amount, token.decimals);
        const fromAddress = address;
        const toAddress = (0, starknet_1.validateAndParseAddress)(params.toAddress);
        const account = new starknet_1.Account(provider, credentials.accountPublicKey, credentials.accountPrivateKey, undefined, starknet_1.constants.TRANSACTION_VERSION.V3);
        const contract = new starknet_1.Contract(interact_1.INTERACT_ERC20_ABI, token.address, provider);
        contract.connect(account);
        const calldata = contract.populate('transfer_from', [
            fromAddress,
            toAddress,
            amount,
        ]);
        const txH = await (0, utils_1.executeV3Transaction)({
            call: calldata,
            account: account,
        });
        return JSON.stringify({
            status: 'success',
            transactionHash: txH,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.transferFrom = transferFrom;
const transferFromSignature = async (params) => {
    try {
        const token = await (0, utils_1.validateToken)(new starknet_2.RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }), params.assetSymbol, params.assetAddress);
        const { address, amount } = (0, utils_1.validateAndFormatParams)(params.fromAddress, params.amount, token.decimals);
        const fromAddress = address;
        const toAddress = (0, starknet_1.validateAndParseAddress)(params.toAddress);
        const result = {
            status: 'success',
            transactions: {
                contractAddress: token.address,
                entrypoint: 'transfer_from',
                calldata: [fromAddress, toAddress, amount.low, amount.high],
            },
            additional_data: {
                symbol: token.symbol,
                amount: params.amount,
                spenderAddress: fromAddress,
                recipientAddress: toAddress,
            },
        };
        return JSON.stringify({ transaction_type: 'INVOKE', results: [result] });
    }
    catch (error) {
        return JSON.stringify({
            status: 'error',
            error: {
                code: 'TRANSFERFROM_CALL_DATA_ERROR',
                message: error.message || 'Failed to generate transferFrom call data',
            },
        });
    }
};
exports.transferFromSignature = transferFromSignature;
//# sourceMappingURL=transferFrom.js.map