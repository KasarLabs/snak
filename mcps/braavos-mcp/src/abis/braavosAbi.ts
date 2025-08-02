export const BRAAVOS_ACCOUNT_ABI = [
  {
    type: 'impl',
    name: 'ExternalGetVersionImpl',
    interface_name: 'braavos_account::account::interface::IGetVersion',
  },
  {
    type: 'interface',
    name: 'braavos_account::account::interface::IGetVersion',
    items: [
      {
        type: 'function',
        name: 'get_version',
        inputs: [],
        outputs: [
          {
            type: 'core::felt252',
          },
        ],
        state_mutability: 'view',
      },
    ],
  },
  {
    type: 'impl',
    name: 'ExternalMethods',
    interface_name: 'braavos_account::account::interface::IBraavosAccount',
  },
  {
    type: 'struct',
    name: 'core::array::Span::<core::felt252>',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<core::felt252>',
      },
    ],
  },
  {
    type: 'struct',
    name: 'core::starknet::account::Call',
    members: [
      {
        name: 'to',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'selector',
        type: 'core::felt252',
      },
      {
        name: 'calldata',
        type: 'core::array::Span::<core::felt252>',
      },
    ],
  },
  {
    type: 'struct',
    name: 'core::array::Span::<core::starknet::account::Call>',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<core::starknet::account::Call>',
      },
    ],
  },
  {
    type: 'struct',
    name: 'braavos_account::signers::signers::StarkPubKey',
    members: [
      {
        name: 'pub_key',
        type: 'core::felt252',
      },
    ],
  },
  {
    type: 'enum',
    name: 'braavos_account::signers::signer_type::SignerType',
    variants: [
      {
        name: 'Empty',
        type: '()',
      },
      {
        name: 'Stark',
        type: '()',
      },
      {
        name: 'Secp256r1',
        type: '()',
      },
      {
        name: 'Webauthn',
        type: '()',
      },
      {
        name: 'MOA',
        type: '()',
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
    name: 'braavos_account::signers::signers::Secp256r1PubKey',
    members: [
      {
        name: 'pub_x',
        type: 'core::integer::u256',
      },
      {
        name: 'pub_y',
        type: 'core::integer::u256',
      },
    ],
  },
  {
    type: 'struct',
    name: 'braavos_account::account::interface::AdditionalDeploymentParams',
    members: [
      {
        name: 'account_implementation',
        type: 'core::starknet::class_hash::ClassHash',
      },
      {
        name: 'signer_type',
        type: 'braavos_account::signers::signer_type::SignerType',
      },
      {
        name: 'secp256r1_signer',
        type: 'braavos_account::signers::signers::Secp256r1PubKey',
      },
      {
        name: 'multisig_threshold',
        type: 'core::integer::u32',
      },
      {
        name: 'withdrawal_limit_low',
        type: 'core::integer::u128',
      },
      {
        name: 'fee_rate',
        type: 'core::integer::u128',
      },
      {
        name: 'stark_fee_rate',
        type: 'core::integer::u128',
      },
      {
        name: 'chain_id',
        type: 'core::felt252',
      },
      {
        name: 'deployment_params_signature',
        type: '(core::felt252, core::felt252)',
      },
    ],
  },
  {
    type: 'enum',
    name: 'braavos_account::account::interface::RequiredSigner',
    variants: [
      {
        name: 'NA',
        type: '()',
      },
      {
        name: 'Stark',
        type: '()',
      },
      {
        name: 'Strong',
        type: '()',
      },
      {
        name: 'Multisig',
        type: '()',
      },
    ],
  },
  {
    type: 'interface',
    name: 'braavos_account::account::interface::IBraavosAccount',
    items: [
      {
        type: 'function',
        name: '__validate__',
        inputs: [
          {
            name: 'calls',
            type: 'core::array::Span::<core::starknet::account::Call>',
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
        type: 'function',
        name: '__execute__',
        inputs: [
          {
            name: 'calls',
            type: 'core::array::Span::<core::starknet::account::Call>',
          },
        ],
        outputs: [
          {
            type: 'core::array::Array::<core::array::Span::<core::felt252>>',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'is_valid_signature',
        inputs: [
          {
            name: 'hash',
            type: 'core::felt252',
          },
          {
            name: 'signature',
            type: 'core::array::Span::<core::felt252>',
          },
        ],
        outputs: [
          {
            type: 'core::felt252',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: '__validate_deploy__',
        inputs: [
          {
            name: 'class_hash',
            type: 'core::felt252',
          },
          {
            name: 'salt',
            type: 'core::felt252',
          },
          {
            name: 'stark_pub_key',
            type: 'braavos_account::signers::signers::StarkPubKey',
          },
        ],
        outputs: [
          {
            type: 'core::felt252',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: '__validate_declare__',
        inputs: [
          {
            name: 'class_hash',
            type: 'core::felt252',
          },
        ],
        outputs: [
          {
            type: 'core::felt252',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'initializer',
        inputs: [
          {
            name: 'stark_pub_key',
            type: 'braavos_account::signers::signers::StarkPubKey',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'initializer_from_factory',
        inputs: [
          {
            name: 'stark_pub_key',
            type: 'braavos_account::signers::signers::StarkPubKey',
          },
          {
            name: 'deployment_params',
            type: 'braavos_account::account::interface::AdditionalDeploymentParams',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'get_required_signer',
        inputs: [
          {
            name: 'calls',
            type: 'core::array::Span::<core::starknet::account::Call>',
          },
          {
            name: 'fee_amount',
            type: 'core::integer::u128',
          },
          {
            name: 'tx_version',
            type: 'core::felt252',
          },
        ],
        outputs: [
          {
            type: 'braavos_account::account::interface::RequiredSigner',
          },
        ],
        state_mutability: 'external',
      },
    ],
  },
  {
    type: 'impl',
    name: 'DwlExternalImpl',
    interface_name: 'braavos_account::dwl::interface::IDwlExternal',
  },
  {
    type: 'interface',
    name: 'braavos_account::dwl::interface::IDwlExternal',
    items: [
      {
        type: 'function',
        name: 'set_withdrawal_limit_low',
        inputs: [
          {
            name: 'withdrawal_limit_low',
            type: 'core::integer::u128',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'set_withdrawal_limit_high',
        inputs: [
          {
            name: 'withdrawal_limit_high',
            type: 'core::integer::u128',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'get_withdrawal_limit_low',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u128',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_withdrawal_limit_high',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u128',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_daily_spend',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u128',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_fee_token_rate',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u128',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_stark_fee_token_rate',
        inputs: [],
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
    name: 'RateConfigImpl',
    interface_name: 'braavos_account::dwl::interface::IRateServiceExternal',
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
    name: 'braavos_account::dwl::interface::TokenConfig',
    members: [
      {
        name: 'is_threshold_currency',
        type: 'core::bool',
      },
      {
        name: 'token_address',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'pool_key',
        type: 'core::felt252',
      },
      {
        name: 'is_threshold_currency_token0',
        type: 'core::bool',
      },
    ],
  },
  {
    type: 'struct',
    name: 'core::array::Span::<braavos_account::dwl::interface::TokenConfig>',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<braavos_account::dwl::interface::TokenConfig>',
      },
    ],
  },
  {
    type: 'struct',
    name: 'braavos_account::dwl::interface::WhitelistCallConfig',
    members: [
      {
        name: 'to',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'selector',
        type: 'core::felt252',
      },
      {
        name: 'whitelist_call_type',
        type: 'core::integer::u8',
      },
    ],
  },
  {
    type: 'struct',
    name: 'core::array::Span::<braavos_account::dwl::interface::WhitelistCallConfig>',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<braavos_account::dwl::interface::WhitelistCallConfig>',
      },
    ],
  },
  {
    type: 'interface',
    name: 'braavos_account::dwl::interface::IRateServiceExternal',
    items: [
      {
        type: 'function',
        name: 'update_rate_config',
        inputs: [
          {
            name: 'white_listed_tokens',
            type: 'core::array::Span::<braavos_account::dwl::interface::TokenConfig>',
          },
          {
            name: 'white_listed_calls_list',
            type: 'core::array::Span::<braavos_account::dwl::interface::WhitelistCallConfig>',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
    ],
  },
  {
    type: 'impl',
    name: 'SignerManagementImpl',
    interface_name: 'braavos_account::signers::interface::ISignerManagement',
  },
  {
    type: 'struct',
    name: 'braavos_account::signers::interface::GetSignersResponse',
    members: [
      {
        name: 'stark',
        type: 'core::array::Array::<core::felt252>',
      },
      {
        name: 'secp256r1',
        type: 'core::array::Array::<core::felt252>',
      },
      {
        name: 'webauthn',
        type: 'core::array::Array::<core::felt252>',
      },
    ],
  },
  {
    type: 'struct',
    name: 'braavos_account::signers::signer_management::SignerManagementComponent::DeferredRemoveSignerRequest',
    members: [
      {
        name: 'expire_at',
        type: 'core::integer::u64',
      },
    ],
  },
  {
    type: 'interface',
    name: 'braavos_account::signers::interface::ISignerManagement',
    items: [
      {
        type: 'function',
        name: 'get_public_key',
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
        name: 'get_signers',
        inputs: [],
        outputs: [
          {
            type: 'braavos_account::signers::interface::GetSignersResponse',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'add_secp256r1_signer',
        inputs: [
          {
            name: 'secp256r1_signer',
            type: 'braavos_account::signers::signers::Secp256r1PubKey',
          },
          {
            name: 'signer_type',
            type: 'braavos_account::signers::signer_type::SignerType',
          },
          {
            name: 'multisig_threshold',
            type: 'core::integer::u32',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'remove_secp256r1_signer',
        inputs: [
          {
            name: 'guid',
            type: 'core::felt252',
          },
          {
            name: 'signer_type',
            type: 'braavos_account::signers::signer_type::SignerType',
          },
          {
            name: 'multisig_threshold',
            type: 'core::integer::u32',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'change_secp256r1_signer',
        inputs: [
          {
            name: 'secp256r1_signer',
            type: 'braavos_account::signers::signers::Secp256r1PubKey',
          },
          {
            name: 'existing_guid',
            type: 'core::felt252',
          },
          {
            name: 'signer_type',
            type: 'braavos_account::signers::signer_type::SignerType',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'deferred_remove_signers',
        inputs: [],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'cancel_deferred_remove_signers',
        inputs: [],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'get_deferred_remove_signers',
        inputs: [],
        outputs: [
          {
            type: 'braavos_account::signers::signer_management::SignerManagementComponent::DeferredRemoveSignerRequest',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'set_execution_time_delay',
        inputs: [
          {
            name: 'time_delay',
            type: 'core::integer::u64',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'get_execution_time_delay',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u64',
          },
        ],
        state_mutability: 'view',
      },
    ],
  },
  {
    type: 'impl',
    name: 'MultisigImpl',
    interface_name: 'braavos_account::signers::interface::IMultisig',
  },
  {
    type: 'interface',
    name: 'braavos_account::signers::interface::IMultisig',
    items: [
      {
        type: 'function',
        name: 'set_multisig_threshold',
        inputs: [
          {
            name: 'multisig_threshold',
            type: 'core::integer::u32',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'get_multisig_threshold',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u32',
          },
        ],
        state_mutability: 'view',
      },
    ],
  },
  {
    type: 'impl',
    name: 'UpgradableImpl',
    interface_name: 'braavos_account::upgradable::interface::IUpgradable',
  },
  {
    type: 'interface',
    name: 'braavos_account::upgradable::interface::IUpgradable',
    items: [
      {
        type: 'function',
        name: 'upgrade',
        inputs: [
          {
            name: 'upgrade_to',
            type: 'core::starknet::class_hash::ClassHash',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
    ],
  },
  {
    type: 'impl',
    name: 'StorageMigrationImpl',
    interface_name: 'braavos_account::upgradable::interface::IStorageMigration',
  },
  {
    type: 'interface',
    name: 'braavos_account::upgradable::interface::IStorageMigration',
    items: [
      {
        type: 'function',
        name: 'migrate_storage',
        inputs: [
          {
            name: 'from_version',
            type: 'core::felt252',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
    ],
  },
  {
    type: 'impl',
    name: 'SRC5Impl',
    interface_name:
      'braavos_account::introspection::interface::ISRC5WithCamelCase',
  },
  {
    type: 'interface',
    name: 'braavos_account::introspection::interface::ISRC5WithCamelCase',
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
      {
        type: 'function',
        name: 'supportsInterface',
        inputs: [
          {
            name: 'interfaceId',
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
    name: 'OutsideExecImpl',
    interface_name:
      'braavos_account::outside_execution::interface::IOutsideExecution_V2',
  },
  {
    type: 'struct',
    name: 'braavos_account::outside_execution::interface::OutsideExecution',
    members: [
      {
        name: 'caller',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'nonce',
        type: 'core::felt252',
      },
      {
        name: 'execute_after',
        type: 'core::integer::u64',
      },
      {
        name: 'execute_before',
        type: 'core::integer::u64',
      },
      {
        name: 'calls',
        type: 'core::array::Span::<core::starknet::account::Call>',
      },
    ],
  },
  {
    type: 'interface',
    name: 'braavos_account::outside_execution::interface::IOutsideExecution_V2',
    items: [
      {
        type: 'function',
        name: 'execute_from_outside_v2',
        inputs: [
          {
            name: 'outside_execution',
            type: 'braavos_account::outside_execution::interface::OutsideExecution',
          },
          {
            name: 'signature',
            type: 'core::array::Span::<core::felt252>',
          },
        ],
        outputs: [
          {
            type: 'core::array::Array::<core::array::Span::<core::felt252>>',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'is_valid_outside_execution_nonce',
        inputs: [
          {
            name: 'nonce',
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
    name: 'SessionManagementExternalImpl',
    interface_name: 'braavos_account::sessions::interface::ISessionManagement',
  },
  {
    type: 'interface',
    name: 'braavos_account::sessions::interface::ISessionManagement',
    items: [
      {
        type: 'function',
        name: 'revoke_session',
        inputs: [
          {
            name: 'session_hash',
            type: 'core::felt252',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'is_session_revoked',
        inputs: [
          {
            name: 'session_hash',
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
      {
        type: 'function',
        name: 'get_spending_limit_amount_spent',
        inputs: [
          {
            name: 'session_hash',
            type: 'core::felt252',
          },
          {
            name: 'token_address',
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
        name: 'is_session_validated',
        inputs: [
          {
            name: 'session_hash',
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
      {
        type: 'function',
        name: 'get_session_gas_spent',
        inputs: [
          {
            name: 'session_hash',
            type: 'core::felt252',
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
    name: 'GasSponsoredSessionExecImpl',
    interface_name:
      'braavos_account::sessions::interface::IGasSponsoredSessionExecute',
  },
  {
    type: 'struct',
    name: 'braavos_account::sessions::interface::TokenAmount',
    members: [
      {
        name: 'token_address',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'amount',
        type: 'core::integer::u256',
      },
    ],
  },
  {
    type: 'struct',
    name: 'core::array::Span::<braavos_account::sessions::interface::TokenAmount>',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<braavos_account::sessions::interface::TokenAmount>',
      },
    ],
  },
  {
    type: 'struct',
    name: 'core::array::Span::<core::integer::u32>',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<core::integer::u32>',
      },
    ],
  },
  {
    type: 'struct',
    name: 'braavos_account::sessions::interface::GasSponsoredSessionExecutionRequest',
    members: [
      {
        name: 'execute_after',
        type: 'core::integer::u64',
      },
      {
        name: 'execute_before',
        type: 'core::integer::u64',
      },
      {
        name: 'allowed_method_guids',
        type: 'core::array::Span::<core::felt252>',
      },
      {
        name: 'spending_limits',
        type: 'core::array::Span::<braavos_account::sessions::interface::TokenAmount>',
      },
      {
        name: 'calls',
        type: 'core::array::Span::<core::starknet::account::Call>',
      },
      {
        name: 'call_hints',
        type: 'core::array::Span::<core::integer::u32>',
      },
    ],
  },
  {
    type: 'interface',
    name: 'braavos_account::sessions::interface::IGasSponsoredSessionExecute',
    items: [
      {
        type: 'function',
        name: 'execute_gas_sponsored_session_tx',
        inputs: [
          {
            name: 'gas_sponsored_session_request',
            type: 'braavos_account::sessions::interface::GasSponsoredSessionExecutionRequest',
          },
          {
            name: 'signature',
            type: 'core::array::Span::<core::felt252>',
          },
        ],
        outputs: [
          {
            type: 'core::array::Array::<core::array::Span::<core::felt252>>',
          },
        ],
        state_mutability: 'external',
      },
    ],
  },
  {
    type: 'impl',
    name: 'SessionExecuteExternalImpl',
    interface_name: 'braavos_account::sessions::interface::ISessionExecute',
  },
  {
    type: 'struct',
    name: 'braavos_account::sessions::interface::SessionExecute',
    members: [
      {
        name: 'owner_pub_key',
        type: 'core::felt252',
      },
      {
        name: 'execute_after',
        type: 'core::integer::u64',
      },
      {
        name: 'execute_before',
        type: 'core::integer::u64',
      },
      {
        name: 'allowed_method_guids',
        type: 'core::array::Span::<core::felt252>',
      },
      {
        name: 'v3_gas_limit',
        type: 'core::integer::u128',
      },
      {
        name: 'spending_limits',
        type: 'core::array::Span::<braavos_account::sessions::interface::TokenAmount>',
      },
    ],
  },
  {
    type: 'struct',
    name: 'braavos_account::sessions::interface::SessionExecuteRequest',
    members: [
      {
        name: 'session_request',
        type: 'braavos_account::sessions::interface::SessionExecute',
      },
      {
        name: 'call_hints',
        type: 'core::array::Span::<core::integer::u32>',
      },
      {
        name: 'session_request_signature',
        type: 'core::array::Span::<core::felt252>',
      },
    ],
  },
  {
    type: 'interface',
    name: 'braavos_account::sessions::interface::ISessionExecute',
    items: [
      {
        type: 'function',
        name: 'session_execute',
        inputs: [
          {
            name: 'session_execute_request',
            type: 'braavos_account::sessions::interface::SessionExecuteRequest',
          },
        ],
        outputs: [],
        state_mutability: 'view',
      },
    ],
  },
  {
    type: 'constructor',
    name: 'constructor',
    inputs: [],
  },
  {
    type: 'event',
    name: 'braavos_account::signers::interface::OwnerAdded',
    kind: 'struct',
    members: [
      {
        name: 'new_owner_guid',
        type: 'core::felt252',
        kind: 'key',
      },
      {
        name: 'signer_type',
        type: 'braavos_account::signers::signer_type::SignerType',
        kind: 'data',
      },
      {
        name: 'signer_data',
        type: 'core::array::Span::<core::felt252>',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'braavos_account::signers::interface::OwnerRemoved',
    kind: 'struct',
    members: [
      {
        name: 'removed_owner_guid',
        type: 'core::felt252',
        kind: 'key',
      },
      {
        name: 'removed_signer_type',
        type: 'braavos_account::signers::signer_type::SignerType',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'braavos_account::signers::signer_management::SignerManagementComponent::DeferredRemoveSignerRequest',
    kind: 'struct',
    members: [
      {
        name: 'expire_at',
        type: 'core::integer::u64',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'braavos_account::signers::signer_management::SignerManagementComponent::DeferredRemoveSignerRequestCancelled',
    kind: 'struct',
    members: [
      {
        name: 'cancelled_deferred_request',
        type: 'braavos_account::signers::signer_management::SignerManagementComponent::DeferredRemoveSignerRequest',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'braavos_account::signers::signer_management::SignerManagementComponent::DeferredRemoveSignerRequestExpired',
    kind: 'struct',
    members: [
      {
        name: 'expired_deferred_request',
        type: 'braavos_account::signers::signer_management::SignerManagementComponent::DeferredRemoveSignerRequest',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'braavos_account::signers::signer_management::SignerManagementComponent::Event',
    kind: 'enum',
    variants: [
      {
        name: 'OwnerAdded',
        type: 'braavos_account::signers::interface::OwnerAdded',
        kind: 'nested',
      },
      {
        name: 'OwnerRemoved',
        type: 'braavos_account::signers::interface::OwnerRemoved',
        kind: 'nested',
      },
      {
        name: 'DeferredRemoveSignerRequest',
        type: 'braavos_account::signers::signer_management::SignerManagementComponent::DeferredRemoveSignerRequest',
        kind: 'nested',
      },
      {
        name: 'DeferredRemoveSignerRequestCancelled',
        type: 'braavos_account::signers::signer_management::SignerManagementComponent::DeferredRemoveSignerRequestCancelled',
        kind: 'nested',
      },
      {
        name: 'DeferredRemoveSignerRequestExpired',
        type: 'braavos_account::signers::signer_management::SignerManagementComponent::DeferredRemoveSignerRequestExpired',
        kind: 'nested',
      },
    ],
  },
  {
    type: 'event',
    name: 'braavos_account::signers::multisig::MultisigComponent::MultisigSet',
    kind: 'struct',
    members: [
      {
        name: 'multisig_threshold',
        type: 'core::integer::u32',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'braavos_account::signers::multisig::MultisigComponent::Event',
    kind: 'enum',
    variants: [
      {
        name: 'MultisigSet',
        type: 'braavos_account::signers::multisig::MultisigComponent::MultisigSet',
        kind: 'nested',
      },
    ],
  },
  {
    type: 'event',
    name: 'braavos_account::upgradable::upgradable::UpgradableComponent::Upgraded',
    kind: 'struct',
    members: [
      {
        name: 'class_hash',
        type: 'core::starknet::class_hash::ClassHash',
        kind: 'key',
      },
    ],
  },
  {
    type: 'event',
    name: 'braavos_account::upgradable::upgradable::UpgradableComponent::Event',
    kind: 'enum',
    variants: [
      {
        name: 'Upgraded',
        type: 'braavos_account::upgradable::upgradable::UpgradableComponent::Upgraded',
        kind: 'nested',
      },
    ],
  },
  {
    type: 'event',
    name: 'braavos_account::introspection::src5::SRC5Component::Event',
    kind: 'enum',
    variants: [],
  },
  {
    type: 'event',
    name: 'braavos_account::dwl::dwl::DwlComponent::WithdrawalLimitLowSet',
    kind: 'struct',
    members: [
      {
        name: 'withdrawal_limit_low',
        type: 'core::integer::u128',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'braavos_account::dwl::dwl::DwlComponent::WithdrawalLimitHighSet',
    kind: 'struct',
    members: [
      {
        name: 'withdrawal_limit_high',
        type: 'core::integer::u128',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'braavos_account::dwl::dwl::DwlComponent::Event',
    kind: 'enum',
    variants: [
      {
        name: 'WithdrawalLimitLowSet',
        type: 'braavos_account::dwl::dwl::DwlComponent::WithdrawalLimitLowSet',
        kind: 'nested',
      },
      {
        name: 'WithdrawalLimitHighSet',
        type: 'braavos_account::dwl::dwl::DwlComponent::WithdrawalLimitHighSet',
        kind: 'nested',
      },
    ],
  },
  {
    type: 'event',
    name: 'braavos_account::dwl::rate_service::RateComponent::Event',
    kind: 'enum',
    variants: [],
  },
  {
    type: 'event',
    name: 'braavos_account::outside_execution::outside_execution::OutsideExecComponent::Event',
    kind: 'enum',
    variants: [],
  },
  {
    type: 'event',
    name: 'braavos_account::sessions::interface::GasSponsoredSessionStarted',
    kind: 'struct',
    members: [
      {
        name: 'session_hash',
        type: 'core::felt252',
        kind: 'key',
      },
      {
        name: 'caller',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'execute_after',
        type: 'core::integer::u64',
        kind: 'data',
      },
      {
        name: 'execute_before',
        type: 'core::integer::u64',
        kind: 'data',
      },
      {
        name: 'tx_hash',
        type: 'core::felt252',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'braavos_account::sessions::interface::SessionStarted',
    kind: 'struct',
    members: [
      {
        name: 'session_hash',
        type: 'core::felt252',
        kind: 'key',
      },
      {
        name: 'owner_pub_key',
        type: 'core::felt252',
        kind: 'data',
      },
      {
        name: 'execute_after',
        type: 'core::integer::u64',
        kind: 'data',
      },
      {
        name: 'execute_before',
        type: 'core::integer::u64',
        kind: 'data',
      },
      {
        name: 'tx_hash',
        type: 'core::felt252',
        kind: 'data',
      },
      {
        name: 'v3_gas_limit',
        type: 'core::integer::u128',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'braavos_account::sessions::interface::SessionRevoked',
    kind: 'struct',
    members: [
      {
        name: 'session_hash',
        type: 'core::felt252',
        kind: 'key',
      },
    ],
  },
  {
    type: 'event',
    name: 'braavos_account::sessions::sessions::SessionComponent::Event',
    kind: 'enum',
    variants: [
      {
        name: 'GasSponsoredSessionStarted',
        type: 'braavos_account::sessions::interface::GasSponsoredSessionStarted',
        kind: 'nested',
      },
      {
        name: 'SessionStarted',
        type: 'braavos_account::sessions::interface::SessionStarted',
        kind: 'nested',
      },
      {
        name: 'SessionRevoked',
        type: 'braavos_account::sessions::interface::SessionRevoked',
        kind: 'nested',
      },
    ],
  },
  {
    type: 'event',
    name: 'braavos_account::presets::braavos_account::BraavosAccount::Event',
    kind: 'enum',
    variants: [
      {
        name: 'SignerMgtEvt',
        type: 'braavos_account::signers::signer_management::SignerManagementComponent::Event',
        kind: 'flat',
      },
      {
        name: 'MultisigEvt',
        type: 'braavos_account::signers::multisig::MultisigComponent::Event',
        kind: 'flat',
      },
      {
        name: 'UpgradableEvt',
        type: 'braavos_account::upgradable::upgradable::UpgradableComponent::Event',
        kind: 'flat',
      },
      {
        name: 'Src5Evt',
        type: 'braavos_account::introspection::src5::SRC5Component::Event',
        kind: 'flat',
      },
      {
        name: 'DwlEvent',
        type: 'braavos_account::dwl::dwl::DwlComponent::Event',
        kind: 'flat',
      },
      {
        name: 'RateEvent',
        type: 'braavos_account::dwl::rate_service::RateComponent::Event',
        kind: 'flat',
      },
      {
        name: 'OutsideExecEvt',
        type: 'braavos_account::outside_execution::outside_execution::OutsideExecComponent::Event',
        kind: 'flat',
      },
      {
        name: 'SessionsEvt',
        type: 'braavos_account::sessions::sessions::SessionComponent::Event',
        kind: 'flat',
      },
    ],
  },
];
