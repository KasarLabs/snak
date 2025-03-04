import {
  Account,
  CallData,
  RawArgs,
  hash,
  CompiledSierra,
  CompiledSierraCasm,
  Abi,
} from 'starknet';
import { ContractDeployResult } from '../types/types';
import * as fs from 'fs';
import { getV3DetailsPayload } from './utils';

/**
 * Class for managing StarkNet contract operations
 */
export class ContractManager {
  compiledSierra: CompiledSierra;
  compiledCasm: CompiledSierraCasm;

  constructor(public account: Account) {}

  /**
   * Deploys a contract on StarkNet using a specific class hash
   * @param {string} classHash - The class hash of the contract to deploy
   * @param {Abi} [abi] - Optional ABI to use instead of the compiled Sierra ABI
   * @param {RawArgs} [constructorArgs=[]] - Arguments for the contract constructor
   * @returns {Promise<ContractDeployResult>} The result of the deployment process
   * @throws {Error} If the deployment fails
   */
  async deployContract(
    classHash: string,
    abi?: Abi,
    constructorArgs: RawArgs = []
  ): Promise<ContractDeployResult> {
    try {
      const contractCallData = new CallData(
        abi ? abi : this.compiledSierra.abi
      );

      const constructorCalldata = contractCallData.compile(
        'constructor',
        constructorArgs
      );

      const deployPayload = {
        classHash,
        constructorCalldata: constructorCalldata,
      };

      const deployResponse = await this.account.deployContract(
        deployPayload,
        getV3DetailsPayload()
      );
      await this.account.waitForTransaction(deployResponse.transaction_hash);

      console.log(
        'Contract deployed at address: ',
        deployResponse.contract_address
      );
      return {
        transactionHash: deployResponse.transaction_hash,
        contractAddress: deployResponse.contract_address,
      };
    } catch (error) {
      throw new Error(`Failed to deploy contract: ${error.message}`);
    }
  }
}
