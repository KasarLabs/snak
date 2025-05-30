import { Account, uint256 } from 'starknet';
import { SnakAgentInterface } from '@snakagent/core';
import { ERC20_ABI } from '../abi/erc20Abi.js';
import { ContractInteractor } from '../utils/contractInteractor.js';
import { TransactionMonitor } from '../utils/transactionMonitor.js';

/**
 * Service handling token approvals on Starknet
 * @class ApprovalService
 */
export class ApprovalService {
  /**
   * Creates an instance of ApprovalService
   * @param {SnakAgentInterface} agent - The Starknet agent interface for blockchain interactions
   */
  constructor(private agent: SnakAgentInterface) {}

  /**
   * Safely stringifies objects containing BigInt values
   * @private
   * @param {unknown} obj - Object to stringify
   * @returns {string} JSON string with BigInt values converted to strings
   */
  private safeStringify(obj: unknown): string {
    return JSON.stringify(
      obj,
      (_, value) => (typeof value === 'bigint' ? value.toString() : value),
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
      const contractInteractor = new ContractInteractor(
        this.agent.getProvider()
      );
      const transactionMonitor = new TransactionMonitor(
        this.agent.getProvider()
      );

      const contract = contractInteractor.createContract(
        ERC20_ABI,
        tokenAddress,
        account
      );

      const allowanceResult = await contract.allowance(
        account.address,
        spenderAddress
      );

      let currentAllowance: bigint;
      if (Array.isArray(allowanceResult)) {
        currentAllowance = BigInt(allowanceResult[0].toString());
      } else if (
        typeof allowanceResult === 'object' &&
        allowanceResult !== null
      ) {
        const value: any = Object.values(allowanceResult)[0];
        currentAllowance = BigInt(value.toString());
      } else {
        currentAllowance = BigInt(allowanceResult.toString());
      }

      const requiredAmount = BigInt(amount);

      if (currentAllowance < requiredAmount) {
        contract.connect(account);
        const approveCall = await contract.approve(
          spenderAddress,
          uint256.bnToUint256(amount)
        );

        console.log(
          'Approve transaction sent:',
          this.safeStringify(approveCall)
        );

        if (!approveCall?.transaction_hash) {
          throw new Error('No transaction hash in approve result');
        }

        await transactionMonitor.waitForTransaction(
          approveCall.transaction_hash,
          (status) => console.log('Approve status:', status)
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to approve token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
