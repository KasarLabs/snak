import { Account, uint256, CallData } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { ERC20_ABI } from '../../../token/src/abis/erc20Abi';

/**
 * Service handling token approvals on Starknet
 * @class ApprovalService
 */
export class ApprovalService {
  /**
   * Creates an instance of ApprovalService
   * @param {StarknetAgentInterface} agent - The Starknet agent interface for blockchain interactions
   */
  constructor(private agent: StarknetAgentInterface) {}

  /**
   * Safely stringifies objects containing BigInt values
   * @private
   * @param {unknown} obj - Object to stringify
   * @returns {string} JSON string with BigInt values converted to strings
   */
  private safeStringify(obj: unknown): string {
    return JSON.stringify(
      obj,
      (key, value) => (typeof value === 'bigint' ? value.toString() : value),
      2
    );
  }

  /**
   * Checks current token allowance and approves additional amount if necessary
   * @param {Account} account - The Starknet account performing the approval
   * @param {string} tokenAddress - The address of the token contract
   * @param {string} spenderAddress - The address being approved to spend tokens
   * @param {string} amount - The amount to approve
   * @throws {Error} If approval transaction fails
   * @returns {Promise<void>}
   */
  async checkAndApproveToken(
    account: Account,
    tokenAddress: string,
    spenderAddress: string,
    amount: string
  ): Promise<void> {
    try {
      const contract = this.agent.contractInteractor.createContract(
        ERC20_ABI,
        tokenAddress,
        account
      );

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
        const calldata = CallData.compile({
          spender: spenderAddress,
          amount: uint256.bnToUint256(amount),
        });

        console.log('Calldata:', calldata);

        const approveCall = await contract.invoke('approve', calldata);

        console.log(
          'Approve transaction sent:',
          this.safeStringify(approveCall)
        );

        if (!approveCall?.transaction_hash) {
          throw new Error('No transaction hash in approve result');
        }

        console.log('Waiting for approve transaction...');
        await this.agent.transactionMonitor.waitForTransaction(
          approveCall.transaction_hash,
          (status) => console.log('Approve status:', status)
        );

        console.log('Approve transaction completed');
      } else {
        console.log('Sufficient allowance already exists');
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
