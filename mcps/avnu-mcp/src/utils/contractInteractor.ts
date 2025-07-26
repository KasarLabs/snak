import { Account, Contract, Call, CallData, hash, EstimateFee } from 'starknet';
import {
  BaseUtilityClass,
  ContractDeployResult,
  TransactionResult,
} from '../types/index.js';

export class ContractInteractor implements BaseUtilityClass {
  constructor(public provider: any) {}

  async deployContract(
    account: Account,
    classHash: string,
    constructorCalldata: any[] = [],
    salt?: string
  ): Promise<ContractDeployResult> {
    try {
      const deployPayload = {
        classHash,
        constructorCalldata: CallData.compile(constructorCalldata),
        salt: salt || hash.getSelectorFromName(Math.random().toString()),
      };

      const { transaction_hash, contract_address } =
        await account.deploy(deployPayload);
      await this.provider.waitForTransaction(transaction_hash);

      return {
        transactionHash: transaction_hash,
        contractAddress: contract_address,
      };
    } catch (error) {
      throw new Error(`Failed to deploy contract: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async estimateContractDeploy(
    account: Account,
    classHash: string,
    constructorCalldata: any[] = [],
    salt?: string
  ): Promise<EstimateFee> {
    try {
      const deployPayload = {
        classHash,
        constructorCalldata: CallData.compile(constructorCalldata),
        salt: salt || hash.getSelectorFromName(Math.random().toString()),
      };

      return account.estimateDeployFee(deployPayload);
    } catch (error) {
      throw new Error(`Failed to estimate contract deploy: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async multicall(account: Account, calls: Call[]): Promise<TransactionResult> {
    try {
      const { transaction_hash } = await account.execute(calls);
      await this.provider.waitForTransaction(transaction_hash);

      return {
        status: 'success',
        transactionHash: transaction_hash,
      };
    } catch (error) {
      return {
        status: 'failure',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async estimateMulticall(
    account: Account,
    calls: Call[]
  ): Promise<EstimateFee> {
    try {
      return account.estimateInvokeFee(calls);
    } catch (error) {
      throw new Error(`Failed to estimate multicall: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  createContract(abi: any[], address: string, account?: Account): Contract {
    return new Contract(abi, address, account || this.provider);
  }

  async readContract(
    contract: Contract,
    method: string,
    args: any[] = []
  ): Promise<any> {
    try {
      return await contract.call(method, args);
    } catch (error) {
      throw new Error(`Failed to read contract: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async writeContract(
    contract: Contract,
    method: string,
    args: any[] = []
  ): Promise<TransactionResult> {
    try {
      const { transaction_hash } = await contract.invoke(method, args);
      await this.provider.waitForTransaction(transaction_hash);

      return {
        status: 'success',
        transactionHash: transaction_hash,
      };
    } catch (error) {
      return {
        status: 'failure',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async estimateContractWrite(
    contract: Contract,
    method: string,
    args: any[] = []
  ): Promise<EstimateFee> {
    if (!contract.account) {
      throw new Error(
        'Contract must be connected to an account to estimate fees'
      );
    }

    try {
      return await contract.estimate(method, args);
    } catch (error) {
      throw new Error(`Failed to estimate contract write: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  formatTokenAmount(amount: string | number, decimals: number = 18): string {
    const value = typeof amount === 'string' ? amount : amount.toString();
    const [whole, fraction = ''] = value.split('.');
    const paddedFraction = fraction.padEnd(decimals, '0');
    return whole + paddedFraction;
  }

  parseTokenAmount(amount: string, decimals: number = 18): string {
    const amountBigInt = BigInt(amount);
    const divisor = BigInt(10) ** BigInt(decimals);
    const wholePart = amountBigInt / divisor;
    const fractionPart = amountBigInt % divisor;
    const paddedFraction = fractionPart.toString().padStart(decimals, '0');
    return `${wholePart}.${paddedFraction}`;
  }
}
