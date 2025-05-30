import { Account, Call, constants } from 'starknet';

import { ApprovalService } from './approval.js';
import { SnakAgentInterface } from '@snakagent/core';
import { TokenService } from './fetchTokens.js';
import { Router as FibrousRouter, RouteSuccess } from 'fibrous-router-sdk';
import { BigNumber } from '@ethersproject/bignumber';
import { getV3DetailsPayload } from '../utils/utils.js';
import { TransactionMonitor } from '../utils/transactionMonitor.js';
import { BatchSwapParams } from '../types/index.js';
import { SLIPPAGE_PERCENTAGE } from '../constants/index.js';

export class BatchSwapService {
  private tokenService: TokenService;
  private approvalService: ApprovalService;
  private router: FibrousRouter;

  constructor(
    private agent: SnakAgentInterface,
    private walletAddress: string,
    routerInstance?: FibrousRouter
  ) {
    this.tokenService = new TokenService();
    this.approvalService = new ApprovalService();
    this.router = routerInstance || new FibrousRouter();
  }

  async initialize(): Promise<void> {
    await this.tokenService.initializeTokens();
  }

  extractBatchSwapParams(params: BatchSwapParams): {
    sellTokenAddresses: string[];
    buyTokenAddresses: string[];
    sellAmounts: BigNumber[];
  } {
    const sellTokens: string[] = [];
    const buyTokens: string[] = [];
    const sellAmounts: BigNumber[] = [];
    for (let i = 0; i < params.sellTokenSymbols.length; i++) {
      const { sellToken, buyToken } = this.tokenService.validateTokenPair(
        params.sellTokenSymbols[i],
        params.buyTokenSymbols[i]
      );

      const sellAmount = BigNumber.from(params.sellAmounts[i]);
      sellTokens.push(sellToken.address);
      buyTokens.push(buyToken.address);
      sellAmounts.push(sellAmount);
    }
    return {
      sellTokenAddresses: sellTokens,
      buyTokenAddresses: buyTokens,
      sellAmounts: sellAmounts,
    };
  }

  async executeSwapTransaction(params: BatchSwapParams) {
    try {
      await this.initialize();

      const provider = this.agent.getProvider();
      const account = new Account(
        provider,
        this.walletAddress,
        this.agent.getAccountCredentials().accountPrivateKey,
        undefined,
        constants.TRANSACTION_VERSION.V3
      );

      const swapParams = this.extractBatchSwapParams(params);

      // Get routes for each swap individually instead of batch
      const routes = [];
      for (let i = 0; i < swapParams.sellAmounts.length; i++) {
        const route = await this.router.getBestRoute(
          swapParams.sellAmounts[i],
          swapParams.sellTokenAddresses[i],
          swapParams.buyTokenAddresses[i],
          'starknet'
        );
        routes.push(route);
      }

      for (let i = 0; i < routes.length; i++) {
        console.log(`${i}. Route information: `, {
          sellToken: params.sellTokenSymbols[i],
          buyToken: params.buyTokenSymbols[i],
          sellAmount: params.sellAmounts[i],
          buyAmount:
            routes[i] && routes[i].success
              ? (routes[i] as RouteSuccess).outputAmount
              : 'N/A',
        });
      }
      const destinationAddress = account.address; // !!! Destination address is the address of the account that will receive the tokens might be the any address

      const swapCalls = await this.router.buildBatchTransaction(
        swapParams.sellAmounts as BigNumber[],
        swapParams.sellTokenAddresses,
        swapParams.buyTokenAddresses,
        SLIPPAGE_PERCENTAGE,
        destinationAddress,
        'starknet'
      );
      if (!swapCalls) {
        throw new Error('Calldata not available for this swap');
      }
      let calldata: Call[] = [];
      for (let i = 0; i < swapCalls.length; i++) {
        const approveCall = await this.approvalService.checkAndGetApproveToken(
          account,
          swapParams.sellTokenAddresses[i],
          this.router.STARKNET_ROUTER_ADDRESS,
          swapParams.sellAmounts[i].toString()
        );
        if (approveCall) {
          calldata = [approveCall, swapCalls[i]];
        } else {
          calldata = [swapCalls[i]];
        }
      }

      const swapResult = await account.execute(calldata, getV3DetailsPayload());
      const { receipt, events } = await this.monitorSwapStatus(
        swapResult.transaction_hash
      );
      return {
        status: 'success',
        message: `Successfully swapped ${params.sellAmounts} ${params.sellTokenSymbols} for ${params.buyTokenSymbols}`,
        transactionHash: swapResult.transaction_hash,
        sellAmounts: params.sellAmounts,
        sellTokenSymbols: params.sellTokenSymbols,
        buyTokenSymbols: params.buyTokenSymbols,
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

  private async monitorSwapStatus(txHash: string) {
    const transactionMonitor = new TransactionMonitor(this.agent.getProvider());
    const receipt = await transactionMonitor.waitForTransaction(
      txHash,
      (status) => console.log('Swap status:', status)
    );

    const events = await transactionMonitor.getTransactionEvents(txHash);
    return { receipt, events };
  }
}

export const createSwapService = (
  agent: SnakAgentInterface,
  walletAddress?: string
): BatchSwapService => {
  if (!walletAddress) {
    throw new Error('Wallet address not configured');
  }

  return new BatchSwapService(agent, walletAddress);
};

export const batchSwapTokens = async (
  agent: SnakAgentInterface,
  params: BatchSwapParams
) => {
  const accountAddress = agent.getAccountCredentials()?.accountPublicKey;

  try {
    const swapService = createSwapService(agent, accountAddress);
    const result = await swapService.executeSwapTransaction(params);
    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
