import {
  Account,
  CallData,
  RawArgs,
  hash,
  CompiledSierra,
  CompiledSierraCasm,
  Abi,
} from 'starknet';
import {
  ContractDeployResult,
  ContractDeclareResult,
  ContractDeclareAndDeployResult,
} from '../types/types';
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
   * Loads contract compilation files from disk
   * @param {string} sierraPath - Path to the Sierra contract file
   * @param {string} casmPath - Path to the CASM contract file
   * @throws {Error} If files cannot be loaded or parsed
   */
  async loadContractCompilationFiles(sierraPath: string, casmPath: string) {
    try {
      this.compiledSierra = JSON.parse(
        fs.readFileSync(sierraPath).toString('ascii')
      );
      this.compiledCasm = JSON.parse(
        fs.readFileSync(casmPath).toString('ascii')
      );
    } catch (error) {
      throw new Error(`Failed to load contract files: ${error.message}`);
    }
  }

  /**
   * Checks if the current contract is already declared on StarkNet
   * @returns {Promise<{isDeclared: boolean, classHash?: string}>} Result indicating if declared and class hash if available
   */
  async isContractDeclared(): Promise<{
    isDeclared: boolean;
    classHash?: string;
  }> {
    try {
      const contractHash = hash.computeContractClassHash(this.compiledSierra);
      await this.account.getClassByHash(contractHash);
      return { isDeclared: true, classHash: contractHash };
    } catch (error) {
      return { isDeclared: false };
    }
  }

  /**
   * Declares a contract on StarkNet if not already declared
   * @returns {Promise<ContractDeclareResult>} The result of the declaration process
   * @throws {Error} If the declaration fails
   */
  async declareContract(): Promise<ContractDeclareResult> {
    const { isDeclared, classHash } = await this.isContractDeclared();

    if (isDeclared && classHash) {
      return {
        transactionHash: '',
        classHash: classHash,
      };
    }
    try {
      const declarePayload = {
        contract: this.compiledSierra,
        casm: this.compiledCasm,
      };

      const declareResponse = await this.account.declareIfNot(
        declarePayload,
        getV3DetailsPayload()
      );
      await this.account.waitForTransaction(declareResponse.transaction_hash);

      return {
        transactionHash: declareResponse.transaction_hash,
        classHash: declareResponse.class_hash,
      };
    } catch (error) {
      throw new Error(`Failed to declare contract: ${error.message}`);
    }
  }

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

      return {
        transactionHash: deployResponse.transaction_hash,
        contractAddress: deployResponse.contract_address,
      };
    } catch (error) {
      throw new Error(`Failed to deploy contract: ${error.message}`);
    }
  }

  /**
   * Declares and deploys a contract in a single operation
   * @param {RawArgs} [constructorArgs=[]] - Arguments for the contract constructor
   * @returns {Promise<ContractDeclareAndDeployResult>} The combined result of declaration and deployment
   * @throws {Error} If the declaration or deployment fails
   */
  async declareAndDeployContract(
    constructorArgs: RawArgs = []
  ): Promise<ContractDeclareAndDeployResult> {
    try {
      const contractCallData = new CallData(this.compiledSierra.abi);
      const constructorCalldata = contractCallData.compile(
        'constructor',
        constructorArgs
      );

      const declareAndDeployPayload = {
        contract: this.compiledSierra,
        casm: this.compiledCasm,
        constructorCalldata: constructorCalldata,
      };

      const response = await this.account.declareAndDeploy(
        declareAndDeployPayload,
        getV3DetailsPayload()
      );
      await this.account.waitForTransaction(response.deploy.transaction_hash);

      return {
        declare: {
          transactionHash: response.declare.transaction_hash,
          classHash: response.declare.class_hash.toString(),
        },
        deploy: {
          transactionHash: response.deploy.transaction_hash,
          contractAddress: response.deploy.contract_address,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to declare and deploy contract: ${error.message}`
      );
    }
  }

  /**
   * Extracts constructor parameters from contract ABI
   * @param {Abi} [abiObject] - Optional ABI object to use instead of the compiled Sierra ABI
   * @returns {Array<{name: string, type: string}>} Array of constructor parameter definitions
   */
  extractConstructorParams(
    abiObject?: Abi
  ): Array<{ name: string; type: string }> {
    const abi = abiObject ? abiObject : this.compiledSierra.abi;
    const constructorDef = abi.find(
      (item: { type: string }) => item.type === 'constructor'
    );

    if (
      !constructorDef ||
      !constructorDef.inputs ||
      !Array.isArray(constructorDef.inputs)
    ) {
      return [];
    }

    return constructorDef.inputs.map(
      (input: { name: string; type: string }) => ({
        name: input.name,
        type: input.type,
      })
    );
  }
}
