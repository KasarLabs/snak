import { Account, Call, constants } from 'starknet';

import { ApprovalService } from './approval.js';
import { StarknetAgentInterface } from '@hijox/core';
import { SLIPPAGE_PERCENTAGE } from '../constants/index.js';
import { TokenService } from './fetchTokens.js';
import { Router as FibrousRouter } from 'fibrous-router-sdk';
import { BigNumber } from '@ethersproject/bignumber';
import { SwapResult, SwapParams } from '../types/index.js';
import { getV3DetailsPayload } from '../utils/utils.js';
import { ContractInteractor } from '../utils/contractInteractor.js';
import { TransactionMonitor } from '../utils/transactionMonitor.js';

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

      const provider = this.agent.getProvider();
      const contractInteractor = new ContractInteractor(provider);
      const account = new Account(
        provider,
        this.walletAddress,
        this.agent.getAccountCredentials().accountPrivateKey,
        undefined,
        constants.TRANSACTION_VERSION.V3
      );

      const { sellToken, buyToken } = this.tokenService.validateTokenPair(
        params.sellTokenSymbol,
        params.buyTokenSymbol
      );

      const formattedAmount = BigNumber.from(
        contractInteractor.formatTokenAmount(
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

      const swapResult = await account.execute(calldata, getV3DetailsPayload());

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
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
