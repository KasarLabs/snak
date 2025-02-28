"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRouteFibrous = exports.RouteFetchService = void 0;
const fetchTokens_1 = require("./fetchTokens");
const fibrous_router_sdk_1 = require("fibrous-router-sdk");
const bignumber_1 = require("@ethersproject/bignumber");
class RouteFetchService {
    constructor() {
        this.tokenService = new fetchTokens_1.TokenService();
        this.router = new fibrous_router_sdk_1.Router();
    }
    async initialize() {
        await this.tokenService.initializeTokens();
    }
    async fetchRoute(params) {
        try {
            await this.initialize();
            const { sellToken, buyToken } = this.tokenService.validateTokenPair(params.sellTokenSymbol, params.buyTokenSymbol);
            const formattedAmount = BigInt(params.sellAmount.toString());
            const route = await this.router.getBestRoute(bignumber_1.BigNumber.from(formattedAmount.toString()), sellToken.address, buyToken.address, 'starknet');
            if (!route?.success) {
                return {
                    status: 'failure',
                    error: 'No routes available for this swap',
                };
            }
            if (!route) {
                return {
                    status: 'failure',
                    error: 'No valid route found in quote',
                };
            }
            return {
                status: 'success',
                route,
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
const getRouteFibrous = async (agent, params) => {
    try {
        const tokenService = new fetchTokens_1.TokenService();
        await tokenService.initializeTokens();
        const routeService = new RouteFetchService();
        return routeService.fetchRoute(params);
    }
    catch (error) {
        console.error('Route fetching error:', error);
        return {
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
exports.getRouteFibrous = getRouteFibrous;
//# sourceMappingURL=fetchRoute.js.map