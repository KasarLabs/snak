import {
  executeSwap,
  fetchQuotes,
  QuoteRequest,
  Quote,
  Route,
} from '@avnu/avnu-sdk';
import { Account } from 'starknet';
import { SwapParams, SwapResult } from 'src/lib/utils/types/swap';
import {
  SLIPPAGE_PERCENTAGE,
  DEFAULT_QUOTE_SIZE,
} from 'src/lib/utils/constants/swap';
import { TokenService } from './tokenService';
import { ApprovalService } from './approvalService';
import { StarknetAgent } from 'src/lib/agent/starknetAgent';

export class SwapService {
  private tokenService: TokenService;
  private approvalService: ApprovalService;

  constructor(
    private agent: StarknetAgent,
    private walletAddress: string,
    private privateKey: string
  ) {
    this.tokenService = new TokenService();
    this.approvalService = new ApprovalService(agent);
  }

  async initialize(): Promise<void> {
    await this.tokenService.initializeTokens();
  }

  private safeStringify(obj: unknown): string {
    return JSON.stringify(
      obj,
      (key, value) => (typeof value === 'bigint' ? value.toString() : value),
      2
    );
  }

  private extractSpenderAddress(quote: Quote): string | undefined {
    if (quote.routes?.length > 0) {
      const mainRoute = quote.routes[0];
      return mainRoute.address;
    }

    return undefined;
  }

  async executeSwapTransaction(params: SwapParams): Promise<SwapResult> {
    try {
      await this.initialize();

      const account = new Account(
        this.agent.contractInteractor.provider,
        this.walletAddress,
        this.privateKey
      );

      const { sellToken, buyToken } = this.tokenService.validateTokenPair(
        params.sellTokenSymbol,
        params.buyTokenSymbol
      );

      const formattedAmount = BigInt(
        this.agent.contractInteractor.formatTokenAmount(
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

      // Log route information
      if (quote.routes?.length > 0) {
        console.log('Route information:', {
          name: quote.routes[0].name,
          address: quote.routes[0].address,
          routeInfo: this.safeStringify(quote.routes[0].routeInfo),
        });
      }

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
      console.error('Detailed swap error:', error);
      if (error instanceof Error) {
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      return {
        status: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async monitorSwapStatus(txHash: string) {
    const receipt = await this.agent.transactionMonitor.waitForTransaction(
      txHash,
      (status) => console.log('Swap status:', status)
    );

    const events =
      await this.agent.transactionMonitor.getTransactionEvents(txHash);
    return { receipt, events };
  }
}

export const createSwapService = (
  privateKey: string,
  walletAddress?: string
): SwapService => {
  if (!walletAddress) {
    throw new Error('Wallet address not configured');
  }

  const agent = new StarknetAgent({
    walletPrivateKey: process.env.PRIVATE_KEY,
    aiProviderApiKey: process.env.AI_PROVIDER_API_KEY,
    aiModel: process.env.AI_MODEL,
    aiProvider: process.env.AI_PROVIDER,
  });

  return new SwapService(agent, walletAddress, privateKey);
};

export const swapTokens = async (
  params: SwapParams,
  privateKey: string
): Promise<string> => {
  const swapService = createSwapService(privateKey, process.env.PUBLIC_ADDRESS);
  const result = await swapService.executeSwapTransaction(params);
  return JSON.stringify(result);
};
