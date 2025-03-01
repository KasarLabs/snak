import { Token, fetchTokens } from '@avnu/avnu-sdk';

/**
 * Service for managing and caching token information
 * @class TokenService
 */
export class TokenService {
  /**
   * Cache storing token information, indexed by lowercase symbol
   * @private
   * @type {Map<string, Token>}
   */
  private tokenCache: Map<string, Token> = new Map();

  /**
   * Initializes the token cache by fetching tokens from AVNU SDK
   * @throws {Error} If token initialization fails
   * @returns {Promise<void>}
   */
  async initializeTokens(): Promise<void> {
    try {
      const response = await fetchTokens();
      response.content.forEach((token) => {
        this.tokenCache.set(token.symbol.toLowerCase(), token);
      });
    } catch (error) {
      throw new Error(`Failed to initialize tokens: ${error.message}`);
    }
  }

  /**
   * Retrieves a token from the cache by its symbol
   * @param {string} symbol - The token symbol to look up
   * @returns {Token | undefined} The token if found, undefined otherwise
   */
  getToken(symbol: string): Token | undefined {
    return this.tokenCache.get(symbol.toLowerCase());
  }

  /**
   * Validates a pair of tokens for trading
   * @param {string} sellSymbol - Symbol of the token to sell
   * @param {string} buySymbol - Symbol of the token to buy
   * @throws {Error} If either token is not supported
   * @returns {{ sellToken: Token, buyToken: Token }} Object containing validated sell and buy tokens
   */
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
