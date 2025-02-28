export const abbotAbi = [
  {
    type: 'impl',
    name: 'IAbbotImpl',
    interface_name: 'opus::interfaces::IAbbot::IAbbot',
  },
  {
    type: 'enum',
    name: 'core::option::Option::<core::starknet::contract_address::ContractAddress>',
    variants: [
      {
        name: 'Some',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'None',
        type: '()',
      },
    ],
  },
  {
    type: 'struct',
    name: 'core::array::Span::<core::integer::u64>',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<core::integer::u64>',
      },
    ],
  },
  {
    type: 'struct',
    name: 'opus::types::AssetBalance',
    members: [
      {
        name: 'address',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'amount',
        type: 'core::integer::u128',
      },
    ],
  },
  {
    type: 'struct',
    name: 'core::array::Span::<opus::types::AssetBalance>',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<opus::types::AssetBalance>',
      },
    ],
  },
  {
    type: 'struct',
    name: 'wadray::wadray::Wad',
    members: [
      {
        name: 'val',
        type: 'core::integer::u128',
      },
    ],
  },
  {
    type: 'interface',
    name: 'opus::interfaces::IAbbot::IAbbot',
    items: [
      {
        type: 'function',
        name: 'get_trove_owner',
        inputs: [
          {
            name: 'trove_id',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::option::Option::<core::starknet::contract_address::ContractAddress>',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_user_trove_ids',
        inputs: [
          {
            name: 'user',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'core::array::Span::<core::integer::u64>',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_troves_count',
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
        name: 'get_trove_asset_balance',
        inputs: [
          {
            name: 'trove_id',
            type: 'core::integer::u64',
          },
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u128',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'open_trove',
        inputs: [
          {
            name: 'yang_assets',
            type: 'core::array::Span::<opus::types::AssetBalance>',
          },
          {
            name: 'forge_amount',
            type: 'wadray::wadray::Wad',
          },
          {
            name: 'max_forge_fee_pct',
            type: 'wadray::wadray::Wad',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u64',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'close_trove',
        inputs: [
          {
            name: 'trove_id',
            type: 'core::integer::u64',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'deposit',
        inputs: [
          {
            name: 'trove_id',
            type: 'core::integer::u64',
          },
          {
            name: 'yang_asset',
            type: 'opus::types::AssetBalance',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'withdraw',
        inputs: [
          {
            name: 'trove_id',
            type: 'core::integer::u64',
          },
          {
            name: 'yang_asset',
            type: 'opus::types::AssetBalance',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'forge',
        inputs: [
          {
            name: 'trove_id',
            type: 'core::integer::u64',
          },
          {
            name: 'amount',
            type: 'wadray::wadray::Wad',
          },
          {
            name: 'max_forge_fee_pct',
            type: 'wadray::wadray::Wad',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'melt',
        inputs: [
          {
            name: 'trove_id',
            type: 'core::integer::u64',
          },
          {
            name: 'amount',
            type: 'wadray::wadray::Wad',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
    ],
  },
  {
    type: 'constructor',
    name: 'constructor',
    inputs: [
      {
        name: 'shrine',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'sentinel',
        type: 'core::starknet::contract_address::ContractAddress',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::utils::reentrancy_guard::reentrancy_guard_component::Event',
    kind: 'enum',
    variants: [],
  },
  {
    type: 'event',
    name: 'opus::core::abbot::abbot::Deposit',
    kind: 'struct',
    members: [
      {
        name: 'user',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'trove_id',
        type: 'core::integer::u64',
        kind: 'key',
      },
      {
        name: 'yang',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'yang_amt',
        type: 'wadray::wadray::Wad',
        kind: 'data',
      },
      {
        name: 'asset_amt',
        type: 'core::integer::u128',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::abbot::abbot::Withdraw',
    kind: 'struct',
    members: [
      {
        name: 'user',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'trove_id',
        type: 'core::integer::u64',
        kind: 'key',
      },
      {
        name: 'yang',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'yang_amt',
        type: 'wadray::wadray::Wad',
        kind: 'data',
      },
      {
        name: 'asset_amt',
        type: 'core::integer::u128',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::abbot::abbot::TroveOpened',
    kind: 'struct',
    members: [
      {
        name: 'user',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'trove_id',
        type: 'core::integer::u64',
        kind: 'key',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::abbot::abbot::TroveClosed',
    kind: 'struct',
    members: [
      {
        name: 'trove_id',
        type: 'core::integer::u64',
        kind: 'key',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::abbot::abbot::Event',
    kind: 'enum',
    variants: [
      {
        name: 'ReentrancyGuardEvent',
        type: 'opus::utils::reentrancy_guard::reentrancy_guard_component::Event',
        kind: 'nested',
      },
      {
        name: 'Deposit',
        type: 'opus::core::abbot::abbot::Deposit',
        kind: 'nested',
      },
      {
        name: 'Withdraw',
        type: 'opus::core::abbot::abbot::Withdraw',
        kind: 'nested',
      },
      {
        name: 'TroveOpened',
        type: 'opus::core::abbot::abbot::TroveOpened',
        kind: 'nested',
      },
      {
        name: 'TroveClosed',
        type: 'opus::core::abbot::abbot::TroveClosed',
        kind: 'nested',
      },
    ],
  },
] as const;
