import { Account, TransactionType } from 'starknet';
import {
  Invocation_Invoke,
  Invocation_Deploy_Account,
  SimulateDeployTransactionAccountParams,
  SimulateInvokeTransactionParams,
  SimulateDeployTransactionParams,
  Invocation_Deploy,
  SimulateDeclareTransactionAccountParams,
  Invocation_Declare,
} from '../types/simulateTransactionTypes';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { TransactionReponseFormat } from '../utils/outputSimulateTransaction';
import { DEFAULT_NONCE } from '../constant';

/**
 * Simulates invoke transaction
 * @param {StarknetAgentInterface} agent - Starknet agent
 * @param {SimulateInvokeTransactionParams} params - Transaction parameters
 * @returns {Promise<string>} JSON string with simulation result
 */
export const simulateInvokeTransaction = async (
  agent: StarknetAgentInterface,
  params: SimulateInvokeTransactionParams
) => {
  try {
    const provider = agent.getProvider();
    const accountCredentials = agent.getAccountCredentials();
    const accountAddress = accountCredentials?.accountPublicKey;
    const accountPrivateKey = accountCredentials?.accountPrivateKey;
    if (!accountAddress || !accountPrivateKey) {
      throw new Error('Account address or private key not configured');
    }

    const account = new Account(provider, accountAddress, accountPrivateKey);

    const invocations: Invocation_Invoke[] = params.payloads.map((payload) => {
      return {
        type: TransactionType.INVOKE,
        payload: {
          contractAddress: payload.contractAddress,
          entrypoint: payload.entrypoint,
          calldata: payload.calldata as string[],
        },
      };
    });

    const simulate_transaction = await account.simulateTransaction(invocations);

    const transaction_output = TransactionReponseFormat(simulate_transaction);

    return JSON.stringify({
      status: 'success',
      transaction_output: transaction_output,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Simulates deploy account transaction
 * @param {StarknetAgentInterface} agent - Starknet agent
 * @param {SimulateDeployTransactionAccountParams} params - Deploy account parameters
 * @returns {Promise<string>} JSON string with simulation result
 */
export const simulateDeployAccountTransaction = async (
  agent: StarknetAgentInterface,
  params: SimulateDeployTransactionAccountParams
) => {
  try {
    const provider = agent.getProvider();
    const accountCredentials = agent.getAccountCredentials();
    const account = new Account(
      provider,
      accountCredentials.accountPublicKey,
      accountCredentials.accountPrivateKey
    );
    const accountAddress = accountCredentials?.accountPublicKey;
    const accountPrivateKey = accountCredentials?.accountPrivateKey;
    if (!accountAddress || !accountPrivateKey) {
      throw new Error('Account address not configured');
    }

    const invocations: Invocation_Deploy_Account[] = params.payloads.map(
      (payload) => {
        return {
          type: TransactionType.DEPLOY_ACCOUNT,
          payload: {
            classHash: payload.classHash,
            constructorCalldata: payload.constructorCalldata ?? [],
            addressSalt: payload.addressSalt,
            contractAddress: payload.contractAddress,
          },
        };
      }
    );

    const simulate_transaction = await account.simulateTransaction(
      invocations,
      {
        nonce: DEFAULT_NONCE,
      }
    );
    const transaction_output = TransactionReponseFormat(simulate_transaction);

    return JSON.stringify({
      status: 'success',
      transaction_output: transaction_output,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Simulates deploy transaction
 * @param {StarknetAgentInterface} agent - Starknet agent
 * @param {SimulateDeployTransactionParams} params - Deploy parameters
 * @returns {Promise<string>} JSON string with simulation result
 */
export const simulateDeployTransaction = async (
  agent: StarknetAgentInterface,
  params: SimulateDeployTransactionParams
) => {
  try {
    const provider = agent.getProvider();
    const accountCredentials = agent.getAccountCredentials();
    const account = new Account(
      provider,
      accountCredentials.accountPublicKey,
      accountCredentials.accountPrivateKey
    );

    const invocations: Invocation_Deploy[] = params.payloads.map((payload) => {
      return {
        type: TransactionType.DEPLOY,
        payload: {
          classHash: payload.classHash,
          salt: payload.salt,
          constructorCalldata: payload.constructorCalldata,
          unique: payload.unique,
        },
      };
    });

    const simulate_transaction = await account.simulateTransaction(invocations);

    const transaction_output = TransactionReponseFormat(simulate_transaction);

    return JSON.stringify({
      status: 'success',
      transaction_output: transaction_output,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Simulates declare transaction
 * @param {StarknetAgentInterface} agent - Starknet agent
 * @param {SimulateDeclareTransactionAccountParams} params - Declare parameters
 * @returns {Promise<string>} JSON string with simulation result
 */
export const simulateDeclareTransaction = async (
  agent: StarknetAgentInterface,
  params: SimulateDeclareTransactionAccountParams
) => {
  try {
    const provider = agent.getProvider();
    const accountCredentials = agent.getAccountCredentials();
    const account = new Account(
      provider,
      accountCredentials.accountPublicKey,
      accountCredentials.accountPrivateKey
    );

    const invocations: Invocation_Declare[] = [
      {
        type: TransactionType.DECLARE,
        payload: {
          contract: params.contract,
          classHash: params.classHash,
          casm: params.casm,
          compiledClassHash: params.compiledClassHash,
        },
      },
    ];

    const simulate_transaction = await account.simulateTransaction(invocations);
    const transaction_output = TransactionReponseFormat(simulate_transaction);

    return JSON.stringify({
      status: 'success',
      transaction_output: transaction_output,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
