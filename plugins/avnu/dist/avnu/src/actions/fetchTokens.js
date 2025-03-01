"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenService = void 0;
const avnu_sdk_1 = require("@avnu/avnu-sdk");
class TokenService {
    constructor() {
        this.tokenCache = new Map();
    }
    async initializeTokens() {
        try {
            const response = await (0, avnu_sdk_1.fetchTokens)();
            response.content.forEach((token) => {
                this.tokenCache.set(token.symbol.toLowerCase(), token);
            });
        }
        catch (error) {
            throw new Error(`Failed to initialize tokens: ${error.message}`);
        }
    }
    getToken(symbol) {
        return this.tokenCache.get(symbol.toLowerCase());
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