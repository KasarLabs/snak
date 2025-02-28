import { Account, RawArgs, CompiledSierra, CompiledSierraCasm, Abi } from 'starknet';
import { ContractDeployResult, ContractDeclareResult, ContractDeclareAndDeployResult } from '../types/types';
export declare class ContractManager {
    account: Account;
    compiledSierra: CompiledSierra;
    compiledCasm: CompiledSierraCasm;
    constructor(account: Account);
    loadContractCompilationFiles(sierraPath: string, casmPath: string): Promise<void>;
    isContractDeclared(): Promise<{
        isDeclared: boolean;
        classHash?: string;
    }>;
    declareContract(): Promise<ContractDeclareResult>;
    deployContract(classHash: string, abi?: Abi, constructorArgs?: RawArgs): Promise<ContractDeployResult>;
    declareAndDeployContract(constructorArgs?: RawArgs): Promise<ContractDeclareAndDeployResult>;
    extractConstructorParams(abiObject?: Abi): Array<{
        name: string;
        type: string;
    }>;
}
