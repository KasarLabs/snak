import {
  Account,
  CallData,
  RawArgs,
  hash,
  CompiledSierra,
  CompiledSierraCasm,
  Abi,
  cairo,
} from 'starknet';

import * as fs from 'fs';
import { getV3DetailsPayload } from './utils';

/**
 * Class for managing StarkNet contract operations
 */
export class ContractManager {
  compiledSierra: CompiledSierra;
  compiledCasm: CompiledSierraCasm;
  abi: Abi;

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

  setAbi(abi: Abi) {
    this.abi = abi;
  }

  async loadAbiFile(abiPath?: string) {
    try {
      if (abiPath)
        this.abi = JSON.parse(fs.readFileSync(abiPath).toString('ascii'));
      else this.abi = this.compiledSierra.abi;
    } catch (error) {
      throw new Error(`Failed to load ABI file: ${error.message}`);
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
  async declareContract(): Promise<any> {
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

      const declareResponse = await this.account.declare(
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
   * @param {RawArgs} [constructorArgs=[]] - Arguments for the contract constructor
   * @returns {Promise<ContractDeployResult>} The result of the deployment process
   * @throws {Error} If the deployment fails
   */
  async deployContract(
    classHash: string,
    constructorArgs: RawArgs = []
  ): Promise<any> {
    try {
      const contractCallData = new CallData(this.abi);
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
  async declareAndDeployContract(constructorArgs: RawArgs = []): Promise<any> {
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
  extractConstructorParams(): Array<{ name: string; type: string }> {
    const constructorDef = this.abi.find(
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

  /**
   * Convertit les arguments du constructeur de chaînes en types appropriés
   * @param paramDefs - Définitions des paramètres du constructeur extraites de l'ABI
   * @param argsStrings - Arguments sous forme de chaînes à convertir
   * @returns Les arguments convertis dans les types JavaScript appropriés
   */
  convertConstructorArgs(
    paramDefs: Array<{ name: string; type: string }>,
    argsStrings: string[]
  ): RawArgs {
    if (!argsStrings || argsStrings.length === 0) {
      return [];
    }

    if (paramDefs.length !== argsStrings.length) {
      throw new Error(
        `Expected ${paramDefs.length} constructor arguments but got ${argsStrings.length}`
      );
    }

    const typedArgs: RawArgs = [];

    for (let i = 0; i < paramDefs.length; i++) {
      const param = paramDefs[i];
      const argString = argsStrings[i];
      typedArgs.push(this.convertStringToType(argString, param.type));
    }

    return typedArgs;
  }

  /**
   * Convertit une chaîne en type JavaScript approprié selon le type Cairo
   * @param value - La chaîne à convertir
   * @param type - Le type Cairo
   * @returns La valeur convertie dans le type JavaScript approprié
   */
  convertStringToType(value: string, type: string): any {
    if (value === undefined || value === null) {
      throw new Error(`Missing value for type ${type}`);
    }

    const simpleType = type.includes('::') ? type.split('::').pop() : type;

    switch (true) {
      case simpleType === 'felt252' ||
        /^u(8|16|32|64|128)$/.test(simpleType || ''):
        return BigInt(value);
      case simpleType === 'u256':
        try {
          return cairo.uint256(value);
        } catch (error) {
          try {
            const parsed = JSON.parse(value);
            if (parsed.low !== undefined && parsed.high !== undefined) {
              return {
                low: BigInt(parsed.low),
                high: BigInt(parsed.high),
              };
            }
            throw new Error(`Invalid u256 format: ${value}`);
          } catch {
            throw error;
          }
        }
      case simpleType === 'bool':
        return value.toLowerCase() === 'true' || value === '1';
      case simpleType === 'ContractAddress' ||
        simpleType === 'EthAddress' ||
        simpleType === 'ClassHash':
        return value.startsWith('0x') ? value : `0x${value}`;
      case simpleType === 'ByteArray' || simpleType === 'bytearray':
        return value;
      case type.includes('Array'):
        if (value.includes(',')) {
          const elements = value.split(',').map((item) => item.trim());
          return elements;
        }
        try {
          if (value.startsWith('[') && value.endsWith(']')) {
            return JSON.parse(value);
          }
        } catch {}

        return value;
      default:
        return value;
    }
  }
}
