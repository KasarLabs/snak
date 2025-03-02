export const DEPLOY_ERC20_ABI_SEPOLIA = [
  {
    name: 'ERC20MixinImpl',
    type: 'impl',
    interface_name: 'openzeppelin_token::erc20::interface::IERC20Mixin',
  },
  {
    name: 'core::integer::u256',
    type: 'struct',
    members: [
      {
        name: 'low',
        type: 'core::integer::u128',
      },
      {
        name: 'high',
        type: 'core::integer::u128',
      },
    ],
  },
  {
    name: 'core::bool',
    type: 'enum',
    variants: [
      {
        name: 'False',
        type: '()',
      },
      {
        name: 'True',
        type: '()',
      },
    ],
  },
  {
    name: 'core::byte_array::ByteArray',
    type: 'struct',
    members: [
      {
        name: 'data',
        type: 'core::array::Array::<core::bytes_31::bytes31>',
      },
      {
        name: 'pending_word',
        type: 'core::felt252',
      },
      {
        name: 'pending_word_len',
        type: 'core::integer::u32',
      },
    ],
  },
  {
    name: 'openzeppelin_token::erc20::interface::IERC20Mixin',
    type: 'interface',
    items: [
      {
        name: 'total_supply',
        type: 'function',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'balance_of',
        type: 'function',
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
        name: 'allowance',
        type: 'function',
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
        name: 'transfer',
        type: 'function',
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
      {
        name: 'transfer_from',
        type: 'function',
        inputs: [
          {
            name: 'sender',
            type: 'core::starknet::contract_address::ContractAddress',
          },
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
      {
        name: 'approve',
        type: 'function',
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
        name: 'name',
        type: 'function',
        inputs: [],
        outputs: [
          {
            type: 'core::byte_array::ByteArray',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'symbol',
        type: 'function',
        inputs: [],
        outputs: [
          {
            type: 'core::byte_array::ByteArray',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'decimals',
        type: 'function',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u8',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'totalSupply',
        type: 'function',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'balanceOf',
        type: 'function',
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
        name: 'transferFrom',
        type: 'function',
        inputs: [
          {
            name: 'sender',
            type: 'core::starknet::contract_address::ContractAddress',
          },
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
    ],
  },
  {
    name: 'constructor',
    type: 'constructor',
    inputs: [
      {
        name: 'name',
        type: 'core::byte_array::ByteArray',
      },
      {
        name: 'symbol',
        type: 'core::byte_array::ByteArray',
      },
      {
        name: 'fixed_supply',
        type: 'core::integer::u256',
      },
      {
        name: 'recipient',
        type: 'core::starknet::contract_address::ContractAddress',
      },
    ],
  },
  {
    kind: 'struct',
    name: 'openzeppelin_token::erc20::erc20::ERC20Component::Transfer',
    type: 'event',
    members: [
      {
        kind: 'key',
        name: 'from',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        kind: 'key',
        name: 'to',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        kind: 'data',
        name: 'value',
        type: 'core::integer::u256',
      },
    ],
  },
  {
    kind: 'struct',
    name: 'openzeppelin_token::erc20::erc20::ERC20Component::Approval',
    type: 'event',
    members: [
      {
        kind: 'key',
        name: 'owner',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        kind: 'key',
        name: 'spender',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        kind: 'data',
        name: 'value',
        type: 'core::integer::u256',
      },
    ],
  },
  {
    kind: 'enum',
    name: 'openzeppelin_token::erc20::erc20::ERC20Component::Event',
    type: 'event',
    variants: [
      {
        kind: 'nested',
        name: 'Transfer',
        type: 'openzeppelin_token::erc20::erc20::ERC20Component::Transfer',
      },
      {
        kind: 'nested',
        name: 'Approval',
        type: 'openzeppelin_token::erc20::erc20::ERC20Component::Approval',
      },
    ],
  },
  {
    kind: 'enum',
    name: 'token::erc20::ERC20Token::Event',
    type: 'event',
    variants: [
      {
        kind: 'flat',
        name: 'ERC20Event',
        type: 'openzeppelin_token::erc20::erc20::ERC20Component::Event',
      },
    ],
  },
];


export const DEPLOY_ERC20_ABI_MAINNET = [
  {
    type: 'impl',
    name: 'ERC20MixinImpl',
    interface_name: 'openzeppelin::token::erc20::interface::IERC20'
  },
  {
    type: 'struct',
    name: 'core::integer::u256',
    members: [ [Object], [Object] ]
  },
  {
    type: 'enum',
    name: 'core::bool',
    variants: [ [Object], [Object] ]
  },
  {
    type: 'interface',
    name: 'openzeppelin::token::erc20::interface::IERC20',
    items: [ [Object], [Object], [Object], [Object], [Object], [Object] ]
  },
  {
    type: 'constructor',
    name: 'constructor',
    inputs: [ [Object], [Object], [Object], [Object] ]
  },
  {
    type: 'event',
    name: 'openzeppelin::token::erc20::erc20::ERC20Component::Transfer',
    kind: 'struct',
    members: [ [Object], [Object], [Object] ]
  },
  {
    type: 'event',
    name: 'openzeppelin::token::erc20::erc20::ERC20Component::Approval',
    kind: 'struct',
    members: [ [Object], [Object], [Object] ]
  },
  {
    type: 'event',
    name: 'openzeppelin::token::erc20::erc20::ERC20Component::Event',
    kind: 'enum',
    variants: [ [Object], [Object] ]
  },
  {
    type: 'event',
    name: 'test::test::ERC20::Event',
    kind: 'enum',
    variants: [ [Object] ]
  }
];
