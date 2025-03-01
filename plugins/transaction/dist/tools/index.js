"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTools = void 0;
const schema_1 = require("../schema");
const simulateTransaction_1 = require("../actions/simulateTransaction");
const registerTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'simulate_transaction',
        plugins: 'transaction',
        description: 'Simulate a transaction without executing it',
        schema: schema_1.simulateInvokeTransactionSchema,
        execute: simulateTransaction_1.simulateInvokeTransaction,
    });
    StarknetToolRegistry.push({
        name: 'simulate_deploy_transaction',
        plugins: 'transaction',
        description: 'Simulate Deploy transaction',
        schema: schema_1.simulateDeployTransactionSchema,
        execute: simulateTransaction_1.simulateDeployTransaction,
    });
    StarknetToolRegistry.push({
        name: 'simulate_declare_transaction',
        plugins: 'transaction',
        description: 'Simulate Declare transaction',
        schema: schema_1.simulateDeclareTransactionSchema,
        execute: simulateTransaction_1.simulateDeclareTransaction,
    });
    StarknetToolRegistry.push({
        name: 'simulate_deploy_account_transaction',
        plugins: 'transaction',
        description: 'Simulate Deploy Account transaction',
        schema: schema_1.simulateDeployAccountTransactionSchema,
        execute: simulateTransaction_1.simulateDeployAccountTransaction,
    });
};
exports.registerTools = registerTools;
//# sourceMappingURL=index.js.map