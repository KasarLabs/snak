"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTools = void 0;
const getSpecVersion_1 = require("../actions/getSpecVersion");
const getBlockWithTxHashes_1 = require("../actions/getBlockWithTxHashes");
const getBlockWithReceipts_1 = require("../actions/getBlockWithReceipts");
const getTransactionStatus_1 = require("../actions/getTransactionStatus");
const getClass_1 = require("../actions/getClass");
const getChainId_1 = require("../actions/getChainId");
const getSyncingStats_1 = require("../actions/getSyncingStats");
const getBlockNumber_1 = require("../actions/getBlockNumber");
const getBlockTransactionCount_1 = require("../actions/getBlockTransactionCount");
const getStorageAt_1 = require("../actions/getStorageAt");
const getClassAt_1 = require("../actions/getClassAt");
const getClassHash_1 = require("../actions/getClassHash");
const schema_1 = require("../schema");
const registerTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'get_chain_id',
        plugins: 'rpc',
        description: 'Retrieve the unique identifier (chain ID) of the Starknet network',
        execute: getChainId_1.getChainId,
    });
    StarknetToolRegistry.push({
        name: 'get_syncing_status',
        plugins: 'rpc',
        description: 'Retrieve the syncing status of the Starknet node',
        execute: getSyncingStats_1.getSyncingStats,
    });
    StarknetToolRegistry.push({
        name: 'get_class_hash',
        plugins: 'rpc',
        description: 'Retrieve the unique class hash for a contract at a specific address',
        schema: schema_1.getClassHashAtSchema,
        execute: getClassHash_1.getClassHashAt,
    });
    StarknetToolRegistry.push({
        name: 'get_spec_version',
        plugins: 'rpc',
        description: 'Get the current spec version from the Starknet RPC provider',
        execute: getSpecVersion_1.getSpecVersion,
    });
    StarknetToolRegistry.push({
        name: 'get_block_with_tx_hashes',
        plugins: 'rpc',
        description: 'Retrieve the details of a block, including transaction hashes',
        schema: schema_1.blockIdSchema,
        execute: getBlockWithTxHashes_1.getBlockWithTxHashes,
    });
    StarknetToolRegistry.push({
        name: 'get_block_with_receipts',
        plugins: 'rpc',
        description: 'Fetch block details with transaction receipts',
        schema: schema_1.blockIdSchema,
        execute: getBlockWithReceipts_1.getBlockWithReceipts,
    });
    StarknetToolRegistry.push({
        name: 'get_transaction_status',
        plugins: 'rpc',
        description: 'Fetch transaction status by hash',
        schema: schema_1.transactionHashSchema,
        execute: getTransactionStatus_1.getTransactionStatus,
    });
    StarknetToolRegistry.push({
        name: 'get_block_number',
        plugins: 'rpc',
        description: 'Get the current block number from the Starknet network',
        execute: getBlockNumber_1.getBlockNumber,
    });
    StarknetToolRegistry.push({
        name: 'get_block_transaction_count',
        plugins: 'rpc',
        description: 'Get the number of transactions in a specific block',
        schema: schema_1.blockIdSchema,
        execute: getBlockTransactionCount_1.getBlockTransactionCount,
    });
    StarknetToolRegistry.push({
        name: 'get_storage_at',
        plugins: 'rpc',
        description: 'Get the storage value at a specific slot for a contract',
        schema: schema_1.getStorageAtSchema,
        execute: getStorageAt_1.getStorageAt,
    });
    StarknetToolRegistry.push({
        name: 'get_class',
        plugins: 'rpc',
        description: 'Retrieve the complete class definition of a contract at a specified address and block',
        schema: schema_1.blockIdAndContractAddressSchema,
        execute: getClass_1.getClass,
    });
    StarknetToolRegistry.push({
        name: 'get_class_at',
        plugins: 'rpc',
        description: 'Fetch the class definition of a contract at a specific address in the latest state',
        schema: schema_1.getClassAtSchema,
        execute: getClassAt_1.getClassAt,
    });
};
exports.registerTools = registerTools;
//# sourceMappingURL=index.js.map