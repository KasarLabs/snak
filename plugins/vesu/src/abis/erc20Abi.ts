export const erc20Abi = [
  // name
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
  // symbol
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
  // decimals
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
  // balance_of
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
  // balanceOf
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
  // allowance
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
  // approve
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
  // transfer
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
] as const;
