import {
  StarknetAgentInterface,
  StarknetTool,
  StarknetToolRegistry,
} from '@starknet-agent-kit/agents';
import { getSpecVersion } from '../src/actions/getSpecVersion.js';
import { getBlockWithTxHashes } from '../src/actions/getBlockWithTxHashes.js';
import { getBlockWithReceipts } from '../src/actions/getBlockWithReceipts.js';
import { getTransactionStatus } from '../src/actions/getTransactionStatus.js';
import { getClass } from '../src/actions/getClass.js';
import { getChainId } from '../src/actions/getChainId.js';
import { getSyncingStats } from '../src/actions/getSyncingStats.js';
import { getBlockNumber } from '../src/actions/getBlockNumber.js';
import { getBlockTransactionCount } from '../src/actions/getBlockTransactionCount.js';
import { getStorageAt } from '../src/actions/getStorageAt.js';
import { getClassAt } from '../src/actions/getClassAt.js';
import { getClassHashAt } from '../src/actions/getClassHash.js';
import {
  blockIdAndContractAddressSchema,
  blockIdSchema,
  getClassAtSchema,
  getClassHashAtSchema,
  getStorageAtSchema,
  transactionHashSchema,
} from '../src/schema/index.js';

export const registerRPCTools = () => {
  StarknetToolRegistry.registerTool({
    name: 'get_chain_id',
    plugins: 'rpc',
    description:
      'Retrieve the unique identifier (chain ID) of the Starknet network',
    execute: getChainId,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_syncing_status',
    plugins: 'rpc',
    description: 'Retrieve the syncing status of the Starknet node',
    execute: getSyncingStats,
  });

  // Add remaining tools from createTools2
  StarknetToolRegistry.registerTool({
    name: 'get_class_hash',
    plugins: 'rpc',
    description:
      'Retrieve the unique class hash for a contract at a specific address',
    schema: getClassHashAtSchema,
    execute: getClassHashAt,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_spec_version',
    plugins: 'rpc',
    description: 'Get the current spec version from the Starknet RPC provider',
    execute: getSpecVersion,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_block_with_tx_hashes',
    plugins: 'rpc',
    description:
      'Retrieve the details of a block, including transaction hashes',
    schema: blockIdSchema,
    execute: getBlockWithTxHashes,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_block_with_receipts',
    plugins: 'rpc',
    description: 'Fetch block details with transaction receipts',
    schema: blockIdSchema,
    execute: getBlockWithReceipts,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_transaction_status',
    plugins: 'rpc',
    description: 'Fetch transaction status by hash',
    schema: transactionHashSchema,
    execute: getTransactionStatus,
  });

  // Register blockchain query tools
  StarknetToolRegistry.registerTool({
    name: 'get_block_number',
    plugins: 'rpc',
    description: 'Get the current block number from the Starknet network',
    execute: getBlockNumber,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_block_transaction_count',
    plugins: 'rpc',
    description: 'Get the number of transactions in a specific block',
    schema: blockIdSchema,
    execute: getBlockTransactionCount,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_storage_at',
    plugins: 'rpc',
    description: 'Get the storage value at a specific slot for a contract',
    schema: getStorageAtSchema,
    execute: getStorageAt,
  });

  // Register contract-related tools
  StarknetToolRegistry.registerTool({
    name: 'get_class',
    plugins: 'rpc',
    description:
      'Retrieve the complete class definition of a contract at a specified address and block',
    schema: blockIdAndContractAddressSchema,
    execute: getClass,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_class_at',
    plugins: 'rpc',
    description:
      'Fetch the class definition of a contract at a specific address in the latest state',
    schema: getClassAtSchema,
    execute: getClassAt,
  });
};
