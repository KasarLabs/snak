import { Account, Call } from 'starknet';

import { ApprovalService } from './approval';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { TokenService } from './fetchTokens';
import { Router as FibrousRouter } from 'fibrous-router-sdk';
import { BigNumber } from '@ethersproject/bignumber';
import { BatchSwapParams } from '../types';
import { SLIPPAGE_PERCENTAGE } from '../constants';

export class BatchSwapService {
  private tokenService: TokenService;
  private approvalService: ApprovalService;

  constructor(
    private agent: StarknetAgentInterface,
    private walletAddress: string,
    private router: FibrousRouter
  ) {
    this.tokenService = new TokenService();
    this.approvalService = new ApprovalService(agent);
    this.router = new FibrousRouter();
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

      const account = new Account(
        this.agent.contractInteractor.provider,
        this.walletAddress,
        this.agent.getAccountCredentials().accountPrivateKey
      );
      const swapParams = this.extractBatchSwapParams(params);
      const route = await this.router.getBestRouteBatch(
        swapParams.sellAmounts as BigNumber[],
        swapParams.sellTokenAddresses,
        swapParams.buyTokenAddresses,
        'starknet'
      );
      if (route.length != swapParams.sellAmounts.length) {
        throw new Error('Invalid route');
      }

      for (let i = 0; i < route.length; i++) {
        console.log(`${i}. Route information: `, {
          sellToken: params.sellTokenSymbols[i],
          buyToken: params.buyTokenSymbols[i],
          sellAmount: params.sellAmounts[i],
          // @ts-expect-error
          buyAmount: route[i]?.outputAmount,
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
      const swapResult = await account.execute(calldata);
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
  agent: StarknetAgentInterface,
  walletAddress?: string
): BatchSwapService => {
  if (!walletAddress) {
    throw new Error('Wallet address not configured');
  }

  return new BatchSwapService(agent, walletAddress, new FibrousRouter());
};

export const batchSwapTokens = async (
  agent: StarknetAgentInterface,
  params: BatchSwapParams
) => {
  const accountAddress = agent.getAccountCredentials()?.accountPublicKey;

  try {
    const swapService = createSwapService(agent, accountAddress);
    const result = await swapService.executeSwapTransaction(params);
    return JSON.stringify(result);
  } catch (error) {
    console.error('Detailed swap error:', error);
    if (error instanceof Error) {
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
