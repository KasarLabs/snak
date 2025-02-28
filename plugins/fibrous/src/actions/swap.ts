import { Account, Call } from 'starknet';

import { ApprovalService } from './approval';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { SLIPPAGE_PERCENTAGE } from '../constants';
import { TokenService } from './fetchTokens';
import { Router as FibrousRouter } from 'fibrous-router-sdk';
import { BigNumber } from '@ethersproject/bignumber';
import { SwapResult, SwapParams } from '../types';
export class SwapService {
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

  async executeSwapTransaction(params: SwapParams): Promise<SwapResult> {
    try {
      await this.initialize();

      const account = new Account(
        this.agent.contractInteractor.provider,
        this.walletAddress,
        this.agent.getAccountCredentials().accountPrivateKey
      );

      const { sellToken, buyToken } = this.tokenService.validateTokenPair(
        params.sellTokenSymbol,
        params.buyTokenSymbol
      );

      const formattedAmount = BigNumber.from(
        this.agent.contractInteractor.formatTokenAmount(
          params.sellAmount.toString(),
          sellToken.decimals
        )
      );
      const route = await this.router.getBestRoute(
        BigNumber.from(formattedAmount.toString()),
        sellToken.address,
        buyToken.address,
        'starknet'
      );

      if (!route?.success) {
        throw new Error('No routes available for this swap');
      }

      // Log route information
      if (route?.success) {
        console.log('Route information:', {
          sellToken: route.inputToken.name,
          buyToken: route.outputToken.name,
          amount: route.inputAmount,
          outputAmount: route.outputAmount,
        });
      }

      const destinationAddress = account.address; // !!! Destination address is the address of the account that will receive the tokens might be the any address
      const swapCall = await this.router.buildTransaction(
        formattedAmount,
        sellToken.address,
        buyToken.address,
        SLIPPAGE_PERCENTAGE,
        destinationAddress,
        'starknet'
      );

      if (!swapCall) {
        throw new Error('Calldata not available for this swap');
      }

      const approveCalldata =
        await this.approvalService.checkAndGetApproveToken(
          account,
          sellToken.address,
          this.router.STARKNET_ROUTER_ADDRESS,
          formattedAmount.toString()
        );

      let calldata: Call[] = [];

      if (approveCalldata) {
        calldata = [approveCalldata, swapCall];
      } else {
        calldata = [swapCall];
      }

      const swapResult = await account.execute(calldata);

      const { receipt, events } = await this.monitorSwapStatus(
        swapResult.transaction_hash
      );

      return {
        status: 'success',
        message: `Successfully swapped ${params.sellAmount} ${params.sellTokenSymbol} for ${params.buyTokenSymbol}`,
        transactionHash: swapResult.transaction_hash,
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
  agent: StarknetAgentInterface,
  walletAddress?: string
): SwapService => {
  if (!walletAddress) {
    throw new Error('Wallet address not configured');
  }

  return new SwapService(agent, walletAddress, new FibrousRouter());
};

export const swapTokensFibrous = async (
  agent: StarknetAgentInterface,
  params: SwapParams
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
