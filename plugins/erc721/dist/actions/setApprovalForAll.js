"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setApprovalForAllSignature = exports.setApprovalForAll = void 0;
const starknet_1 = require("starknet");
const interact_1 = require("../abis/interact");
const utils_1 = require("../utils/utils");
const starknet_2 = require("starknet");
const setApprovalForAll = async (agent, params) => {
    try {
        if (!params?.operatorAddress ||
            params?.approved === undefined ||
            !params?.contractAddress) {
            throw new Error('Operator address, approved status and contract address are required');
        }
        const provider = agent.getProvider();
        const accountCredentials = agent.getAccountCredentials();
        const operatorAddress = (0, starknet_2.validateAndParseAddress)(params.operatorAddress);
        const contractAddress = (0, starknet_2.validateAndParseAddress)(params.contractAddress);
        const account = new starknet_1.Account(provider, accountCredentials.accountPublicKey, accountCredentials.accountPrivateKey, undefined, starknet_1.constants.TRANSACTION_VERSION.V3);
        const contract = new starknet_1.Contract(interact_1.INTERACT_ERC721_ABI, contractAddress, provider);
        contract.connect(account);
        const calldata = contract.populate('set_approval_for_all', [
            operatorAddress,
            params.approved ? true : false,
        ]);
        const txH = await (0, utils_1.executeV3Transaction)({
            call: calldata,
            account: account,
        });
        const result = {
            status: 'success',
            operator: operatorAddress,
            approved: params.approved,
            transactionHash: txH,
        };
        return JSON.stringify(result);
    }
    catch (error) {
        const result = {
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
            step: 'setApprovalForAll execution',
        };
        return JSON.stringify(result);
    }
};
exports.setApprovalForAll = setApprovalForAll;
const setApprovalForAllSignature = async (params) => {
    try {
        if (!params?.operatorAddress ||
            params?.approved === undefined ||
            !params?.contractAddress) {
            throw new Error('Operator address, approved status and contract address are required');
        }
        const operatorAddress = (0, starknet_2.validateAndParseAddress)(params.operatorAddress);
        const contractAddress = (0, starknet_2.validateAndParseAddress)(params.contractAddress);
        const result = {
            status: 'success',
            transactions: {
                contractAddress: contractAddress,
                entrypoint: 'set_approval_for_all',
                calldata: [operatorAddress, params.approved ? 1 : 0],
            },
        };
        return JSON.stringify({ transaction_type: 'INVOKE', results: [result] });
    }
    catch (error) {
        return JSON.stringify({
            status: 'error',
            error: {
                code: 'SET_APPROVAL_FOR_ALL_CALL_DATA_ERROR',
                message: error.message || 'Failed to generate setApprovalForAll call data',
            },
        });
    }
};
exports.setApprovalForAllSignature = setApprovalForAllSignature;
//# sourceMappingURL=setApprovalForAll.js.map