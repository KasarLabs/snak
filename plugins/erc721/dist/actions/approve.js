"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveSignature = exports.approve = void 0;
const starknet_1 = require("starknet");
const interact_1 = require("../abis/interact");
const utils_1 = require("../utils/utils");
const approve = async (agent, params) => {
    try {
        if (!params?.approvedAddress ||
            !params?.tokenId ||
            !params?.contractAddress) {
            throw new Error('Approved address, token ID and contract address are required');
        }
        const provider = agent.getProvider();
        const accountCredentials = agent.getAccountCredentials();
        const approvedAddress = (0, starknet_1.validateAndParseAddress)(params.approvedAddress);
        const contractAddress = (0, starknet_1.validateAndParseAddress)(params.contractAddress);
        const tokenId = (0, utils_1.validateAndFormatTokenId)(params.tokenId);
        const account = new starknet_1.Account(provider, accountCredentials.accountPublicKey, accountCredentials.accountPrivateKey, undefined, starknet_1.constants.TRANSACTION_VERSION.V3);
        const contract = new starknet_1.Contract(interact_1.INTERACT_ERC721_ABI, contractAddress, provider);
        contract.connect(account);
        const calldata = contract.populate('approve', [approvedAddress, tokenId]);
        const txH = await (0, utils_1.executeV3Transaction)({
            call: calldata,
            account: account,
        });
        const result = {
            status: 'success',
            tokenId: params.tokenId,
            approved: true,
            transactionHash: txH,
        };
        return JSON.stringify(result);
    }
    catch (error) {
        const result = {
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
            step: 'approve execution',
        };
        return JSON.stringify(result);
    }
};
exports.approve = approve;
const approveSignature = async (params) => {
    try {
        if (!params?.approvedAddress ||
            !params?.tokenId ||
            !params?.contractAddress) {
            throw new Error('Approved address, token ID and contract address are required');
        }
        const approvedAddress = (0, starknet_1.validateAndParseAddress)(params.approvedAddress);
        const tokenId = (0, utils_1.validateAndFormatTokenId)(params.tokenId);
        const contractAddress = (0, starknet_1.validateAndParseAddress)(params.contractAddress);
        const result = {
            status: 'success',
            transactions: {
                contractAddress: contractAddress,
                entrypoint: 'approve',
                calldata: [approvedAddress, tokenId.low, tokenId.high],
            },
        };
        return JSON.stringify({ transaction_type: 'INVOKE', results: [result] });
    }
    catch (error) {
        return {
            status: 'error',
            error: {
                code: 'APPROVE_CALL_DATA_ERROR',
                message: error.message || 'Failed to generate approve call data',
            },
        };
    }
};
exports.approveSignature = approveSignature;
//# sourceMappingURL=approve.js.map