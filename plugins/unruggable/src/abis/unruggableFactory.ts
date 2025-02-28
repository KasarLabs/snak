export const FACTORY_ABI = [
  {
    type: 'impl',
    name: 'FactoryImpl',
    interface_name: 'unruggable::factory::interface::IFactory',
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
    name: 'core::array::Span::<core::starknet::contract_address::ContractAddress>',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<core::starknet::contract_address::ContractAddress>',
      },
    ],
  },
  {
    type: 'struct',
    name: 'core::array::Span::<core::integer::u256>',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<core::integer::u256>',
      },
    ],
  },
  {
    type: 'struct',
    name: 'unruggable::factory::LaunchParameters',
    members: [
      {
        name: 'memecoin_address',
        type: 'core::starknet::contract_address::ContractAddress',
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
        name: 'quote_address',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'initial_holders',
        type: 'core::array::Span::<core::starknet::contract_address::ContractAddress>',
      },
      {
        name: 'initial_holders_amounts',
        type: 'core::array::Span::<core::integer::u256>',
      },
    ],
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
    name: 'ekubo::types::keys::PoolKey',
    members: [
      {
        name: 'token0',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'token1',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'fee',
        type: 'core::integer::u128',
      },
      {
        name: 'tick_spacing',
        type: 'core::integer::u128',
      },
      {
        name: 'extension',
        type: 'core::starknet::contract_address::ContractAddress',
      },
    ],
  },
  {
    type: 'struct',
    name: 'ekubo::types::bounds::Bounds',
    members: [
      {
        name: 'lower',
        type: 'ekubo::types::i129::i129',
      },
      {
        name: 'upper',
        type: 'ekubo::types::i129::i129',
      },
    ],
  },
  {
    type: 'struct',
    name: 'unruggable::exchanges::ekubo::launcher::EkuboLP',
    members: [
      {
        name: 'owner',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'quote_address',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'pool_key',
        type: 'ekubo::types::keys::PoolKey',
      },
      {
        name: 'bounds',
        type: 'ekubo::types::bounds::Bounds',
      },
    ],
  },
  {
    type: 'enum',
    name: 'unruggable::exchanges::SupportedExchanges',
    variants: [
      {
        name: 'Jediswap',
        type: '()',
      },
      {
        name: 'Ekubo',
        type: '()',
      },
      {
        name: 'Starkdefi',
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
    name: 'core::option::Option::<(core::starknet::contract_address::ContractAddress, unruggable::token::memecoin::LiquidityType)>',
    variants: [
      {
        name: 'Some',
        type: '(core::starknet::contract_address::ContractAddress, unruggable::token::memecoin::LiquidityType)',
      },
      {
        name: 'None',
        type: '()',
      },
    ],
  },
  {
    type: 'interface',
    name: 'unruggable::factory::interface::IFactory',
    items: [
      {
        type: 'function',
        name: 'create_memecoin',
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
          {
            name: 'contract_address_salt',
            type: 'core::felt252',
          },
        ],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'launch_on_jediswap',
        inputs: [
          {
            name: 'launch_parameters',
            type: 'unruggable::factory::LaunchParameters',
          },
          {
            name: 'quote_amount',
            type: 'core::integer::u256',
          },
          {
            name: 'unlock_time',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'launch_on_ekubo',
        inputs: [
          {
            name: 'launch_parameters',
            type: 'unruggable::factory::LaunchParameters',
          },
          {
            name: 'ekubo_parameters',
            type: 'unruggable::exchanges::ekubo::ekubo_adapter::EkuboPoolParameters',
          },
        ],
        outputs: [
          {
            type: '(core::integer::u64, unruggable::exchanges::ekubo::launcher::EkuboLP)',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'launch_on_starkdefi',
        inputs: [
          {
            name: 'launch_parameters',
            type: 'unruggable::factory::LaunchParameters',
          },
          {
            name: 'quote_amount',
            type: 'core::integer::u256',
          },
          {
            name: 'unlock_time',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'exchange_address',
        inputs: [
          {
            name: 'exchange',
            type: 'unruggable::exchanges::SupportedExchanges',
          },
        ],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'locked_liquidity',
        inputs: [
          {
            name: 'token',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'core::option::Option::<(core::starknet::contract_address::ContractAddress, unruggable::token::memecoin::LiquidityType)>',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'is_memecoin',
        inputs: [
          {
            name: 'address',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'core::bool',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'ekubo_core_address',
        inputs: [],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'view',
      },
    ],
  },
  {
    type: 'struct',
    name: 'core::array::Span::<(unruggable::exchanges::SupportedExchanges, core::starknet::contract_address::ContractAddress)>',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<(unruggable::exchanges::SupportedExchanges, core::starknet::contract_address::ContractAddress)>',
      },
    ],
  },
  {
    type: 'struct',
    name: 'core::array::Span::<(core::starknet::contract_address::ContractAddress, core::starknet::contract_address::ContractAddress)>',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<(core::starknet::contract_address::ContractAddress, core::starknet::contract_address::ContractAddress)>',
      },
    ],
  },
  {
    type: 'constructor',
    name: 'constructor',
    inputs: [
      {
        name: 'memecoin_class_hash',
        type: 'core::starknet::class_hash::ClassHash',
      },
      {
        name: 'lock_manager_address',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'exchanges',
        type: 'core::array::Span::<(unruggable::exchanges::SupportedExchanges, core::starknet::contract_address::ContractAddress)>',
      },
      {
        name: 'migrated_tokens',
        type: 'core::array::Span::<(core::starknet::contract_address::ContractAddress, core::starknet::contract_address::ContractAddress)>',
      },
    ],
  },
  {
    type: 'event',
    name: 'unruggable::factory::factory::Factory::MemecoinCreated',
    kind: 'struct',
    members: [
      {
        name: 'owner',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'name',
        type: 'core::felt252',
        kind: 'data',
      },
      {
        name: 'symbol',
        type: 'core::felt252',
        kind: 'data',
      },
      {
        name: 'initial_supply',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'memecoin_address',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'unruggable::factory::factory::Factory::MemecoinLaunched',
    kind: 'struct',
    members: [
      {
        name: 'memecoin_address',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'quote_token',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'exchange_name',
        type: 'core::felt252',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'unruggable::factory::factory::Factory::Event',
    kind: 'enum',
    variants: [
      {
        name: 'MemecoinCreated',
        type: 'unruggable::factory::factory::Factory::MemecoinCreated',
        kind: 'nested',
      },
      {
        name: 'MemecoinLaunched',
        type: 'unruggable::factory::factory::Factory::MemecoinLaunched',
        kind: 'nested',
      },
    ],
  },
];
