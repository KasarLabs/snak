"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTools = void 0;
const schema_1 = require("../schemas/schema");
const getAllowance_1 = require("../actions/getAllowance");
const getTotaSupply_1 = require("../actions/getTotaSupply");
const transferFrom_1 = require("../actions/transferFrom");
const getBalances_1 = require("../actions/getBalances");
const approve_1 = require("../actions/approve");
const transfer_1 = require("../actions/transfer");
const getAllowance_2 = require("../actions/getAllowance");
const getAllowance_3 = require("../actions/getAllowance");
const deployERC20_1 = require("../actions/deployERC20");
const registerTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'erc20_get_allowance',
        plugins: 'erc20',
        description: 'Get the amount of tokens that a spender is allowed to spend on behalf of an owner. Requires the token symbol (e.g., ETH, USDC), the owner address and the spender address.',
        schema: schema_1.getAllowanceSchema,
        execute: getAllowance_1.getAllowance,
    });
    StarknetToolRegistry.push({
        name: 'erc20_get_my_given_allowance',
        plugins: 'erc20',
        description: 'Get the amount of tokens that a spender is allowed to spend on your behalf. Requires the token symbol (e.g., ETH, USDC) and the spender address.',
        schema: schema_1.getMyGivenAllowanceSchema,
        execute: getAllowance_2.getMyGivenAllowance,
    });
    StarknetToolRegistry.push({
        name: 'erc20_get_allowance_given_to_me',
        plugins: 'erc20',
        description: 'Get the amount of tokens that a you are allowed to spend on the behalf of an owner. Requires the token symbol (e.g., ETH, USDC) and the owner address.',
        schema: schema_1.getAllowanceGivenToMeSchema,
        execute: getAllowance_3.getAllowanceGivenToMe,
    });
    StarknetToolRegistry.push({
        name: 'erc20_get_total_supply',
        plugins: 'erc20',
        description: 'Get the total supply of an token token',
        schema: schema_1.getTotalSupplySchema,
        execute: getTotaSupply_1.getTotalSupply,
    });
    StarknetToolRegistry.push({
        name: 'erc20_transfer_from',
        plugins: 'erc20',
        description: 'Transfer tokens from one address to another using an allowance',
        schema: schema_1.transferFromSchema,
        execute: transferFrom_1.transferFrom,
    });
    StarknetToolRegistry.push({
        name: 'erc20_get_balance',
        plugins: 'erc20',
        description: 'Get the balance of an asset for a given wallet address',
        schema: schema_1.getBalanceSchema,
        execute: getBalances_1.getBalance,
    });
    StarknetToolRegistry.push({
        name: 'erc20_get_own_balance',
        plugins: 'erc20',
        description: 'Get the balance of an asset in your wallet',
        schema: schema_1.getOwnBalanceSchema,
        execute: getBalances_1.getOwnBalance,
    });
    StarknetToolRegistry.push({
        name: 'erc20_approve',
        plugins: 'erc20',
        description: 'Approve a spender to spend tokens on your behalf',
        schema: schema_1.approveSchema,
        execute: approve_1.approve,
    });
    StarknetToolRegistry.push({
        name: 'erc20_transfer',
        plugins: 'erc20',
        description: 'Transfer ERC20 tokens to a specific address',
        schema: schema_1.transferSchema,
        execute: transfer_1.transfer,
    });
    StarknetToolRegistry.push({
        name: 'erc20_deploy_erc20',
        plugins: 'erc20',
        description: 'Deploy a new ERC20 contract, returns the address of the deployed contract',
        schema: schema_1.deployERC20Schema,
        execute: deployERC20_1.deployERC20Contract,
    });
};
exports.registerTools = registerTools;
//# sourceMappingURL=index.js.map