"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferSignature = exports.transfer = void 0;
const starknet_1 = require("starknet");
const utils_1 = require("../utils/utils");
const interact_1 = require("../abis/interact");
const starknet_2 = require("starknet");
const transfer = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const credentials = agent.getAccountCredentials();
        const token = await (0, utils_1.validateToken)(provider, params.assetSymbol, params.assetAddress);
        const { address, amount } = (0, utils_1.validateAndFormatParams)(params.recipientAddress, params.amount, token.decimals);
        const recipientAddress = address;
        const account = new starknet_1.Account(provider, credentials.accountPublicKey, credentials.accountPrivateKey, undefined, starknet_1.constants.TRANSACTION_VERSION.V3);
        const contract = new starknet_1.Contract(interact_1.INTERACT_ERC20_ABI, token.address, provider);
        contract.connect(account);
        const calldata = contract.populate('transfer', [
            recipientAddress,
            amount.low,
            amount.high,
        ]);
        const txH = await (0, utils_1.executeV3Transaction)({
            call: calldata,
            account: account,
        });
        return JSON.stringify({
            status: 'success',
            amount: params.amount,
            symbol: token.symbol,
            recipients_address: recipientAddress,
            transaction_hash: txH,
        });
    }
    catch (error) {
        const transferResult = {
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
            step: 'transfer execution',
        };
        return JSON.stringify(transferResult);
    }
};
exports.transfer = transfer;
const transferSignature = async (params) => {
    try {
        const token = await (0, utils_1.validateToken)(new starknet_2.RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }), params.assetSymbol, params.assetAddress);
        const { address, amount } = (0, utils_1.validateAndFormatParams)(params.recipientAddress, params.amount, token.decimals);
        const recipientAddress = address;
        const result = {
            status: 'success',
            transactions: {
                contractAddress: token.address,
                entrypoint: 'transfer',
                calldata: [recipientAddress, amount.low, amount.high],
            },
            additional_data: {
                symbol: token.symbol,
                amount: params.amount,
                recipientAddress: recipientAddress,
            },
        };
        return JSON.stringify({ transaction_type: 'INVOKE', results: [result] });
    }
    catch (error) {
        return JSON.stringify({
            status: 'error',
            error: {
                code: 'TRANSFER_CALL_DATA_ERROR',
                message: error.message || 'Failed to generate transfer call data',
            },
        });
    }
};
exports.transferSignature = transferSignature;
//# sourceMappingURL=transfer.js.map