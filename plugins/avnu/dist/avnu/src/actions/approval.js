"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalService = void 0;
const starknet_1 = require("starknet");
const erc20Abi_1 = require("../../../token/src/abis/erc20Abi");
class ApprovalService {
    constructor(agent) {
        this.agent = agent;
    }
    safeStringify(obj) {
        return JSON.stringify(obj, (key, value) => (typeof value === 'bigint' ? value.toString() : value), 2);
    }
    async checkAndApproveToken(account, tokenAddress, spenderAddress, amount) {
        try {
            const contract = this.agent.contractInteractor.createContract(erc20Abi_1.ERC20_ABI, tokenAddress, account);
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
                const calldata = starknet_1.CallData.compile({
                    spender: spenderAddress,
                    amount: starknet_1.uint256.bnToUint256(amount),
                });
                console.log('Calldata:', calldata);
                const approveCall = await contract.invoke('approve', calldata);
                console.log('Approve transaction sent:', this.safeStringify(approveCall));
                if (!approveCall?.transaction_hash) {
                    throw new Error('No transaction hash in approve result');
                }
                console.log('Waiting for approve transaction...');
                await this.agent.transactionMonitor.waitForTransaction(approveCall.transaction_hash, (status) => console.log('Approve status:', status));
                console.log('Approve transaction completed');
            }
            else {
                console.log('Sufficient allowance already exists');
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