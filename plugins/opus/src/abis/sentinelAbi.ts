export const sentinelAbi = [
  {
    type: 'impl',
    name: 'ISentinelImpl',
    interface_name: 'opus::interfaces::ISentinel::ISentinel',
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
    name: 'wadray::wadray::Wad',
    members: [
      {
        name: 'val',
        type: 'core::integer::u128',
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
    type: 'interface',
    name: 'opus::interfaces::ISentinel::ISentinel',
    items: [
      {
        type: 'function',
        name: 'get_gate_address',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
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
        name: 'get_gate_live',
        inputs: [
          {
            name: 'yang',
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
        name: 'get_yang_addresses',
        inputs: [],
        outputs: [
          {
            type: 'core::array::Span::<core::starknet::contract_address::ContractAddress>',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_yang_addresses_count',
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
        name: 'get_yang',
        inputs: [
          {
            name: 'idx',
            type: 'core::integer::u32',
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
        name: 'get_yang_asset_max',
        inputs: [
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
        name: 'get_asset_amt_per_yang',
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
        name: 'add_yang',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'yang_asset_max',
            type: 'core::integer::u128',
          },
          {
            name: 'yang_threshold',
            type: 'wadray::wadray::Ray',
          },
          {
            name: 'yang_price',
            type: 'wadray::wadray::Wad',
          },
          {
            name: 'yang_rate',
            type: 'wadray::wadray::Ray',
          },
          {
            name: 'gate',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'set_yang_asset_max',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'new_asset_max',
            type: 'core::integer::u128',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'enter',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'user',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'asset_amt',
            type: 'core::integer::u128',
          },
        ],
        outputs: [
          {
            type: 'wadray::wadray::Wad',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'exit',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'user',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'yang_amt',
            type: 'wadray::wadray::Wad',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u128',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'kill_gate',
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
        name: 'convert_to_yang',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'asset_amt',
            type: 'core::integer::u128',
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
        name: 'convert_to_assets',
        inputs: [
          {
            name: 'yang',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'yang_amt',
            type: 'wadray::wadray::Wad',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u128',
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
        name: 'shrine',
        type: 'core::starknet::contract_address::ContractAddress',
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
    name: 'opus::core::sentinel::sentinel::YangAdded',
    kind: 'struct',
    members: [
      {
        name: 'yang',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'gate',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::sentinel::sentinel::YangAssetMaxUpdated',
    kind: 'struct',
    members: [
      {
        name: 'yang',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'old_max',
        type: 'core::integer::u128',
        kind: 'data',
      },
      {
        name: 'new_max',
        type: 'core::integer::u128',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::sentinel::sentinel::GateKilled',
    kind: 'struct',
    members: [
      {
        name: 'yang',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'gate',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'opus::core::sentinel::sentinel::Event',
    kind: 'enum',
    variants: [
      {
        name: 'AccessControlEvent',
        type: 'access_control::access_control::access_control_component::Event',
        kind: 'nested',
      },
      {
        name: 'YangAdded',
        type: 'opus::core::sentinel::sentinel::YangAdded',
        kind: 'nested',
      },
      {
        name: 'YangAssetMaxUpdated',
        type: 'opus::core::sentinel::sentinel::YangAssetMaxUpdated',
        kind: 'nested',
      },
      {
        name: 'GateKilled',
        type: 'opus::core::sentinel::sentinel::GateKilled',
        kind: 'nested',
      },
    ],
  },
] as const;
