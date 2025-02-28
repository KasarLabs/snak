"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferFromSignature = exports.transferFrom = void 0;
const starknet_1 = require("starknet");
const interact_1 = require("../abis/interact");
const utils_1 = require("../utils/utils");
const starknet_2 = require("starknet");
const transferFrom = async (agent, params) => {
    try {
        if (!params?.fromAddress ||
            !params?.toAddress ||
            !params?.tokenId ||
            !params?.contractAddress) {
            throw new Error('From address, to address, token ID and contract address are required');
        }
        const provider = agent.getProvider();
        const accountCredentials = agent.getAccountCredentials();
        const fromAddress = (0, starknet_2.validateAndParseAddress)(params.fromAddress);
        const toAddress = (0, starknet_2.validateAndParseAddress)(params.toAddress);
        const tokenId = (0, utils_1.validateAndFormatTokenId)(params.tokenId);
        const contractAddress = (0, starknet_2.validateAndParseAddress)(params.contractAddress);
        const account = new starknet_1.Account(provider, accountCredentials.accountPublicKey, accountCredentials.accountPrivateKey, undefined, starknet_1.constants.TRANSACTION_VERSION.V3);
        const contract = new starknet_1.Contract(interact_1.INTERACT_ERC721_ABI, contractAddress, provider);
        contract.connect(account);
        const calldata = contract.populate('transfer_from', [
            fromAddress,
            toAddress,
            tokenId,
        ]);
        const txH = await (0, utils_1.executeV3Transaction)({
            call: calldata,
            account: account,
        });
        const result = {
            status: 'success',
            tokenId: params.tokenId,
            from: fromAddress,
            to: toAddress,
            transactionHash: txH,
        };
        return JSON.stringify(result);
    }
    catch (error) {
        const result = {
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
            step: 'transfer execution',
        };
        return JSON.stringify(result);
    }
};
exports.transferFrom = transferFrom;
const transferFromSignature = async (params) => {
    try {
        console.log('TRANSFER FROM SIG params', params);
        if (!params?.fromAddress ||
            !params?.toAddress ||
            !params?.tokenId ||
            !params?.contractAddress) {
            throw new Error('From address, to address, token ID and contract address are required');
        }
        const fromAddress = (0, starknet_2.validateAndParseAddress)(params.fromAddress);
        const toAddress = (0, starknet_2.validateAndParseAddress)(params.toAddress);
        const tokenId = (0, utils_1.validateAndFormatTokenId)(params.tokenId);
        const contractAddress = (0, starknet_2.validateAndParseAddress)(params.contractAddress);
        const result = {
            status: 'success',
            transactions: {
                contractAddress: contractAddress,
                entrypoint: 'transfer_from',
                calldata: [fromAddress, toAddress, tokenId.low, tokenId.high],
            },
        };
        return JSON.stringify({ transaction_type: 'INVOKE', results: [result] });
    }
    catch (error) {
        return JSON.stringify({
            status: 'error',
            error: {
                code: 'TRANSFER_FROM_CALL_DATA_ERROR',
                message: error.message || 'Failed to generate transferFrom call data',
            },
        });
    }
};
exports.transferFromSignature = transferFromSignature;
//# sourceMappingURL=transferFrom.js.map