import { Token } from '@avnu/avnu-sdk';
export declare class TokenService {
    private tokenCache;
    initializeTokens(): Promise<void>;
    getToken(symbol: string): Token | undefined;
    validateTokenPair(sellSymbol: string, buySymbol: string): {
        sellToken: Token;
        buyToken: Token;
    };
}
