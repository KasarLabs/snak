import { Account, Call, Contract } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { ERC20_ABI } from '../abis/erc20Abi';
import { Router } from 'fibrous-router-sdk';
import { BigNumber } from '@ethersproject/bignumber';
export class ApprovalService {
  private fibrous: Router;
  constructor(private agent: StarknetAgentInterface) {
    this.fibrous = new Router();
  }

  async checkAndGetApproveToken(
    account: Account,
    tokenAddress: string,
    spenderAddress: string,
    amount: string
  ): Promise<Call | null> {
    try {
      const contract = new Contract(ERC20_ABI, tokenAddress, account);

      const allowanceResult = await contract.call('allowance', [
        account.address,
        spenderAddress,
      ]);

      let currentAllowance: bigint;
      if (Array.isArray(allowanceResult)) {
        currentAllowance = BigInt(allowanceResult[0].toString());
      } else if (
        typeof allowanceResult === 'object' &&
        allowanceResult !== null
      ) {
        const value = Object.values(allowanceResult)[0];
        currentAllowance = BigInt(value.toString());
      } else {
        currentAllowance = BigInt(allowanceResult.toString());
      }

      const requiredAmount = BigInt(amount);

      if (currentAllowance < requiredAmount) {
        const calldata = await this.fibrous.buildApproveStarknet(
          BigNumber.from(amount),
          tokenAddress
        );

        return calldata;
      } else {
        console.log('Sufficient allowance already exists');
        return null;
      }
    } catch (error) {
      console.error('Approval error details:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        type: error instanceof Error ? error.constructor.name : typeof error,
      });
      throw new Error(
        `Failed to approve token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
