import { TransactionType, BigNumberish, RawArgs, CompiledContract, CairoAssembly, DeployAccountContractPayload, UniversalDeployerContractPayload, Call, DeclareContractPayload } from 'starknet';
export type InvocationInvokePayload = {
    contractAddress: string;
    entrypoint: string;
    calldata: string[];
};
export type Invocation_Invoke = {
    type: typeof TransactionType.INVOKE;
    payload: InvocationInvokePayload;
};
export type SimulateInvokeTransactionParams = {
    accountAddress: string;
    payloads: Call[];
};
export type Invocation_Deploy_Account_Payload = {
    classHash: string;
    constructorCalldata?: RawArgs;
    addressSalt?: BigNumberish;
    contractAddress?: string;
};
export type Invocation_Deploy_Account = {
    type: typeof TransactionType.DEPLOY_ACCOUNT;
    payload: Invocation_Deploy_Account_Payload;
};
export type SimulateDeployTransactionAccountParams = {
    accountAddress: string;
    payloads: DeployAccountContractPayload[];
};
export type Invocation_Deploy_Payload = {
    classHash: BigNumberish;
    salt?: string;
    unique?: boolean;
    constructorCalldata?: RawArgs;
};
export type Invocation_Deploy = {
    type: typeof TransactionType.DEPLOY;
    payload: Invocation_Deploy_Payload;
};
export type SimulateDeployTransactionParams = {
    accountAddress: string;
    payloads: UniversalDeployerContractPayload[];
};
export type Invocation_Declare = {
    type: typeof TransactionType.DECLARE;
    payload: DeclareContractPayload;
};
export type SimulateDeclareTransactionAccountParams = {
    accountAddress: string;
    contract: string | CompiledContract;
    classHash?: string;
    casm?: CairoAssembly;
    compiledClassHash?: string;
};
