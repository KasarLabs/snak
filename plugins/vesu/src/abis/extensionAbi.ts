export const extensionAbi = [
  {
    name: 'DefaultExtensionImpl',
    type: 'impl',
    interface_name: 'vesu::extension::default_extension::IDefaultExtension',
  },
  {
    name: 'vesu::extension::components::pragma_oracle::OracleConfig',
    type: 'struct',
    members: [
      {
        name: 'pragma_key',
        type: 'core::felt252',
      },
      {
        name: 'timeout',
        type: 'core::integer::u64',
      },
      {
        name: 'number_of_sources',
        type: 'core::integer::u32',
      },
    ],
  },
  {
    name: 'vesu::extension::components::fee_model::FeeConfig',
    type: 'struct',
    members: [
      {
        name: 'fee_recipient',
        type: 'core::starknet::contract_address::ContractAddress',
      },
    ],
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
    name: 'vesu::extension::components::interest_rate_model::InterestRateConfig',
    type: 'struct',
    members: [
      {
        name: 'min_target_utilization',
        type: 'core::integer::u256',
      },
      {
        name: 'max_target_utilization',
        type: 'core::integer::u256',
      },
      {
        name: 'target_utilization',
        type: 'core::integer::u256',
      },
      {
        name: 'min_full_utilization_rate',
        type: 'core::integer::u256',
      },
      {
        name: 'max_full_utilization_rate',
        type: 'core::integer::u256',
      },
      {
        name: 'zero_utilization_rate',
        type: 'core::integer::u256',
      },
      {
        name: 'rate_half_life',
        type: 'core::integer::u256',
      },
      {
        name: 'target_rate_percent',
        type: 'core::integer::u256',
      },
    ],
  },
  {
    name: 'vesu::extension::components::position_hooks::LiquidationConfig',
    type: 'struct',
    members: [
      {
        name: 'liquidation_discount',
        type: 'core::integer::u64',
      },
    ],
  },
  {
    name: 'vesu::extension::components::position_hooks::ShutdownConfig',
    type: 'struct',
    members: [
      {
        name: 'recovery_period',
        type: 'core::integer::u64',
      },
      {
        name: 'subscription_period',
        type: 'core::integer::u64',
      },
    ],
  },
  {
    name: 'vesu::data_model::LTVConfig',
    type: 'struct',
    members: [
      {
        name: 'max_ltv',
        type: 'core::integer::u64',
      },
    ],
  },
  {
    name: 'vesu::extension::components::position_hooks::ShutdownMode',
    type: 'enum',
    variants: [
      {
        name: 'None',
        type: '()',
      },
      {
        name: 'Recovery',
        type: '()',
      },
      {
        name: 'Subscription',
        type: '()',
      },
      {
        name: 'Redemption',
        type: '()',
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
    name: 'vesu::extension::components::position_hooks::ShutdownStatus',
    type: 'struct',
    members: [
      {
        name: 'shutdown_mode',
        type: 'vesu::extension::components::position_hooks::ShutdownMode',
      },
      {
        name: 'violating',
        type: 'core::bool',
      },
      {
        name: 'previous_violation_timestamp',
        type: 'core::integer::u64',
      },
      {
        name: 'count_at_violation_timestamp',
        type: 'core::integer::u128',
      },
    ],
  },
  {
    name: 'vesu::data_model::AssetParams',
    type: 'struct',
    members: [
      {
        name: 'asset',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'floor',
        type: 'core::integer::u256',
      },
      {
        name: 'initial_rate_accumulator',
        type: 'core::integer::u256',
      },
      {
        name: 'initial_full_utilization_rate',
        type: 'core::integer::u256',
      },
      {
        name: 'max_utilization',
        type: 'core::integer::u256',
      },
      {
        name: 'is_legacy',
        type: 'core::bool',
      },
      {
        name: 'fee_rate',
        type: 'core::integer::u256',
      },
    ],
  },
  {
    name: 'core::array::Span::<vesu::data_model::AssetParams>',
    type: 'struct',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<vesu::data_model::AssetParams>',
      },
    ],
  },
  {
    name: 'vesu::extension::default_extension::VTokenParams',
    type: 'struct',
    members: [
      {
        name: 'v_token_name',
        type: 'core::felt252',
      },
      {
        name: 'v_token_symbol',
        type: 'core::felt252',
      },
    ],
  },
  {
    name: 'core::array::Span::<vesu::extension::default_extension::VTokenParams>',
    type: 'struct',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<vesu::extension::default_extension::VTokenParams>',
      },
    ],
  },
  {
    name: 'vesu::data_model::LTVParams',
    type: 'struct',
    members: [
      {
        name: 'collateral_asset_index',
        type: 'core::integer::u32',
      },
      {
        name: 'debt_asset_index',
        type: 'core::integer::u32',
      },
      {
        name: 'max_ltv',
        type: 'core::integer::u64',
      },
    ],
  },
  {
    name: 'core::array::Span::<vesu::data_model::LTVParams>',
    type: 'struct',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<vesu::data_model::LTVParams>',
      },
    ],
  },
  {
    name: 'core::array::Span::<vesu::extension::components::interest_rate_model::InterestRateConfig>',
    type: 'struct',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<vesu::extension::components::interest_rate_model::InterestRateConfig>',
      },
    ],
  },
  {
    name: 'vesu::extension::default_extension::PragmaOracleParams',
    type: 'struct',
    members: [
      {
        name: 'pragma_key',
        type: 'core::felt252',
      },
      {
        name: 'timeout',
        type: 'core::integer::u64',
      },
      {
        name: 'number_of_sources',
        type: 'core::integer::u32',
      },
    ],
  },
  {
    name: 'core::array::Span::<vesu::extension::default_extension::PragmaOracleParams>',
    type: 'struct',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<vesu::extension::default_extension::PragmaOracleParams>',
      },
    ],
  },
  {
    name: 'vesu::extension::default_extension::LiquidationParams',
    type: 'struct',
    members: [
      {
        name: 'collateral_asset_index',
        type: 'core::integer::u32',
      },
      {
        name: 'debt_asset_index',
        type: 'core::integer::u32',
      },
      {
        name: 'liquidation_discount',
        type: 'core::integer::u64',
      },
    ],
  },
  {
    name: 'core::array::Span::<vesu::extension::default_extension::LiquidationParams>',
    type: 'struct',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<vesu::extension::default_extension::LiquidationParams>',
      },
    ],
  },
  {
    name: 'vesu::extension::default_extension::ShutdownParams',
    type: 'struct',
    members: [
      {
        name: 'recovery_period',
        type: 'core::integer::u64',
      },
      {
        name: 'subscription_period',
        type: 'core::integer::u64',
      },
      {
        name: 'ltv_params',
        type: 'core::array::Span::<vesu::data_model::LTVParams>',
      },
    ],
  },
  {
    name: 'vesu::extension::default_extension::FeeParams',
    type: 'struct',
    members: [
      {
        name: 'fee_recipient',
        type: 'core::starknet::contract_address::ContractAddress',
      },
    ],
  },
  {
    name: 'vesu::extension::default_extension::IDefaultExtension',
    type: 'interface',
    items: [
      {
        name: 'pool_owner',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
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
        name: 'pragma_oracle',
        type: 'function',
        inputs: [],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'oracle_config',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'vesu::extension::components::pragma_oracle::OracleConfig',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'fee_config',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
        ],
        outputs: [
          {
            type: 'vesu::extension::components::fee_model::FeeConfig',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'interest_rate_config',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'vesu::extension::components::interest_rate_model::InterestRateConfig',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'liquidation_config',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'collateral_asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'debt_asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'vesu::extension::components::position_hooks::LiquidationConfig',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'shutdown_config',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
        ],
        outputs: [
          {
            type: 'vesu::extension::components::position_hooks::ShutdownConfig',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'shutdown_ltv_config',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'collateral_asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'debt_asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'vesu::data_model::LTVConfig',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'shutdown_status',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'collateral_asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'debt_asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'vesu::extension::components::position_hooks::ShutdownStatus',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'violation_timestamp_for_pair',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'collateral_asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'debt_asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u64',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'violation_timestamp_count',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'violation_timestamp',
            type: 'core::integer::u64',
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
        name: 'oldest_violation_timestamp',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u64',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'next_violation_timestamp',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'violation_timestamp',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u64',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'v_token_for_collateral_asset',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'collateral_asset',
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
        name: 'collateral_asset_for_v_token',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'v_token',
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
        name: 'create_pool',
        type: 'function',
        inputs: [
          {
            name: 'asset_params',
            type: 'core::array::Span::<vesu::data_model::AssetParams>',
          },
          {
            name: 'v_token_params',
            type: 'core::array::Span::<vesu::extension::default_extension::VTokenParams>',
          },
          {
            name: 'ltv_params',
            type: 'core::array::Span::<vesu::data_model::LTVParams>',
          },
          {
            name: 'interest_rate_configs',
            type: 'core::array::Span::<vesu::extension::components::interest_rate_model::InterestRateConfig>',
          },
          {
            name: 'pragma_oracle_params',
            type: 'core::array::Span::<vesu::extension::default_extension::PragmaOracleParams>',
          },
          {
            name: 'liquidation_params',
            type: 'core::array::Span::<vesu::extension::default_extension::LiquidationParams>',
          },
          {
            name: 'shutdown_params',
            type: 'vesu::extension::default_extension::ShutdownParams',
          },
          {
            name: 'fee_params',
            type: 'vesu::extension::default_extension::FeeParams',
          },
          {
            name: 'owner',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'core::felt252',
          },
        ],
        state_mutability: 'external',
      },
      {
        name: 'add_asset',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'asset_params',
            type: 'vesu::data_model::AssetParams',
          },
          {
            name: 'v_token_params',
            type: 'vesu::extension::default_extension::VTokenParams',
          },
          {
            name: 'interest_rate_config',
            type: 'vesu::extension::components::interest_rate_model::InterestRateConfig',
          },
          {
            name: 'pragma_oracle_params',
            type: 'vesu::extension::default_extension::PragmaOracleParams',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        name: 'set_asset_parameter',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'parameter',
            type: 'core::felt252',
          },
          {
            name: 'value',
            type: 'core::integer::u256',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        name: 'set_interest_rate_parameter',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'parameter',
            type: 'core::felt252',
          },
          {
            name: 'value',
            type: 'core::integer::u256',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        name: 'set_oracle_parameter',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'parameter',
            type: 'core::felt252',
          },
          {
            name: 'value',
            type: 'core::integer::u64',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        name: 'set_liquidation_config',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'collateral_asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'debt_asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'liquidation_config',
            type: 'vesu::extension::components::position_hooks::LiquidationConfig',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        name: 'set_ltv_config',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'collateral_asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'debt_asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'ltv_config',
            type: 'vesu::data_model::LTVConfig',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        name: 'set_shutdown_config',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'shutdown_config',
            type: 'vesu::extension::components::position_hooks::ShutdownConfig',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        name: 'set_shutdown_ltv_config',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'collateral_asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'debt_asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'shutdown_ltv_config',
            type: 'vesu::data_model::LTVConfig',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        name: 'set_extension',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'extension',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        name: 'set_pool_owner',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'owner',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        name: 'update_shutdown_status',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'collateral_asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'debt_asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'vesu::extension::components::position_hooks::ShutdownMode',
          },
        ],
        state_mutability: 'external',
      },
      {
        name: 'claim_fees',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'collateral_asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
    ],
  },
  {
    name: 'ExtensionImpl',
    type: 'impl',
    interface_name: 'vesu::extension::interface::IExtension',
  },
  {
    name: 'vesu::data_model::AssetPrice',
    type: 'struct',
    members: [
      {
        name: 'value',
        type: 'core::integer::u256',
      },
      {
        name: 'is_valid',
        type: 'core::bool',
      },
    ],
  },
  {
    name: 'vesu::data_model::AssetConfig',
    type: 'struct',
    members: [
      {
        name: 'total_collateral_shares',
        type: 'core::integer::u256',
      },
      {
        name: 'total_nominal_debt',
        type: 'core::integer::u256',
      },
      {
        name: 'reserve',
        type: 'core::integer::u256',
      },
      {
        name: 'max_utilization',
        type: 'core::integer::u256',
      },
      {
        name: 'floor',
        type: 'core::integer::u256',
      },
      {
        name: 'scale',
        type: 'core::integer::u256',
      },
      {
        name: 'is_legacy',
        type: 'core::bool',
      },
      {
        name: 'last_updated',
        type: 'core::integer::u64',
      },
      {
        name: 'last_rate_accumulator',
        type: 'core::integer::u256',
      },
      {
        name: 'last_full_utilization_rate',
        type: 'core::integer::u256',
      },
      {
        name: 'fee_rate',
        type: 'core::integer::u256',
      },
    ],
  },
  {
    name: 'vesu::data_model::Position',
    type: 'struct',
    members: [
      {
        name: 'collateral_shares',
        type: 'core::integer::u256',
      },
      {
        name: 'nominal_debt',
        type: 'core::integer::u256',
      },
    ],
  },
  {
    name: 'vesu::data_model::Context',
    type: 'struct',
    members: [
      {
        name: 'pool_id',
        type: 'core::felt252',
      },
      {
        name: 'extension',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'collateral_asset',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'debt_asset',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'collateral_asset_config',
        type: 'vesu::data_model::AssetConfig',
      },
      {
        name: 'debt_asset_config',
        type: 'vesu::data_model::AssetConfig',
      },
      {
        name: 'collateral_asset_price',
        type: 'vesu::data_model::AssetPrice',
      },
      {
        name: 'debt_asset_price',
        type: 'vesu::data_model::AssetPrice',
      },
      {
        name: 'collateral_asset_fee_shares',
        type: 'core::integer::u256',
      },
      {
        name: 'debt_asset_fee_shares',
        type: 'core::integer::u256',
      },
      {
        name: 'max_ltv',
        type: 'core::integer::u64',
      },
      {
        name: 'user',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'position',
        type: 'vesu::data_model::Position',
      },
    ],
  },
  {
    name: 'vesu::data_model::AmountType',
    type: 'enum',
    variants: [
      {
        name: 'Delta',
        type: '()',
      },
      {
        name: 'Target',
        type: '()',
      },
    ],
  },
  {
    name: 'vesu::data_model::AmountDenomination',
    type: 'enum',
    variants: [
      {
        name: 'Native',
        type: '()',
      },
      {
        name: 'Assets',
        type: '()',
      },
    ],
  },
  {
    name: 'alexandria_math::i257::i257',
    type: 'struct',
    members: [
      {
        name: 'abs',
        type: 'core::integer::u256',
      },
      {
        name: 'is_negative',
        type: 'core::bool',
      },
    ],
  },
  {
    name: 'vesu::data_model::Amount',
    type: 'struct',
    members: [
      {
        name: 'amount_type',
        type: 'vesu::data_model::AmountType',
      },
      {
        name: 'denomination',
        type: 'vesu::data_model::AmountDenomination',
      },
      {
        name: 'value',
        type: 'alexandria_math::i257::i257',
      },
    ],
  },
  {
    name: 'core::array::Span::<core::felt252>',
    type: 'struct',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<core::felt252>',
      },
    ],
  },
  {
    name: 'vesu::data_model::UnsignedAmount',
    type: 'struct',
    members: [
      {
        name: 'amount_type',
        type: 'vesu::data_model::AmountType',
      },
      {
        name: 'denomination',
        type: 'vesu::data_model::AmountDenomination',
      },
      {
        name: 'value',
        type: 'core::integer::u256',
      },
    ],
  },
  {
    name: 'vesu::extension::interface::IExtension',
    type: 'interface',
    items: [
      {
        name: 'singleton',
        type: 'function',
        inputs: [],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'price',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'vesu::data_model::AssetPrice',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'interest_rate',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'utilization',
            type: 'core::integer::u256',
          },
          {
            name: 'last_updated',
            type: 'core::integer::u64',
          },
          {
            name: 'last_full_utilization_rate',
            type: 'core::integer::u256',
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
        name: 'rate_accumulator',
        type: 'function',
        inputs: [
          {
            name: 'pool_id',
            type: 'core::felt252',
          },
          {
            name: 'asset',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'utilization',
            type: 'core::integer::u256',
          },
          {
            name: 'last_updated',
            type: 'core::integer::u64',
          },
          {
            name: 'last_rate_accumulator',
            type: 'core::integer::u256',
          },
          {
            name: 'last_full_utilization_rate',
            type: 'core::integer::u256',
          },
        ],
        outputs: [
          {
            type: '(core::integer::u256, core::integer::u256)',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'before_modify_position',
        type: 'function',
        inputs: [
          {
            name: 'context',
            type: 'vesu::data_model::Context',
          },
          {
            name: 'collateral',
            type: 'vesu::data_model::Amount',
          },
          {
            name: 'debt',
            type: 'vesu::data_model::Amount',
          },
          {
            name: 'data',
            type: 'core::array::Span::<core::felt252>',
          },
          {
            name: 'caller',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: '(vesu::data_model::Amount, vesu::data_model::Amount)',
          },
        ],
        state_mutability: 'external',
      },
      {
        name: 'after_modify_position',
        type: 'function',
        inputs: [
          {
            name: 'context',
            type: 'vesu::data_model::Context',
          },
          {
            name: 'collateral_delta',
            type: 'alexandria_math::i257::i257',
          },
          {
            name: 'collateral_shares_delta',
            type: 'alexandria_math::i257::i257',
          },
          {
            name: 'debt_delta',
            type: 'alexandria_math::i257::i257',
          },
          {
            name: 'nominal_debt_delta',
            type: 'alexandria_math::i257::i257',
          },
          {
            name: 'data',
            type: 'core::array::Span::<core::felt252>',
          },
          {
            name: 'caller',
            type: 'core::starknet::contract_address::ContractAddress',
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
        name: 'before_transfer_position',
        type: 'function',
        inputs: [
          {
            name: 'from_context',
            type: 'vesu::data_model::Context',
          },
          {
            name: 'to_context',
            type: 'vesu::data_model::Context',
          },
          {
            name: 'collateral',
            type: 'vesu::data_model::UnsignedAmount',
          },
          {
            name: 'debt',
            type: 'vesu::data_model::UnsignedAmount',
          },
          {
            name: 'data',
            type: 'core::array::Span::<core::felt252>',
          },
          {
            name: 'caller',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: '(vesu::data_model::UnsignedAmount, vesu::data_model::UnsignedAmount)',
          },
        ],
        state_mutability: 'external',
      },
      {
        name: 'after_transfer_position',
        type: 'function',
        inputs: [
          {
            name: 'from_context',
            type: 'vesu::data_model::Context',
          },
          {
            name: 'to_context',
            type: 'vesu::data_model::Context',
          },
          {
            name: 'collateral_delta',
            type: 'core::integer::u256',
          },
          {
            name: 'collateral_shares_delta',
            type: 'core::integer::u256',
          },
          {
            name: 'debt_delta',
            type: 'core::integer::u256',
          },
          {
            name: 'nominal_debt_delta',
            type: 'core::integer::u256',
          },
          {
            name: 'data',
            type: 'core::array::Span::<core::felt252>',
          },
          {
            name: 'caller',
            type: 'core::starknet::contract_address::ContractAddress',
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
        name: 'before_liquidate_position',
        type: 'function',
        inputs: [
          {
            name: 'context',
            type: 'vesu::data_model::Context',
          },
          {
            name: 'data',
            type: 'core::array::Span::<core::felt252>',
          },
          {
            name: 'caller',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: '(core::integer::u256, core::integer::u256, core::integer::u256)',
          },
        ],
        state_mutability: 'external',
      },
      {
        name: 'after_liquidate_position',
        type: 'function',
        inputs: [
          {
            name: 'context',
            type: 'vesu::data_model::Context',
          },
          {
            name: 'collateral_delta',
            type: 'alexandria_math::i257::i257',
          },
          {
            name: 'collateral_shares_delta',
            type: 'alexandria_math::i257::i257',
          },
          {
            name: 'debt_delta',
            type: 'alexandria_math::i257::i257',
          },
          {
            name: 'nominal_debt_delta',
            type: 'alexandria_math::i257::i257',
          },
          {
            name: 'bad_debt',
            type: 'core::integer::u256',
          },
          {
            name: 'data',
            type: 'core::array::Span::<core::felt252>',
          },
          {
            name: 'caller',
            type: 'core::starknet::contract_address::ContractAddress',
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
        name: 'singleton',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'oracle_address',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'v_token_class_hash',
        type: 'core::felt252',
      },
    ],
  },
  {
    kind: 'struct',
    name: 'vesu::extension::components::position_hooks::position_hooks_component::SetLiquidationConfig',
    type: 'event',
    members: [
      {
        kind: 'data',
        name: 'pool_id',
        type: 'core::felt252',
      },
      {
        kind: 'data',
        name: 'collateral_asset',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        kind: 'data',
        name: 'debt_asset',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        kind: 'data',
        name: 'liquidation_config',
        type: 'vesu::extension::components::position_hooks::LiquidationConfig',
      },
    ],
  },
  {
    kind: 'struct',
    name: 'vesu::extension::components::position_hooks::position_hooks_component::SetShutdownConfig',
    type: 'event',
    members: [
      {
        kind: 'data',
        name: 'pool_id',
        type: 'core::felt252',
      },
      {
        kind: 'data',
        name: 'shutdown_config',
        type: 'vesu::extension::components::position_hooks::ShutdownConfig',
      },
    ],
  },
  {
    kind: 'struct',
    name: 'vesu::extension::components::position_hooks::position_hooks_component::SetShutdownLTVConfig',
    type: 'event',
    members: [
      {
        kind: 'data',
        name: 'pool_id',
        type: 'core::felt252',
      },
      {
        kind: 'data',
        name: 'collateral_asset',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        kind: 'data',
        name: 'debt_asset',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        kind: 'data',
        name: 'shutdown_ltv_config',
        type: 'vesu::data_model::LTVConfig',
      },
    ],
  },
  {
    kind: 'enum',
    name: 'vesu::extension::components::position_hooks::position_hooks_component::Event',
    type: 'event',
    variants: [
      {
        kind: 'nested',
        name: 'SetLiquidationConfig',
        type: 'vesu::extension::components::position_hooks::position_hooks_component::SetLiquidationConfig',
      },
      {
        kind: 'nested',
        name: 'SetShutdownConfig',
        type: 'vesu::extension::components::position_hooks::position_hooks_component::SetShutdownConfig',
      },
      {
        kind: 'nested',
        name: 'SetShutdownLTVConfig',
        type: 'vesu::extension::components::position_hooks::position_hooks_component::SetShutdownLTVConfig',
      },
    ],
  },
  {
    kind: 'struct',
    name: 'vesu::extension::components::interest_rate_model::interest_rate_model_component::SetInterestRateConfig',
    type: 'event',
    members: [
      {
        kind: 'data',
        name: 'pool_id',
        type: 'core::felt252',
      },
      {
        kind: 'data',
        name: 'asset',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        kind: 'data',
        name: 'interest_rate_config',
        type: 'vesu::extension::components::interest_rate_model::InterestRateConfig',
      },
    ],
  },
  {
    kind: 'enum',
    name: 'vesu::extension::components::interest_rate_model::interest_rate_model_component::Event',
    type: 'event',
    variants: [
      {
        kind: 'nested',
        name: 'SetInterestRateConfig',
        type: 'vesu::extension::components::interest_rate_model::interest_rate_model_component::SetInterestRateConfig',
      },
    ],
  },
  {
    kind: 'struct',
    name: 'vesu::extension::components::pragma_oracle::pragma_oracle_component::SetOracleConfig',
    type: 'event',
    members: [
      {
        kind: 'data',
        name: 'pool_id',
        type: 'core::felt252',
      },
      {
        kind: 'data',
        name: 'asset',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        kind: 'data',
        name: 'oracle_config',
        type: 'vesu::extension::components::pragma_oracle::OracleConfig',
      },
    ],
  },
  {
    kind: 'struct',
    name: 'vesu::extension::components::pragma_oracle::pragma_oracle_component::SetOracleParameter',
    type: 'event',
    members: [
      {
        kind: 'data',
        name: 'pool_id',
        type: 'core::felt252',
      },
      {
        kind: 'data',
        name: 'asset',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        kind: 'data',
        name: 'parameter',
        type: 'core::felt252',
      },
      {
        kind: 'data',
        name: 'value',
        type: 'core::integer::u64',
      },
    ],
  },
  {
    kind: 'enum',
    name: 'vesu::extension::components::pragma_oracle::pragma_oracle_component::Event',
    type: 'event',
    variants: [
      {
        kind: 'nested',
        name: 'SetOracleConfig',
        type: 'vesu::extension::components::pragma_oracle::pragma_oracle_component::SetOracleConfig',
      },
      {
        kind: 'nested',
        name: 'SetOracleParameter',
        type: 'vesu::extension::components::pragma_oracle::pragma_oracle_component::SetOracleParameter',
      },
    ],
  },
  {
    kind: 'enum',
    name: 'vesu::map_list::map_list_component::Event',
    type: 'event',
    variants: [],
  },
  {
    kind: 'struct',
    name: 'vesu::extension::components::fee_model::fee_model_component::SetFeeConfig',
    type: 'event',
    members: [
      {
        kind: 'key',
        name: 'pool_id',
        type: 'core::felt252',
      },
      {
        kind: 'key',
        name: 'fee_config',
        type: 'vesu::extension::components::fee_model::FeeConfig',
      },
    ],
  },
  {
    kind: 'struct',
    name: 'vesu::extension::components::fee_model::fee_model_component::ClaimFees',
    type: 'event',
    members: [
      {
        kind: 'key',
        name: 'pool_id',
        type: 'core::felt252',
      },
      {
        kind: 'data',
        name: 'collateral_asset',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        kind: 'data',
        name: 'debt_asset',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        kind: 'data',
        name: 'recipient',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        kind: 'data',
        name: 'amount',
        type: 'core::integer::u256',
      },
    ],
  },
  {
    kind: 'enum',
    name: 'vesu::extension::components::fee_model::fee_model_component::Event',
    type: 'event',
    variants: [
      {
        kind: 'nested',
        name: 'SetFeeConfig',
        type: 'vesu::extension::components::fee_model::fee_model_component::SetFeeConfig',
      },
      {
        kind: 'nested',
        name: 'ClaimFees',
        type: 'vesu::extension::components::fee_model::fee_model_component::ClaimFees',
      },
    ],
  },
  {
    kind: 'enum',
    name: 'vesu::extension::components::tokenization::tokenization_component::Event',
    type: 'event',
    variants: [],
  },
  {
    kind: 'struct',
    name: 'vesu::extension::default_extension::DefaultExtension::SetAssetParameter',
    type: 'event',
    members: [
      {
        kind: 'key',
        name: 'pool_id',
        type: 'core::felt252',
      },
      {
        kind: 'key',
        name: 'asset',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        kind: 'key',
        name: 'parameter',
        type: 'core::felt252',
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
    name: 'vesu::extension::default_extension::DefaultExtension::SetPoolOwner',
    type: 'event',
    members: [
      {
        kind: 'key',
        name: 'pool_id',
        type: 'core::felt252',
      },
      {
        kind: 'key',
        name: 'owner',
        type: 'core::starknet::contract_address::ContractAddress',
      },
    ],
  },
  {
    kind: 'enum',
    name: 'vesu::extension::default_extension::DefaultExtension::Event',
    type: 'event',
    variants: [
      {
        kind: 'nested',
        name: 'PositionHooksEvents',
        type: 'vesu::extension::components::position_hooks::position_hooks_component::Event',
      },
      {
        kind: 'nested',
        name: 'InterestRateModelEvents',
        type: 'vesu::extension::components::interest_rate_model::interest_rate_model_component::Event',
      },
      {
        kind: 'nested',
        name: 'PragmaOracleEvents',
        type: 'vesu::extension::components::pragma_oracle::pragma_oracle_component::Event',
      },
      {
        kind: 'nested',
        name: 'MapListEvents',
        type: 'vesu::map_list::map_list_component::Event',
      },
      {
        kind: 'nested',
        name: 'FeeModelEvents',
        type: 'vesu::extension::components::fee_model::fee_model_component::Event',
      },
      {
        kind: 'nested',
        name: 'TokenizationEvents',
        type: 'vesu::extension::components::tokenization::tokenization_component::Event',
      },
      {
        kind: 'nested',
        name: 'SetAssetParameter',
        type: 'vesu::extension::default_extension::DefaultExtension::SetAssetParameter',
      },
      {
        kind: 'nested',
        name: 'SetPoolOwner',
        type: 'vesu::extension::default_extension::DefaultExtension::SetPoolOwner',
      },
    ],
  },
] as const;
