import { StarknetTool } from '@snakagent/core';
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

export const registerTools = (SnakToolRegistry: StarknetTool[]) => {
  // Simulate transactions
  SnakToolRegistry.push({
    name: 'simulate_transaction',
    plugins: 'transaction',
    description: 'Simulate a transaction without executing it',
    schema: simulateInvokeTransactionSchema,
    execute: simulateInvokeTransaction,
  });
  SnakToolRegistry.push({
    name: 'simulate_deploy_transaction',
    plugins: 'transaction',
    description: 'Simulate Deploy transaction',
    schema: simulateDeployTransactionSchema,
    execute: simulateDeployTransaction,
  });

  SnakToolRegistry.push({
    name: 'simulate_declare_transaction',
    plugins: 'transaction',
    description: 'Simulate Declare transaction',
    schema: simulateDeclareTransactionSchema,
    execute: simulateDeclareTransaction,
  });

  SnakToolRegistry.push({
    name: 'simulate_deploy_account_transaction',
    plugins: 'transaction',
    description: 'Simulate Deploy Account transaction',
    schema: simulateDeployAccountTransactionSchema,
    execute: simulateDeployAccountTransaction,
  });
};
