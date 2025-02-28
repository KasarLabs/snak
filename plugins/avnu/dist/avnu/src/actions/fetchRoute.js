"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoute = exports.RouteFetchService = void 0;
const avnu_sdk_1 = require("@avnu/avnu-sdk");
const fetchTokens_1 = require("./fetchTokens");
class RouteFetchService {
    constructor() {
        this.tokenService = new fetchTokens_1.TokenService();
    }
    async initialize() {
        await this.tokenService.initializeTokens();
    }
    async fetchRoute(params, agent) {
        const accountAddress = agent.getAccountCredentials()?.accountPublicKey;
        try {
            await this.initialize();
            const { sellToken, buyToken } = this.tokenService.validateTokenPair(params.sellTokenSymbol, params.buyTokenSymbol);
            const formattedAmount = BigInt(params.sellAmount.toString());
            const quoteParams = {
                sellTokenAddress: sellToken.address,
                buyTokenAddress: buyToken.address,
                sellAmount: formattedAmount,
                takerAddress: accountAddress,
                size: 1,
            };
            const quotes = await (0, avnu_sdk_1.fetchQuotes)(quoteParams);
            if (!quotes?.length) {
                return {
                    status: 'failure',
                    error: 'No routes available for this swap',
                };
            }
            const quote = quotes[0];
            const route = quote.routes?.[0];
            if (!route) {
                return {
                    status: 'failure',
                    error: 'No valid route found in quote',
                };
            }
            return {
                status: 'success',
                route,
                quote,
            };
        }
        catch (error) {
            console.error('Route fetching error:', error);
            return {
                status: 'failure',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
}
exports.RouteFetchService = RouteFetchService;
const getRoute = async (agent, params) => {
    try {
        const tokenService = new fetchTokens_1.TokenService();
        await tokenService.initializeTokens();
        const routeService = new RouteFetchService();
        return routeService.fetchRoute(params, agent);
    }
    catch (error) {
        console.error('Route fetching error:', error);
        return {
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
exports.getRoute = getRoute;
//# sourceMappingURL=fetchRoute.js.map