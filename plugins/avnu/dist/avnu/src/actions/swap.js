"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.swapTokens = exports.createSwapService = exports.SwapService = void 0;
const avnu_sdk_1 = require("@avnu/avnu-sdk");
const starknet_1 = require("starknet");
const approval_1 = require("./approval");
const constants_1 = require("../constants");
const fetchTokens_1 = require("./fetchTokens");
class SwapService {
    constructor(agent, walletAddress) {
        this.agent = agent;
        this.walletAddress = walletAddress;
        this.tokenService = new fetchTokens_1.TokenService();
        this.approvalService = new approval_1.ApprovalService(agent);
    }
    async initialize() {
        await this.tokenService.initializeTokens();
    }
    safeStringify(obj) {
        return JSON.stringify(obj, (key, value) => (typeof value === 'bigint' ? value.toString() : value), 2);
    }
    extractSpenderAddress(quote) {
        if (quote.routes?.length > 0) {
            const mainRoute = quote.routes[0];
            return mainRoute.address;
        }
        return undefined;
    }
    async executeSwapTransaction(params, agent) {
        try {
            await this.initialize();
            const account = new starknet_1.Account(this.agent.contractInteractor.provider, this.walletAddress, this.agent.getAccountCredentials().accountPrivateKey);
            const { sellToken, buyToken } = this.tokenService.validateTokenPair(params.sellTokenSymbol, params.buyTokenSymbol);
            const formattedAmount = BigInt(this.agent.contractInteractor.formatTokenAmount(params.sellAmount.toString(), sellToken.decimals));
            const quoteParams = {
                sellTokenAddress: sellToken.address,
                buyTokenAddress: buyToken.address,
                sellAmount: formattedAmount,
                takerAddress: account.address,
                size: constants_1.DEFAULT_QUOTE_SIZE,
            };
            const quotes = await (0, avnu_sdk_1.fetchQuotes)(quoteParams);
            if (!quotes?.length) {
                throw new Error('No quotes available for this swap');
            }
            const quote = quotes[0];
            if (quote.routes?.length > 0) {
                console.log('Route information:', {
                    name: quote.routes[0].name,
                    address: quote.routes[0].address,
                    routeInfo: this.safeStringify(quote.routes[0].routeInfo),
                });
            }
            const spenderAddress = this.extractSpenderAddress(quote);
            if (!spenderAddress) {
                throw new Error(`Could not determine spender address from quote. Available properties: ${Object.keys(quote).join(', ')}`);
            }
            await this.approvalService.checkAndApproveToken(account, sellToken.address, spenderAddress, formattedAmount.toString());
            const swapResult = await (0, avnu_sdk_1.executeSwap)(account, quote, {
                slippage: constants_1.SLIPPAGE_PERCENTAGE,
            });
            const { receipt, events } = await this.monitorSwapStatus(swapResult.transactionHash);
            return {
                status: 'success',
                message: `Successfully swapped ${params.sellAmount} ${params.sellTokenSymbol} for ${params.buyTokenSymbol}`,
                transactionHash: swapResult.transactionHash,
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
    return new SwapService(agent, walletAddress);
};
exports.createSwapService = createSwapService;
const swapTokens = async (agent, params) => {
    const accountAddress = agent.getAccountCredentials()?.accountPublicKey;
    try {
        const swapService = (0, exports.createSwapService)(agent, accountAddress);
        const result = await swapService.executeSwapTransaction(params, agent);
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
exports.swapTokens = swapTokens;
//# sourceMappingURL=swap.js.map