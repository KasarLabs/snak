export const ERC20_ABI = [
  {
    type: 'impl',
    name: 'UnruggableEntrypoints',
    interface_name: 'unruggable::token::interface::IUnruggableAdditional',
  },
  {
    type: 'enum',
    name: 'core::bool',
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
    type: 'struct',
    name: 'ekubo::types::i129::i129',
    members: [
      {
        name: 'mag',
        type: 'core::integer::u128',
      },
      {
        name: 'sign',
        type: 'core::bool',
      },
    ],
  },
  {
    type: 'struct',
    name: 'unruggable::exchanges::ekubo::ekubo_adapter::EkuboPoolParameters',
    members: [
      {
        name: 'fee',
        type: 'core::integer::u128',
      },
      {
        name: 'tick_spacing',
        type: 'core::integer::u128',
      },
      {
        name: 'starting_price',
        type: 'ekubo::types::i129::i129',
      },
      {
        name: 'bound',
        type: 'core::integer::u128',
      },
    ],
  },
  {
    type: 'struct',
    name: 'unruggable::token::memecoin::EkuboLiquidityParameters',
    members: [
      {
        name: 'ekubo_pool_parameters',
        type: 'unruggable::exchanges::ekubo::ekubo_adapter::EkuboPoolParameters',
      },
      {
        name: 'quote_address',
        type: 'core::starknet::contract_address::ContractAddress',
      },
    ],
  },
  {
    type: 'struct',
    name: 'core::integer::u256',
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
    type: 'struct',
    name: 'unruggable::token::memecoin::JediswapLiquidityParameters',
    members: [
      {
        name: 'quote_address',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'quote_amount',
        type: 'core::integer::u256',
      },
    ],
  },
  {
    type: 'struct',
    name: 'unruggable::token::memecoin::StarkDeFiLiquidityParameters',
    members: [
      {
        name: 'quote_address',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'quote_amount',
        type: 'core::integer::u256',
      },
    ],
  },
  {
    type: 'enum',
    name: 'unruggable::token::memecoin::LiquidityParameters',
    variants: [
      {
        name: 'Ekubo',
        type: 'unruggable::token::memecoin::EkuboLiquidityParameters',
      },
      {
        name: 'Jediswap',
        type: '(unruggable::token::memecoin::JediswapLiquidityParameters, core::starknet::contract_address::ContractAddress)',
      },
      {
        name: 'StarkDeFi',
        type: '(unruggable::token::memecoin::StarkDeFiLiquidityParameters, core::starknet::contract_address::ContractAddress)',
      },
    ],
  },
  {
    type: 'enum',
    name: 'core::option::Option::<unruggable::token::memecoin::LiquidityParameters>',
    variants: [
      {
        name: 'Some',
        type: 'unruggable::token::memecoin::LiquidityParameters',
      },
      {
        name: 'None',
        type: '()',
      },
    ],
  },
  {
    type: 'enum',
    name: 'unruggable::token::memecoin::LiquidityType',
    variants: [
      {
        name: 'JediERC20',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'StarkDeFiERC20',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'EkuboNFT',
        type: 'core::integer::u64',
      },
    ],
  },
  {
    type: 'enum',
    name: 'core::option::Option::<unruggable::token::memecoin::LiquidityType>',
    variants: [
      {
        name: 'Some',
        type: 'unruggable::token::memecoin::LiquidityType',
      },
      {
        name: 'None',
        type: '()',
      },
    ],
  },
  {
    type: 'interface',
    name: 'unruggable::token::interface::IUnruggableAdditional',
    items: [
      {
        type: 'function',
        name: 'is_launched',
        inputs: [],
        outputs: [
          {
            type: 'core::bool',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'launched_at_block_number',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u64',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'launched_with_liquidity_parameters',
        inputs: [],
        outputs: [
          {
            type: 'core::option::Option::<unruggable::token::memecoin::LiquidityParameters>',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'liquidity_type',
        inputs: [],
        outputs: [
          {
            type: 'core::option::Option::<unruggable::token::memecoin::LiquidityType>',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_team_allocation',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'memecoin_factory_address',
        inputs: [],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'set_launched',
        inputs: [
          {
            name: 'liquidity_type',
            type: 'unruggable::token::memecoin::LiquidityType',
          },
          {
            name: 'liquidity_params',
            type: 'unruggable::token::memecoin::LiquidityParameters',
          },
          {
            name: 'transfer_restriction_delay',
            type: 'core::integer::u64',
          },
          {
            name: 'max_percentage_buy_launch',
            type: 'core::integer::u16',
          },
          {
            name: 'team_allocation',
            type: 'core::integer::u256',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
    ],
  },
  {
    type: 'impl',
    name: 'SnakeEntrypoints',
    interface_name: 'unruggable::token::interface::IUnruggableMemecoinSnake',
  },
  {
    type: 'interface',
    name: 'unruggable::token::interface::IUnruggableMemecoinSnake',
    items: [
      {
        type: 'function',
        name: 'total_supply',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u256',
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
      {
        type: 'function',
        name: 'transfer_from',
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
    ],
  },
  {
    type: 'impl',
    name: 'CamelEntrypoints',
    interface_name: 'unruggable::token::interface::IUnruggableMemecoinCamel',
  },
  {
    type: 'interface',
    name: 'unruggable::token::interface::IUnruggableMemecoinCamel',
    items: [
      {
        type: 'function',
        name: 'totalSupply',
        inputs: [],
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
        name: 'transferFrom',
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
    type: 'impl',
    name: 'OwnableImpl',
    interface_name: 'openzeppelin::access::ownable::interface::IOwnable',
  },
  {
    type: 'interface',
    name: 'openzeppelin::access::ownable::interface::IOwnable',
    items: [
      {
        type: 'function',
        name: 'owner',
        inputs: [],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'transfer_ownership',
        inputs: [
          {
            name: 'new_owner',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'renounce_ownership',
        inputs: [],
        outputs: [],
        state_mutability: 'external',
      },
    ],
  },
  {
    type: 'impl',
    name: 'ERC20MetadataImpl',
    interface_name: 'openzeppelin::token::erc20::interface::IERC20Metadata',
  },
  {
    type: 'interface',
    name: 'openzeppelin::token::erc20::interface::IERC20Metadata',
    items: [
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
    ],
  },
  {
    type: 'constructor',
    name: 'constructor',
    inputs: [
      {
        name: 'owner',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'name',
        type: 'core::felt252',
      },
      {
        name: 'symbol',
        type: 'core::felt252',
      },
      {
        name: 'initial_supply',
        type: 'core::integer::u256',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin::access::ownable::ownable::OwnableComponent::OwnershipTransferred',
    kind: 'struct',
    members: [
      {
        name: 'previous_owner',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'new_owner',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin::access::ownable::ownable::OwnableComponent::Event',
    kind: 'enum',
    variants: [
      {
        name: 'OwnershipTransferred',
        type: 'openzeppelin::access::ownable::ownable::OwnableComponent::OwnershipTransferred',
        kind: 'nested',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin::token::erc20::erc20::ERC20Component::Transfer',
    kind: 'struct',
    members: [
      {
        name: 'from',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'to',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'value',
        type: 'core::integer::u256',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin::token::erc20::erc20::ERC20Component::Approval',
    kind: 'struct',
    members: [
      {
        name: 'owner',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'spender',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'value',
        type: 'core::integer::u256',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin::token::erc20::erc20::ERC20Component::Event',
    kind: 'enum',
    variants: [
      {
        name: 'Transfer',
        type: 'openzeppelin::token::erc20::erc20::ERC20Component::Transfer',
        kind: 'nested',
      },
      {
        name: 'Approval',
        type: 'openzeppelin::token::erc20::erc20::ERC20Component::Approval',
        kind: 'nested',
      },
    ],
  },
  {
    type: 'event',
    name: 'unruggable::token::memecoin::UnruggableMemecoin::Event',
    kind: 'enum',
    variants: [
      {
        name: 'OwnableEvent',
        type: 'openzeppelin::access::ownable::ownable::OwnableComponent::Event',
        kind: 'flat',
      },
      {
        name: 'ERC20Event',
        type: 'openzeppelin::token::erc20::erc20::ERC20Component::Event',
        kind: 'flat',
      },
    ],
  },
];
