"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchSwapTokens = exports.createSwapService = exports.BatchSwapService = void 0;
const starknet_1 = require("starknet");
const approval_1 = require("./approval");
const fetchTokens_1 = require("./fetchTokens");
const fibrous_router_sdk_1 = require("fibrous-router-sdk");
const bignumber_1 = require("@ethersproject/bignumber");
const constants_1 = require("../constants");
class BatchSwapService {
    constructor(agent, walletAddress, router) {
        this.agent = agent;
        this.walletAddress = walletAddress;
        this.router = router;
        this.tokenService = new fetchTokens_1.TokenService();
        this.approvalService = new approval_1.ApprovalService(agent);
        this.router = new fibrous_router_sdk_1.Router();
    }
    async initialize() {
        await this.tokenService.initializeTokens();
    }
    extractBatchSwapParams(params) {
        const sellTokens = [];
        const buyTokens = [];
        const sellAmounts = [];
        for (let i = 0; i < params.sellTokenSymbols.length; i++) {
            const { sellToken, buyToken } = this.tokenService.validateTokenPair(params.sellTokenSymbols[i], params.buyTokenSymbols[i]);
            const sellAmount = bignumber_1.BigNumber.from(params.sellAmounts[i]);
            sellTokens.push(sellToken.address);
            buyTokens.push(buyToken.address);
            sellAmounts.push(sellAmount);
        }
        return {
            sellTokenAddresses: sellTokens,
            buyTokenAddresses: buyTokens,
            sellAmounts: sellAmounts,
        };
    }
    async executeSwapTransaction(params) {
        try {
            await this.initialize();
            const account = new starknet_1.Account(this.agent.contractInteractor.provider, this.walletAddress, this.agent.getAccountCredentials().accountPrivateKey);
            const swapParams = this.extractBatchSwapParams(params);
            const route = await this.router.getBestRouteBatch(swapParams.sellAmounts, swapParams.sellTokenAddresses, swapParams.buyTokenAddresses, 'starknet');
            if (route.length != swapParams.sellAmounts.length) {
                throw new Error('Invalid route');
            }
            for (let i = 0; i < route.length; i++) {
                console.log(`${i}. Route information: `, {
                    sellToken: params.sellTokenSymbols[i],
                    buyToken: params.buyTokenSymbols[i],
                    sellAmount: params.sellAmounts[i],
                    buyAmount: route[i]?.outputAmount,
                });
            }
            const destinationAddress = account.address;
            const swapCalls = await this.router.buildBatchTransaction(swapParams.sellAmounts, swapParams.sellTokenAddresses, swapParams.buyTokenAddresses, constants_1.SLIPPAGE_PERCENTAGE, destinationAddress, 'starknet');
            if (!swapCalls) {
                throw new Error('Calldata not available for this swap');
            }
            let calldata = [];
            for (let i = 0; i < swapCalls.length; i++) {
                const approveCall = await this.approvalService.checkAndGetApproveToken(account, swapParams.sellTokenAddresses[i], this.router.STARKNET_ROUTER_ADDRESS, swapParams.sellAmounts[i].toString());
                if (approveCall) {
                    calldata = [approveCall, swapCalls[i]];
                }
                else {
                    calldata = [swapCalls[i]];
                }
            }
            const swapResult = await account.execute(calldata);
            const { receipt, events } = await this.monitorSwapStatus(swapResult.transaction_hash);
            return {
                status: 'success',
                message: `Successfully swapped ${params.sellAmounts} ${params.sellTokenSymbols} for ${params.buyTokenSymbols}`,
                transactionHash: swapResult.transaction_hash,
                sellAmounts: params.sellAmounts,
                sellTokenSymbols: params.sellTokenSymbols,
                buyTokenSymbols: params.buyTokenSymbols,
                receipt,
                events,
            };
        }
        catch (error) {
            console.error('Detailed swap error:', error);
            if (error instanceof Error) {
                console.error('Error type:', error.constructor.name);
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
            return {
                status: 'failure',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    async monitorSwapStatus(txHash) {
        const receipt = await this.agent.transactionMonitor.waitForTransaction(txHash, (status) => console.log('Swap status:', status));
        const events = await this.agent.transactionMonitor.getTransactionEvents(txHash);
        return { receipt, events };
    }
}
exports.BatchSwapService = BatchSwapService;
const createSwapService = (agent, walletAddress) => {
    if (!walletAddress) {
        throw new Error('Wallet address not configured');
    }
    return new BatchSwapService(agent, walletAddress, new fibrous_router_sdk_1.Router());
};
exports.createSwapService = createSwapService;
const batchSwapTokens = async (agent, params) => {
    const accountAddress = agent.getAccountCredentials()?.accountPublicKey;
    try {
        const swapService = (0, exports.createSwapService)(agent, accountAddress);
        const result = await swapService.executeSwapTransaction(params);
        return JSON.stringify(result);
    }
    catch (error) {
        console.error('Detailed swap error:', error);
        if (error instanceof Error) {
            console.error('Error type:', error.constructor.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.batchSwapTokens = batchSwapTokens;
//# sourceMappingURL=batchSwap.js.map