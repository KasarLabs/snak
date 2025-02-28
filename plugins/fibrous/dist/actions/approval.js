"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalService = void 0;
const starknet_1 = require("starknet");
const erc20Abi_1 = require("../abis/erc20Abi");
const fibrous_router_sdk_1 = require("fibrous-router-sdk");
const bignumber_1 = require("@ethersproject/bignumber");
class ApprovalService {
    constructor(agent) {
        this.agent = agent;
        this.fibrous = new fibrous_router_sdk_1.Router();
    }
    async checkAndGetApproveToken(account, tokenAddress, spenderAddress, amount) {
        try {
            const contract = new starknet_1.Contract(erc20Abi_1.ERC20_ABI, tokenAddress, account);
            const allowanceResult = await contract.call('allowance', [
                account.address,
                spenderAddress,
            ]);
            let currentAllowance;
            if (Array.isArray(allowanceResult)) {
                currentAllowance = BigInt(allowanceResult[0].toString());
            }
            else if (typeof allowanceResult === 'object' &&
                allowanceResult !== null) {
                const value = Object.values(allowanceResult)[0];
                currentAllowance = BigInt(value.toString());
            }
            else {
                currentAllowance = BigInt(allowanceResult.toString());
            }
            const requiredAmount = BigInt(amount);
            if (currentAllowance < requiredAmount) {
                const calldata = await this.fibrous.buildApproveStarknet(bignumber_1.BigNumber.from(amount), tokenAddress);
                return calldata;
            }
            else {
                console.log('Sufficient allowance already exists');
                return null;
            }
        }
        catch (error) {
            console.error('Approval error details:', {
                error,
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                type: error instanceof Error ? error.constructor.name : typeof error,
            });
            throw new Error(`Failed to approve token: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
exports.ApprovalService = ApprovalService;
//# sourceMappingURL=approval.js.map