import { Token, Router as FibrousRouter } from 'fibrous-router-sdk';

export class TokenService {
  private tokens: Map<string, Token>;

  async initializeTokens(): Promise<void> {
    try {
      const fibrous = new FibrousRouter();
      const tokensRecord = await fibrous.supportedTokens('starknet');
      this.tokens = new Map(Object.entries(tokensRecord));
    } catch (error) {
      throw new Error(`Failed to initialize tokens: ${error.message}`);
    }
  }

  getToken(symbol: string): Token | undefined {
    return this.tokens.get(symbol.toLowerCase());
  }

  validateTokenPair(
    sellSymbol: string,
    buySymbol: string
  ): {
    sellToken: Token;
    buyToken: Token;
  } {
    const sellToken = this.getToken(sellSymbol);
    const buyToken = this.getToken(buySymbol);

    if (!sellToken) throw new Error(`Sell token ${sellSymbol} not supported`);
    if (!buyToken) throw new Error(`Buy token ${buySymbol} not supported`);

    return { sellToken, buyToken };
  }
}
