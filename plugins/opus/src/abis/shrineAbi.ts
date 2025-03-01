export const shrineAbi = [
  {
    type: 'impl',
    name: 'IShrineImpl',
    interface_name: 'opus::interfaces::IShrine::IShrine',
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
    name: 'wadray::wadray_signed::SignedWad',
    members: [
      {
        name: 'val',
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
    name: 'wadray::wadray::Ray',
    members: [
      {
        name: 'val',
        type: 'core::integer::u128',
      },
    ],
  },
  {
    type: 'enum',
    name: 'opus::types::YangSuspensionStatus',
    variants: [
      {
        name: 'None',
        type: '()',
      },
      {
        name: 'Temporary',
        type: '()',
      },
      {
        name: 'Permanent',
        type: '()',
      },
    ],
  },
  {
    type: 'struct',
    name: 'opus::types::YangRedistribution',
    members: [
      {
        name: 'unit_debt',
        type: 'wadray::wadray::Wad',
      },
      {
        name: 'error',
        type: 'wadray::wadray::Wad',
      },
      {
        name: 'exception',
        type: 'core::bool',
      },
    ],
  },
  {
    type: 'struct',
    name: 'opus::types::ExceptionalYangRedistribution',
    members: [
      {
        name: 'unit_debt',
        type: 'wadray::wadray::Wad',
      },
      {
        name: 'unit_yang',
        type: 'wadray::wadray::Wad',
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
    name: 'core::array::Span::<wadray::wadray::Ray>',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<wadray::wadray::Ray>',
      },
    ],
  },
  {
    type: 'struct',
    name: 'opus::types::Health',
    members: [
      {
        name: 'threshold',
        type: 'wadray::wadray::Ray',
      },
      {
        name: 'ltv',
        type: 'wadray::wadray::Ray',
      },
      {
        name: 'value',
        type: 'wadray::wadray::Wad',
      },
      {
        name: 'debt',
        type: 'wadray::wadray::Wad',
      },
    ],
  },
  {
    type: 'struct',
    name: 'opus::types::YangBalance',
    members: [
      {
        name: 'yang_id',
        type: 'core::integer::u32',
      },
      {
        name: 'amount',
        type: 'wadray::wadray::Wad',
      },
    ],
  },
  {
    type: 'struct',
    name: 'core::array::Span::<opus::types::YangBalance>',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<opus::types::YangBalance>',
      },
    ],
  },
  {
    type: 'interface',
    name: 'opus::interfaces::IShrine::IShrine',
    items: [
      {
        type: 'function',
        name: 'get_yin',
        inputs: [
          {
            name: 'user',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'wadray::wadray::Wad',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_total_yin',
        inputs: [],
        outputs: [
          {
            type: 'wadray::wadray::Wad',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_yin_spot_price',
        inputs: [],
        outputs: [
          {
            type: 'wadray::wadray::Wad',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_yang_total',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'wadray::wadray::Wad',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_initial_yang_amt',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'wadray::wadray::Wad',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_yangs_count',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u32',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_deposit',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'trove_id',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'wadray::wadray::Wad',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_budget',
        inputs: [],
        outputs: [
          {
            type: 'wadray::wadray_signed::SignedWad',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_yang_price',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'interval',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: '(wadray::wadray::Wad, wadray::wadray::Wad)',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_yang_rate',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'rate_era',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'wadray::wadray::Ray',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_current_rate_era',
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
        name: 'get_minimum_trove_value',
        inputs: [],
        outputs: [
          {
            type: 'wadray::wadray::Wad',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_debt_ceiling',
        inputs: [],
        outputs: [
          {
            type: 'wadray::wadray::Wad',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_multiplier',
        inputs: [
          {
            name: 'interval',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: '(wadray::wadray::Ray, wadray::wadray::Ray)',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_yang_suspension_status',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'opus::types::YangSuspensionStatus',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_yang_threshold',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: '(wadray::wadray::Ray, wadray::wadray::Ray)',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_redistributions_count',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u32',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_trove_redistribution_id',
        inputs: [
          {
            name: 'trove_id',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u32',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_redistribution_for_yang',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'redistribution_id',
            type: 'core::integer::u32',
          },
        ],
        outputs: [
          {
            type: 'opus::types::YangRedistribution',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_exceptional_redistribution_for_yang_to_yang',
        inputs: [
          {
            name: 'recipient_yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'redistribution_id',
            type: 'core::integer::u32',
          },
          {
            name: 'redistributed_yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'opus::types::ExceptionalYangRedistribution',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'is_recovery_mode',
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
        name: 'get_live',
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
        name: 'add_yang',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'threshold',
            type: 'wadray::wadray::Ray',
          },
          {
            name: 'start_price',
            type: 'wadray::wadray::Wad',
          },
          {
            name: 'initial_rate',
            type: 'wadray::wadray::Ray',
          },
          {
            name: 'initial_yang_amt',
            type: 'wadray::wadray::Wad',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'set_threshold',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'new_threshold',
            type: 'wadray::wadray::Ray',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'suspend_yang',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'unsuspend_yang',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'update_rates',
        inputs: [
          {
            name: 'yangs',
            type: 'core::array::Span::<core::starknet::contract_address::ContractAddress>',
          },
          {
            name: 'new_rates',
            type: 'core::array::Span::<wadray::wadray::Ray>',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'advance',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'price',
            type: 'wadray::wadray::Wad',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'set_multiplier',
        inputs: [
          {
            name: 'multiplier',
            type: 'wadray::wadray::Ray',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'set_minimum_trove_value',
        inputs: [
          {
            name: 'value',
            type: 'wadray::wadray::Wad',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'set_debt_ceiling',
        inputs: [
          {
            name: 'ceiling',
            type: 'wadray::wadray::Wad',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'adjust_budget',
        inputs: [
          {
            name: 'amount',
            type: 'wadray::wadray_signed::SignedWad',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'update_yin_spot_price',
        inputs: [
          {
            name: 'new_price',
            type: 'wadray::wadray::Wad',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'kill',
        inputs: [],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'deposit',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
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
      {
        type: 'function',
        name: 'withdraw',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
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
      {
        type: 'function',
        name: 'forge',
        inputs: [
          {
            name: 'user',
            type: 'core::starknet::contract_address::ContractAddress',
          },
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
            name: 'user',
            type: 'core::starknet::contract_address::ContractAddress',
          },
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
      {
        type: 'function',
        name: 'seize',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
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
      {
        type: 'function',
        name: 'redistribute',
        inputs: [
          {
            name: 'trove_id',
            type: 'core::integer::u64',
          },
          {
            name: 'debt_to_redistribute',
            type: 'wadray::wadray::Wad',
          },
          {
            name: 'pct_value_to_redistribute',
            type: 'wadray::wadray::Ray',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'inject',
        inputs: [
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'amount',
            type: 'wadray::wadray::Wad',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'eject',
        inputs: [
          {
            name: 'burner',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'amount',
            type: 'wadray::wadray::Wad',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'get_shrine_health',
        inputs: [],
        outputs: [
          {
            type: 'opus::types::Health',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_current_yang_price',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: '(wadray::wadray::Wad, wadray::wadray::Wad, core::integer::u64)',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_current_multiplier',
        inputs: [],
        outputs: [
          {
            type: '(wadray::wadray::Ray, wadray::wadray::Ray, core::integer::u64)',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_forge_fee_pct',
        inputs: [],
        outputs: [
          {
            type: 'wadray::wadray::Wad',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'is_healthy',
        inputs: [
          {
            name: 'trove_id',
            type: 'core::integer::u64',
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
        name: 'get_max_forge',
        inputs: [
          {
            name: 'trove_id',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'wadray::wadray::Wad',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_trove_health',
        inputs: [
          {
            name: 'trove_id',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'opus::types::Health',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_redistributions_attributed_to_trove',
        inputs: [
          {
            name: 'trove_id',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: '(core::array::Span::<opus::types::YangBalance>, wadray::wadray::Wad)',
          },
        ],
        state_mutability: 'view',
      },
    ],
  },
  {
    type: 'impl',
    name: 'IERC20Impl',
    interface_name: 'opus::interfaces::IERC20::IERC20',
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
    type: 'interface',
    name: 'opus::interfaces::IERC20::IERC20',
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
    name: 'IERC20CamelImpl',
    interface_name: 'opus::interfaces::IERC20::IERC20CamelOnly',
  },
  {
    type: 'interface',
    name: 'opus::interfaces::IERC20::IERC20CamelOnly',
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
    name: 'ISRC5Impl',
    interface_name: 'opus::interfaces::ISRC5::ISRC5',
  },
  {
    type: 'interface',
    name: 'opus::interfaces::ISRC5::ISRC5',
    items: [
      {
        type: 'function',
        name: 'supports_interface',
        inputs: [
          {
            name: 'interface_id',
            type: 'core::felt252',
          },
        ],
        outputs: [
          {
            type: 'core::bool',
          },
        ],
        state_mutability: 'view',
      },
    ],
  },
  {
    type: 'impl',
    name: 'AccessControlPublic',
    interface_name: 'access_control::access_control::IAccessControl',
  },
  {
    type: 'interface',
    name: 'access_control::access_control::IAccessControl',
    items: [
      {
        type: 'function',
        name: 'get_roles',
        inputs: [
          {
            name: 'account',
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
        name: 'has_role',
        inputs: [
          {
            name: 'role',
            type: 'core::integer::u128',
          },
          {
            name: 'account',
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
        name: 'get_admin',
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
        name: 'get_pending_admin',
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
        name: 'grant_role',
        inputs: [
          {
            name: 'role',
            type: 'core::integer::u128',
          },
          {
            name: 'account',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'revoke_role',
        inputs: [
          {
            name: 'role',
            type: 'core::integer::u128',
          },
          {
            name: 'account',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'renounce_role',
        inputs: [
          {
            name: 'role',
            type: 'core::integer::u128',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'set_pending_admin',
        inputs: [
          {
            name: 'new_admin',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'accept_admin',
        inputs: [],
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
        name: 'admin',
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
    ],
  },
  {
    type: 'event',
    name: 'access_control::access_control::access_control_component::AdminChanged',
    kind: 'struct',
    members: [
      {
        name: 'old_admin',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'new_admin',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'access_control::access_control::access_control_component::NewPendingAdmin',
    kind: 'struct',
    members: [
      {
        name: 'new_admin',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'access_control::access_control::access_control_component::RoleGranted',
    kind: 'struct',
    members: [
      {
        name: 'user',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'role_granted',
        type: 'core::integer::u128',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'access_control::access_control::access_control_component::RoleRevoked',
    kind: 'struct',
    members: [
      {
        name: 'user',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'role_revoked',
        type: 'core::integer::u128',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'access_control::access_control::access_control_component::Event',
    kind: 'enum',
    variants: [
      {
        name: 'AdminChanged',
        type: 'access_control::access_control::access_control_component::AdminChanged',
        kind: 'nested',
      },
      {
        name: 'NewPendingAdmin',
        type: 'access_control::access_control::access_control_component::NewPendingAdmin',
        kind: 'nested',
      },
      {
        name: 'RoleGranted',
        type: 'access_control::access_control::access_control_component::RoleGranted',
        kind: 'nested',
      },
      {
        name: 'RoleRevoked',
        type: 'access_control::access_control::access_control_component::RoleRevoked',
        kind: 'nested',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::shrine::shrine::YangAdded',
    kind: 'struct',
    members: [
      {
        name: 'yang',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'yang_id',
        type: 'core::integer::u32',
        kind: 'data',
      },
      {
        name: 'start_price',
        type: 'wadray::wadray::Wad',
        kind: 'data',
      },
      {
        name: 'initial_rate',
        type: 'wadray::wadray::Ray',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::shrine::shrine::YangTotalUpdated',
    kind: 'struct',
    members: [
      {
        name: 'yang',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'total',
        type: 'wadray::wadray::Wad',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::shrine::shrine::TotalTrovesDebtUpdated',
    kind: 'struct',
    members: [
      {
        name: 'total',
        type: 'wadray::wadray::Wad',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::shrine::shrine::BudgetAdjusted',
    kind: 'struct',
    members: [
      {
        name: 'amount',
        type: 'wadray::wadray_signed::SignedWad',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::shrine::shrine::MultiplierUpdated',
    kind: 'struct',
    members: [
      {
        name: 'multiplier',
        type: 'wadray::wadray::Ray',
        kind: 'data',
      },
      {
        name: 'cumulative_multiplier',
        type: 'wadray::wadray::Ray',
        kind: 'data',
      },
      {
        name: 'interval',
        type: 'core::integer::u64',
        kind: 'key',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::shrine::shrine::YangRatesUpdated',
    kind: 'struct',
    members: [
      {
        name: 'rate_era',
        type: 'core::integer::u64',
        kind: 'key',
      },
      {
        name: 'current_interval',
        type: 'core::integer::u64',
        kind: 'data',
      },
      {
        name: 'yangs',
        type: 'core::array::Span::<core::starknet::contract_address::ContractAddress>',
        kind: 'data',
      },
      {
        name: 'new_rates',
        type: 'core::array::Span::<wadray::wadray::Ray>',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::shrine::shrine::ThresholdUpdated',
    kind: 'struct',
    members: [
      {
        name: 'yang',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'threshold',
        type: 'wadray::wadray::Ray',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::shrine::shrine::ForgeFeePaid',
    kind: 'struct',
    members: [
      {
        name: 'trove_id',
        type: 'core::integer::u64',
        kind: 'key',
      },
      {
        name: 'fee',
        type: 'wadray::wadray::Wad',
        kind: 'data',
      },
      {
        name: 'fee_pct',
        type: 'wadray::wadray::Wad',
        kind: 'data',
      },
    ],
  },
  {
    type: 'struct',
    name: 'opus::types::Trove',
    members: [
      {
        name: 'charge_from',
        type: 'core::integer::u64',
      },
      {
        name: 'last_rate_era',
        type: 'core::integer::u64',
      },
      {
        name: 'debt',
        type: 'wadray::wadray::Wad',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::shrine::shrine::TroveUpdated',
    kind: 'struct',
    members: [
      {
        name: 'trove_id',
        type: 'core::integer::u64',
        kind: 'key',
      },
      {
        name: 'trove',
        type: 'opus::types::Trove',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::shrine::shrine::TroveRedistributed',
    kind: 'struct',
    members: [
      {
        name: 'redistribution_id',
        type: 'core::integer::u32',
        kind: 'key',
      },
      {
        name: 'trove_id',
        type: 'core::integer::u64',
        kind: 'key',
      },
      {
        name: 'debt',
        type: 'wadray::wadray::Wad',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::shrine::shrine::DepositUpdated',
    kind: 'struct',
    members: [
      {
        name: 'yang',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'trove_id',
        type: 'core::integer::u64',
        kind: 'key',
      },
      {
        name: 'amount',
        type: 'wadray::wadray::Wad',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::shrine::shrine::YangPriceUpdated',
    kind: 'struct',
    members: [
      {
        name: 'yang',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'price',
        type: 'wadray::wadray::Wad',
        kind: 'data',
      },
      {
        name: 'cumulative_price',
        type: 'wadray::wadray::Wad',
        kind: 'data',
      },
      {
        name: 'interval',
        type: 'core::integer::u64',
        kind: 'key',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::shrine::shrine::YinPriceUpdated',
    kind: 'struct',
    members: [
      {
        name: 'old_price',
        type: 'wadray::wadray::Wad',
        kind: 'data',
      },
      {
        name: 'new_price',
        type: 'wadray::wadray::Wad',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::shrine::shrine::MinimumTroveValueUpdated',
    kind: 'struct',
    members: [
      {
        name: 'value',
        type: 'wadray::wadray::Wad',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::shrine::shrine::DebtCeilingUpdated',
    kind: 'struct',
    members: [
      {
        name: 'ceiling',
        type: 'wadray::wadray::Wad',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::shrine::shrine::YangSuspended',
    kind: 'struct',
    members: [
      {
        name: 'yang',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'timestamp',
        type: 'core::integer::u64',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::shrine::shrine::YangUnsuspended',
    kind: 'struct',
    members: [
      {
        name: 'yang',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'timestamp',
        type: 'core::integer::u64',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::shrine::shrine::Killed',
    kind: 'struct',
    members: [],
  },
  {
    type: 'event',
    name: 'opus::core::shrine::shrine::Transfer',
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
    name: 'opus::core::shrine::shrine::Approval',
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
    name: 'opus::core::shrine::shrine::Event',
    kind: 'enum',
    variants: [
      {
        name: 'AccessControlEvent',
        type: 'access_control::access_control::access_control_component::Event',
        kind: 'nested',
      },
      {
        name: 'YangAdded',
        type: 'opus::core::shrine::shrine::YangAdded',
        kind: 'nested',
      },
      {
        name: 'YangTotalUpdated',
        type: 'opus::core::shrine::shrine::YangTotalUpdated',
        kind: 'nested',
      },
      {
        name: 'TotalTrovesDebtUpdated',
        type: 'opus::core::shrine::shrine::TotalTrovesDebtUpdated',
        kind: 'nested',
      },
      {
        name: 'BudgetAdjusted',
        type: 'opus::core::shrine::shrine::BudgetAdjusted',
        kind: 'nested',
      },
      {
        name: 'MultiplierUpdated',
        type: 'opus::core::shrine::shrine::MultiplierUpdated',
        kind: 'nested',
      },
      {
        name: 'YangRatesUpdated',
        type: 'opus::core::shrine::shrine::YangRatesUpdated',
        kind: 'nested',
      },
      {
        name: 'ThresholdUpdated',
        type: 'opus::core::shrine::shrine::ThresholdUpdated',
        kind: 'nested',
      },
      {
        name: 'ForgeFeePaid',
        type: 'opus::core::shrine::shrine::ForgeFeePaid',
        kind: 'nested',
      },
      {
        name: 'TroveUpdated',
        type: 'opus::core::shrine::shrine::TroveUpdated',
        kind: 'nested',
      },
      {
        name: 'TroveRedistributed',
        type: 'opus::core::shrine::shrine::TroveRedistributed',
        kind: 'nested',
      },
      {
        name: 'DepositUpdated',
        type: 'opus::core::shrine::shrine::DepositUpdated',
        kind: 'nested',
      },
      {
        name: 'YangPriceUpdated',
        type: 'opus::core::shrine::shrine::YangPriceUpdated',
        kind: 'nested',
      },
      {
        name: 'YinPriceUpdated',
        type: 'opus::core::shrine::shrine::YinPriceUpdated',
        kind: 'nested',
      },
      {
        name: 'MinimumTroveValueUpdated',
        type: 'opus::core::shrine::shrine::MinimumTroveValueUpdated',
        kind: 'nested',
      },
      {
        name: 'DebtCeilingUpdated',
        type: 'opus::core::shrine::shrine::DebtCeilingUpdated',
        kind: 'nested',
      },
      {
        name: 'YangSuspended',
        type: 'opus::core::shrine::shrine::YangSuspended',
        kind: 'nested',
      },
      {
        name: 'YangUnsuspended',
        type: 'opus::core::shrine::shrine::YangUnsuspended',
        kind: 'nested',
      },
      {
        name: 'Killed',
        type: 'opus::core::shrine::shrine::Killed',
        kind: 'nested',
      },
      {
        name: 'Transfer',
        type: 'opus::core::shrine::shrine::Transfer',
        kind: 'nested',
      },
      {
        name: 'Approval',
        type: 'opus::core::shrine::shrine::Approval',
        kind: 'nested',
      },
    ],
  },
] as const;
