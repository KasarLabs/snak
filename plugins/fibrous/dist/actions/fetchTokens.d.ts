import { Token } from 'fibrous-router-sdk';
export declare class TokenService {
    private tokens;
    initializeTokens(): Promise<void>;
    getToken(symbol: string): Token | undefined;
    validateTokenPair(sellSymbol: string, buySymbol: string): {
        sellToken: Token;
        buyToken: Token;
    };
}
