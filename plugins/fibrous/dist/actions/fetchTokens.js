"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenService = void 0;
const fibrous_router_sdk_1 = require("fibrous-router-sdk");
class TokenService {
    async initializeTokens() {
        try {
            const fibrous = new fibrous_router_sdk_1.Router();
            this.tokens = await fibrous.supportedTokens('starknet');
        }
        catch (error) {
            throw new Error(`Failed to initialize tokens: ${error.message}`);
        }
    }
    getToken(symbol) {
        return this.tokens.get(symbol.toLowerCase());
    }
    validateTokenPair(sellSymbol, buySymbol) {
        const sellToken = this.getToken(sellSymbol);
        const buyToken = this.getToken(buySymbol);
        if (!sellToken)
            throw new Error(`Sell token ${sellSymbol} not supported`);
        if (!buyToken)
            throw new Error(`Buy token ${buySymbol} not supported`);
        return { sellToken, buyToken };
    }
}
exports.TokenService = TokenService;
//# sourceMappingURL=fetchTokens.js.map