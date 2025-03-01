"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.swapTokensFibrous = exports.createSwapService = exports.SwapService = void 0;
const starknet_1 = require("starknet");
const approval_1 = require("./approval");
const constants_1 = require("../constants");
const fetchTokens_1 = require("./fetchTokens");
const fibrous_router_sdk_1 = require("fibrous-router-sdk");
const bignumber_1 = require("@ethersproject/bignumber");
class SwapService {
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
    async executeSwapTransaction(params) {
        try {
            await this.initialize();
            const account = new starknet_1.Account(this.agent.contractInteractor.provider, this.walletAddress, this.agent.getAccountCredentials().accountPrivateKey);
            const { sellToken, buyToken } = this.tokenService.validateTokenPair(params.sellTokenSymbol, params.buyTokenSymbol);
            const formattedAmount = bignumber_1.BigNumber.from(this.agent.contractInteractor.formatTokenAmount(params.sellAmount.toString(), sellToken.decimals));
            const route = await this.router.getBestRoute(bignumber_1.BigNumber.from(formattedAmount.toString()), sellToken.address, buyToken.address, 'starknet');
            if (!route?.success) {
                throw new Error('No routes available for this swap');
            }
            if (route?.success) {
                console.log('Route information:', {
                    sellToken: route.inputToken.name,
                    buyToken: route.outputToken.name,
                    amount: route.inputAmount,
                    outputAmount: route.outputAmount,
                });
            }
            const destinationAddress = account.address;
            const swapCall = await this.router.buildTransaction(formattedAmount, sellToken.address, buyToken.address, constants_1.SLIPPAGE_PERCENTAGE, destinationAddress, 'starknet');
            if (!swapCall) {
                throw new Error('Calldata not available for this swap');
            }
            const approveCalldata = await this.approvalService.checkAndGetApproveToken(account, sellToken.address, this.router.STARKNET_ROUTER_ADDRESS, formattedAmount.toString());
            let calldata = [];
            if (approveCalldata) {
                calldata = [approveCalldata, swapCall];
            }
            else {
                calldata = [swapCall];
            }
            const swapResult = await account.execute(calldata);
            const { receipt, events } = await this.monitorSwapStatus(swapResult.transaction_hash);
            return {
                status: 'success',
                message: `Successfully swapped ${params.sellAmount} ${params.sellTokenSymbol} for ${params.buyTokenSymbol}`,
                transactionHash: swapResult.transaction_hash,
                sellAmount: params.sellAmount,
                sellToken: params.sellTokenSymbol,
                buyToken: params.buyTokenSymbol,
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
exports.SwapService = SwapService;
const createSwapService = (agent, walletAddress) => {
    if (!walletAddress) {
        throw new Error('Wallet address not configured');
    }
    return new SwapService(agent, walletAddress, new fibrous_router_sdk_1.Router());
};
exports.createSwapService = createSwapService;
const swapTokensFibrous = async (agent, params) => {
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
exports.swapTokensFibrous = swapTokensFibrous;
//# sourceMappingURL=swap.js.map