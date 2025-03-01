import { BigNumber } from '@ethersproject/bignumber';

/**
 * Parameters for executing a token swap
 * @property {string} sellTokenSymbol - Symbol of the token to sell
 * @property {string} buyTokenSymbol - Symbol of the token to buy
 * @property {number} sellAmount - Amount of tokens to sell
 */
export interface SwapParams {
  sellTokenSymbol: string;
  buyTokenSymbol: string;
  sellAmount: number;
}

/**
 * Parameters for executing a batch swap operation
 * @property {string[]} sellTokenSymbols - Array of token symbols to sell
 * @property {string[]} buyTokenSymbols - Array of token symbols to buy
 * @property {number[]} sellAmounts - Array of amounts to sell
 */
export interface BatchSwapParams {
  sellTokenSymbols: string[];
  buyTokenSymbols: string[];
  sellAmounts: number[] | BigNumber[];
}
/**
 * Token information structure
 * @property {string} name - Name of the token
 * @property {string} address - Contract address of the token
 * @property {string} symbol - Token symbol
 * @property {number} decimals - Number of decimal places
 * @property {string | null} logoUri - URL to token logo image
 * @property {string} volume - Last 24h trading volume in USD
 * @property {string} price - Token price in USD
 * @property {boolean} verified - Token verification status
 * @property {string} category - Token categorization tags
 */
export interface Token {
  name: string;
  address: string;
  symbol: string;
  decimals: number;
  logoUri: string | null;
  volume: string;
  price: string;
  verified: boolean;
  category: string;
}

/**
 * Result of a swap operation
 * @property {('success'|'failure')} status - Status of the swap
 * @property {string} [message] - Optional success message
 * @property {string} [error] - Error message if swap failed
 * @property {string} [transactionHash] - Hash of the swap transaction
 * @property {number} [sellAmount] - Amount of tokens sold
 * @property {string} [sellToken] - Symbol of sold token
 * @property {string} [buyToken] - Symbol of bought token
 * @property {string} [amountReceived] - Amount of tokens received
 * @property {any} [receipt] - Transaction receipt
 * @property {any[]} [events] - Array of transaction events
 */
export interface SwapResult {
  status: 'success' | 'failure';
  message?: string;
  error?: string;
  transactionHash?: string;
  sellAmount?: number;
  sellToken?: string;
  buyToken?: string;
  amountReceived?: string;
  receipt?: any;
  events?: any[];
}
