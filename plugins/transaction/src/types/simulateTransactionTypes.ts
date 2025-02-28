import {
  TransactionType,
  BigNumberish,
  RawArgs,
  CompiledContract,
  CairoAssembly,
  DeployAccountContractPayload,
  UniversalDeployerContractPayload,
  Call,
  DeclareContractPayload,
} from 'starknet';

/**
 * Payload for an invocation transaction
 * @property {string} contractAddress - Target contract address
 * @property {string} entrypoint - Function to be called
 * @property {string[]} calldata - Arguments passed to the function
 */
export type InvocationInvokePayload = {
  contractAddress: string;
  entrypoint: string;
  calldata: string[];
};

/**
 * Invoke transaction structure
 * @property {TransactionType.INVOKE} type - Transaction type identifier
 * @property {InvocationInvokePayload} payload - Invoke transaction payload
 */
export type Invocation_Invoke = {
  type: typeof TransactionType.INVOKE;
  payload: InvocationInvokePayload;
};

/**
 * Parameters for simulating an invoke transaction
 * @property {string} accountAddress - Address of the account executing the transaction
 * @property {Call[]} payloads - Array of calls to be executed
 */
export type SimulateInvokeTransactionParams = {
  accountAddress: string;
  payloads: Call[];
};

/**
 * Payload for deploying an account contract
 * @property {string} classHash - Hash of the account contract class
 * @property {RawArgs} [constructorCalldata] - Optional constructor arguments
 * @property {BigNumberish} [addressSalt] - Optional salt for address generation
 * @property {string} [contractAddress] - Optional predefined contract address
 */
export type Invocation_Deploy_Account_Payload = {
  classHash: string;
  constructorCalldata?: RawArgs;
  addressSalt?: BigNumberish;
  contractAddress?: string;
};

/**
 * Deploy account transaction structure
 * @property {TransactionType.DEPLOY_ACCOUNT} type - Transaction type identifier
 * @property {Invocation_Deploy_Account_Payload} payload - Deploy account payload
 */
export type Invocation_Deploy_Account = {
  type: typeof TransactionType.DEPLOY_ACCOUNT;
  payload: Invocation_Deploy_Account_Payload;
};

/**
 * Parameters for simulating an account deployment
 * @property {string} accountAddress - Address of the deploying account
 * @property {DeployAccountContractPayload[]} payloads - Account deployment configurations
 */
export type SimulateDeployTransactionAccountParams = {
  accountAddress: string;
  payloads: DeployAccountContractPayload[];
};

/**
 * Payload for deploying a contract
 * @property {BigNumberish} classHash - Hash of the contract class
 * @property {string} [salt] - Optional salt for address generation
 * @property {boolean} [unique] - Optional flag for unique deployment
 * @property {RawArgs} [constructorCalldata] - Optional constructor arguments
 */
export type Invocation_Deploy_Payload = {
  classHash: BigNumberish;
  salt?: string;
  unique?: boolean;
  constructorCalldata?: RawArgs;
};

/**
 * Deploy transaction structure
 * @property {TransactionType.DEPLOY} type - Transaction type identifier
 * @property {Invocation_Deploy_Payload} payload - Deploy payload
 */
export type Invocation_Deploy = {
  type: typeof TransactionType.DEPLOY;
  payload: Invocation_Deploy_Payload;
};

/**
 * Parameters for simulating a contract deployment
 * @property {string} accountAddress - Address of the deploying account
 * @property {UniversalDeployerContractPayload[]} payloads - Contract deployment configurations
 */
export type SimulateDeployTransactionParams = {
  accountAddress: string;
  payloads: UniversalDeployerContractPayload[];
};

export type Invocation_Declare = {
  type: typeof TransactionType.DECLARE;
  payload: DeclareContractPayload;
};

/**
 * Parameters for simulating a declare transaction
 * @property {string} accountAddress - Address of the declaring account
 * @property {string | CompiledContract} contract - Contract to be declared
 * @property {string} [classHash] - Optional class hash
 * @property {CairoAssembly} [casm] - Optional Cairo assembly
 * @property {string} [compiledClassHash] - Optional compiled class hash
 */
export type SimulateDeclareTransactionAccountParams = {
  accountAddress: string;
  contract: string | CompiledContract;
  classHash?: string;
  casm?: CairoAssembly;
  compiledClassHash?: string;
};
