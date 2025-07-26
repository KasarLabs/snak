import { executeSwap, fetchQuotes, QuoteRequest, Quote } from '@avnu/avnu-sdk';
import { Account, constants, RpcProvider } from 'starknet';

import { ApprovalService } from './approval.js';
import { SwapParams, SwapResult } from '../types/index.js';
import { DEFAULT_QUOTE_SIZE, SLIPPAGE_PERCENTAGE } from '../constants/index.js';
import { TokenService } from './fetchTokens.js';
import { ContractInteractor } from '../utils/contractInteractor.js';
import { TransactionMonitor } from '../utils/transactionMonitor.js';

/**
 * Service handling token swap operations using AVNU SDK
 * @class SwapService
 */
export class SwapService {
  private tokenService: TokenService;
  private approvalService: ApprovalService;

  /**
   * Creates an instance of SwapService
   * @param {RpcProvider} provider - The Starknet RPC provider
   * @param {string} walletAddress - The wallet address executing the swaps
   * @param {string} privateKey - The private key for the wallet
   */
  constructor(
    private provider: RpcProvider,
    private walletAddress: string,
    private privateKey: string
  ) {
    this.tokenService = new TokenService();
    this.approvalService = new ApprovalService(provider, privateKey);
  }

  /**
   * Initializes the token service
   * @returns {Promise<void>}
   */
  async initialize(): Promise<void> {
    await this.tokenService.initializeTokens();
  }

  /**
   * Extracts spender address from a quote
   * @private
   * @param {Quote} quote - The quote containing route information
   * @returns {string|undefined} The spender address if available
   */
  private extractSpenderAddress(quote: Quote): string | undefined {
    if (quote.routes?.length > 0) {
      const mainRoute = quote.routes[0];
      return mainRoute.address;
    }

    return undefined;
  }

  /**
   * Executes a token swap transaction
   * @param {SwapParams} params - The swap parameters
   * @returns {Promise<SwapResult>} The result of the swap operation
   */
  async executeSwapTransaction(params: SwapParams): Promise<SwapResult> {
    try {
      await this.initialize();
      const contractInteractor = new ContractInteractor(this.provider);

      const account = new Account(
        this.provider,
        this.walletAddress,
        this.privateKey,
        undefined,
        constants.TRANSACTION_VERSION.V3
      );

      const { sellToken, buyToken } = this.tokenService.validateTokenPair(
        params.sellTokenSymbol,
        params.buyTokenSymbol
      );

      const formattedAmount = BigInt(
        contractInteractor.formatTokenAmount(
          params.sellAmount.toString(),
          sellToken.decimals
        )
      );

      const quoteParams: QuoteRequest = {
        sellTokenAddress: sellToken.address,
        buyTokenAddress: buyToken.address,
        sellAmount: formattedAmount,
        takerAddress: account.address,
        size: DEFAULT_QUOTE_SIZE,
      };

      const quotes = await fetchQuotes(quoteParams);
      if (!quotes?.length) {
        throw new Error('No quotes available for this swap');
      }

      const quote = quotes[0];

      const spenderAddress = this.extractSpenderAddress(quote);

      if (!spenderAddress) {
        throw new Error(
          `Could not determine spender address from quote. Available properties: ${Object.keys(quote).join(', ')}`
        );
      }

      await this.approvalService.checkAndApproveToken(
        account,
        sellToken.address,
        spenderAddress,
        formattedAmount.toString()
      );

      const swapResult = await executeSwap(account, quote, {
        slippage: SLIPPAGE_PERCENTAGE,
      });

      const { receipt, events } = await this.monitorSwapStatus(
        swapResult.transactionHash
      );

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
    } catch (error) {
      return {
        status: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Monitors the status of a swap transaction
   * @private
   * @param {string} txHash - The transaction hash to monitor
   * @returns {Promise<{receipt: any, events: any}>} Transaction receipt and events
   */
  private async monitorSwapStatus(txHash: string) {
    const transactionMonitor = new TransactionMonitor(this.provider);
    const receipt = await transactionMonitor.waitForTransaction(
      txHash,
      (status) => console.log('Swap status:', status)
    );

    const events = await transactionMonitor.getTransactionEvents(txHash);
    return { receipt, events };
  }
}

/**
 * Creates a new SwapService instance
 * @param {RpcProvider} provider - The Starknet RPC provider
 * @param {string} walletAddress - The wallet address
 * @param {string} privateKey - The private key
 * @returns {SwapService} A new SwapService instance
 * @throws {Error} If wallet address or private key is not provided
 */
export const createSwapService = (
  provider: RpcProvider,
  walletAddress: string,
  privateKey: string
): SwapService => {
  if (!walletAddress) {
    throw new Error('Wallet address not configured');
  }
  if (!privateKey) {
    throw new Error('Private key not configured');
  }

  return new SwapService(provider, walletAddress, privateKey);
};

export const swapTokens = async (
  provider: RpcProvider,
  walletAddress: string,
  privateKey: string,
  params: SwapParams
) => {
  try {
    const swapService = createSwapService(provider, walletAddress, privateKey);
    const result = await swapService.executeSwapTransaction(params);
    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
