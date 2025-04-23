import {
  StarknetTool,
  StarknetAgentInterface,
} from '@snakagent/core';
import {
  simulateInvokeTransactionSchema,
  simulateDeployAccountTransactionSchema,
  simulateDeployTransactionSchema,
  simulateDeclareTransactionSchema,
} from '../schema/index.js';
import {
  simulateDeployAccountTransaction,
  simulateInvokeTransaction,
  simulateDeployTransaction,
  simulateDeclareTransaction,
} from '../actions/simulateTransaction.js';

export const registerTools = (
  StarknetToolRegistry: StarknetTool[],
  agent?: StarknetAgentInterface
) => {
  // Simulate transactions
  StarknetToolRegistry.push({
    name: 'simulate_transaction',
    plugins: 'transaction',
    description: 'Simulate a transaction without executing it',
    schema: simulateInvokeTransactionSchema,
    execute: simulateInvokeTransaction,
  });
  StarknetToolRegistry.push({
    name: 'simulate_deploy_transaction',
    plugins: 'transaction',
    description: 'Simulate Deploy transaction',
    schema: simulateDeployTransactionSchema,
    execute: simulateDeployTransaction,
  });

  StarknetToolRegistry.push({
    name: 'simulate_declare_transaction',
    plugins: 'transaction',
    description: 'Simulate Declare transaction',
    schema: simulateDeclareTransactionSchema,
    execute: simulateDeclareTransaction,
  });

  StarknetToolRegistry.push({
    name: 'simulate_deploy_account_transaction',
    plugins: 'transaction',
    description: 'Simulate Deploy Account transaction',
    schema: simulateDeployAccountTransactionSchema,
    execute: simulateDeployAccountTransaction,
  });
};
