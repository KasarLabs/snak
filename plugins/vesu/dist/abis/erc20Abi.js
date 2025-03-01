"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.erc20Abi = void 0;
exports.erc20Abi = [
    {
        type: 'function',
        name: 'name',
        inputs: [],
        outputs: [
            {
                type: 'core::felt252',
            },
        ],
        state_mutability: 'view',
    },
    {
        type: 'function',
        name: 'symbol',
        inputs: [],
        outputs: [
            {
                type: 'core::felt252',
            },
        ],
        state_mutability: 'view',
    },
    {
        type: 'function',
        name: 'decimals',
        inputs: [],
        outputs: [
            {
                type: 'core::integer::u8',
            },
        ],
        state_mutability: 'view',
    },
    {
        type: 'function',
        name: 'balance_of',
        inputs: [
            {
                name: 'account',
                type: 'core::starknet::contract_address::ContractAddress',
            },
        ],
        outputs: [
            {
                type: 'core::integer::u256',
            },
        ],
        state_mutability: 'view',
    },
    {
        type: 'function',
        name: 'balanceOf',
        inputs: [
            {
                name: 'account',
                type: 'core::starknet::contract_address::ContractAddress',
            },
        ],
        outputs: [
            {
                type: 'core::integer::u256',
            },
        ],
        state_mutability: 'view',
    },
    {
        type: 'function',
        name: 'allowance',
        inputs: [
            {
                name: 'owner',
                type: 'core::starknet::contract_address::ContractAddress',
            },
            {
                name: 'spender',
                type: 'core::starknet::contract_address::ContractAddress',
            },
        ],
        outputs: [
            {
                type: 'core::integer::u256',
            },
        ],
        state_mutability: 'view',
    },
    {
        type: 'function',
        name: 'approve',
        inputs: [
            {
                name: 'spender',
                type: 'core::starknet::contract_address::ContractAddress',
            },
            {
                name: 'amount',
                type: 'core::integer::u256',
            },
        ],
        outputs: [
            {
                type: 'core::bool',
            },
        ],
        state_mutability: 'external',
    },
    {
        type: 'function',
        name: 'transfer',
        inputs: [
            {
                name: 'recipient',
                type: 'core::starknet::contract_address::ContractAddress',
            },
            {
                name: 'amount',
                type: 'core::integer::u256',
            },
        ],
        outputs: [
            {
                type: 'core::bool',
            },
        ],
        state_mutability: 'external',
    },
];
//# sourceMappingURL=erc20Abi.js.map