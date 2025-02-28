export declare const extensionAbi: readonly [{
    readonly name: "DefaultExtensionImpl";
    readonly type: "impl";
    readonly interface_name: "vesu::extension::default_extension::IDefaultExtension";
}, {
    readonly name: "vesu::extension::components::pragma_oracle::OracleConfig";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "pragma_key";
        readonly type: "core::felt252";
    }, {
        readonly name: "timeout";
        readonly type: "core::integer::u64";
    }, {
        readonly name: "number_of_sources";
        readonly type: "core::integer::u32";
    }];
}, {
    readonly name: "vesu::extension::components::fee_model::FeeConfig";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "fee_recipient";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }];
}, {
    readonly name: "core::integer::u256";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "low";
        readonly type: "core::integer::u128";
    }, {
        readonly name: "high";
        readonly type: "core::integer::u128";
    }];
}, {
    readonly name: "vesu::extension::components::interest_rate_model::InterestRateConfig";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "min_target_utilization";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "max_target_utilization";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "target_utilization";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "min_full_utilization_rate";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "max_full_utilization_rate";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "zero_utilization_rate";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "rate_half_life";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "target_rate_percent";
        readonly type: "core::integer::u256";
    }];
}, {
    readonly name: "vesu::extension::components::position_hooks::LiquidationConfig";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "liquidation_discount";
        readonly type: "core::integer::u64";
    }];
}, {
    readonly name: "vesu::extension::components::position_hooks::ShutdownConfig";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "recovery_period";
        readonly type: "core::integer::u64";
    }, {
        readonly name: "subscription_period";
        readonly type: "core::integer::u64";
    }];
}, {
    readonly name: "vesu::data_model::LTVConfig";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "max_ltv";
        readonly type: "core::integer::u64";
    }];
}, {
    readonly name: "vesu::extension::components::position_hooks::ShutdownMode";
    readonly type: "enum";
    readonly variants: readonly [{
        readonly name: "None";
        readonly type: "()";
    }, {
        readonly name: "Recovery";
        readonly type: "()";
    }, {
        readonly name: "Subscription";
        readonly type: "()";
    }, {
        readonly name: "Redemption";
        readonly type: "()";
    }];
}, {
    readonly name: "core::bool";
    readonly type: "enum";
    readonly variants: readonly [{
        readonly name: "False";
        readonly type: "()";
    }, {
        readonly name: "True";
        readonly type: "()";
    }];
}, {
    readonly name: "vesu::extension::components::position_hooks::ShutdownStatus";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "shutdown_mode";
        readonly type: "vesu::extension::components::position_hooks::ShutdownMode";
    }, {
        readonly name: "violating";
        readonly type: "core::bool";
    }, {
        readonly name: "previous_violation_timestamp";
        readonly type: "core::integer::u64";
    }, {
        readonly name: "count_at_violation_timestamp";
        readonly type: "core::integer::u128";
    }];
}, {
    readonly name: "vesu::data_model::AssetParams";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "floor";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "initial_rate_accumulator";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "initial_full_utilization_rate";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "max_utilization";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "is_legacy";
        readonly type: "core::bool";
    }, {
        readonly name: "fee_rate";
        readonly type: "core::integer::u256";
    }];
}, {
    readonly name: "core::array::Span::<vesu::data_model::AssetParams>";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "snapshot";
        readonly type: "@core::array::Array::<vesu::data_model::AssetParams>";
    }];
}, {
    readonly name: "vesu::extension::default_extension::VTokenParams";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "v_token_name";
        readonly type: "core::felt252";
    }, {
        readonly name: "v_token_symbol";
        readonly type: "core::felt252";
    }];
}, {
    readonly name: "core::array::Span::<vesu::extension::default_extension::VTokenParams>";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "snapshot";
        readonly type: "@core::array::Array::<vesu::extension::default_extension::VTokenParams>";
    }];
}, {
    readonly name: "vesu::data_model::LTVParams";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "collateral_asset_index";
        readonly type: "core::integer::u32";
    }, {
        readonly name: "debt_asset_index";
        readonly type: "core::integer::u32";
    }, {
        readonly name: "max_ltv";
        readonly type: "core::integer::u64";
    }];
}, {
    readonly name: "core::array::Span::<vesu::data_model::LTVParams>";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "snapshot";
        readonly type: "@core::array::Array::<vesu::data_model::LTVParams>";
    }];
}, {
    readonly name: "core::array::Span::<vesu::extension::components::interest_rate_model::InterestRateConfig>";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "snapshot";
        readonly type: "@core::array::Array::<vesu::extension::components::interest_rate_model::InterestRateConfig>";
    }];
}, {
    readonly name: "vesu::extension::default_extension::PragmaOracleParams";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "pragma_key";
        readonly type: "core::felt252";
    }, {
        readonly name: "timeout";
        readonly type: "core::integer::u64";
    }, {
        readonly name: "number_of_sources";
        readonly type: "core::integer::u32";
    }];
}, {
    readonly name: "core::array::Span::<vesu::extension::default_extension::PragmaOracleParams>";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "snapshot";
        readonly type: "@core::array::Array::<vesu::extension::default_extension::PragmaOracleParams>";
    }];
}, {
    readonly name: "vesu::extension::default_extension::LiquidationParams";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "collateral_asset_index";
        readonly type: "core::integer::u32";
    }, {
        readonly name: "debt_asset_index";
        readonly type: "core::integer::u32";
    }, {
        readonly name: "liquidation_discount";
        readonly type: "core::integer::u64";
    }];
}, {
    readonly name: "core::array::Span::<vesu::extension::default_extension::LiquidationParams>";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "snapshot";
        readonly type: "@core::array::Array::<vesu::extension::default_extension::LiquidationParams>";
    }];
}, {
    readonly name: "vesu::extension::default_extension::ShutdownParams";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "recovery_period";
        readonly type: "core::integer::u64";
    }, {
        readonly name: "subscription_period";
        readonly type: "core::integer::u64";
    }, {
        readonly name: "ltv_params";
        readonly type: "core::array::Span::<vesu::data_model::LTVParams>";
    }];
}, {
    readonly name: "vesu::extension::default_extension::FeeParams";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "fee_recipient";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }];
}, {
    readonly name: "vesu::extension::default_extension::IDefaultExtension";
    readonly type: "interface";
    readonly items: readonly [{
        readonly name: "pool_owner";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }];
        readonly outputs: readonly [{
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "pragma_oracle";
        readonly type: "function";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "oracle_config";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "vesu::extension::components::pragma_oracle::OracleConfig";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "fee_config";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }];
        readonly outputs: readonly [{
            readonly type: "vesu::extension::components::fee_model::FeeConfig";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "interest_rate_config";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "vesu::extension::components::interest_rate_model::InterestRateConfig";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "liquidation_config";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "collateral_asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "debt_asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "vesu::extension::components::position_hooks::LiquidationConfig";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "shutdown_config";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }];
        readonly outputs: readonly [{
            readonly type: "vesu::extension::components::position_hooks::ShutdownConfig";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "shutdown_ltv_config";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "collateral_asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "debt_asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "vesu::data_model::LTVConfig";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "shutdown_status";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "collateral_asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "debt_asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "vesu::extension::components::position_hooks::ShutdownStatus";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "violation_timestamp_for_pair";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "collateral_asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "debt_asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u64";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "violation_timestamp_count";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "violation_timestamp";
            readonly type: "core::integer::u64";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u128";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "oldest_violation_timestamp";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u64";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "next_violation_timestamp";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "violation_timestamp";
            readonly type: "core::integer::u64";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u64";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "v_token_for_collateral_asset";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "collateral_asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "collateral_asset_for_v_token";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "v_token";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "create_pool";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "asset_params";
            readonly type: "core::array::Span::<vesu::data_model::AssetParams>";
        }, {
            readonly name: "v_token_params";
            readonly type: "core::array::Span::<vesu::extension::default_extension::VTokenParams>";
        }, {
            readonly name: "ltv_params";
            readonly type: "core::array::Span::<vesu::data_model::LTVParams>";
        }, {
            readonly name: "interest_rate_configs";
            readonly type: "core::array::Span::<vesu::extension::components::interest_rate_model::InterestRateConfig>";
        }, {
            readonly name: "pragma_oracle_params";
            readonly type: "core::array::Span::<vesu::extension::default_extension::PragmaOracleParams>";
        }, {
            readonly name: "liquidation_params";
            readonly type: "core::array::Span::<vesu::extension::default_extension::LiquidationParams>";
        }, {
            readonly name: "shutdown_params";
            readonly type: "vesu::extension::default_extension::ShutdownParams";
        }, {
            readonly name: "fee_params";
            readonly type: "vesu::extension::default_extension::FeeParams";
        }, {
            readonly name: "owner";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::felt252";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "add_asset";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "asset_params";
            readonly type: "vesu::data_model::AssetParams";
        }, {
            readonly name: "v_token_params";
            readonly type: "vesu::extension::default_extension::VTokenParams";
        }, {
            readonly name: "interest_rate_config";
            readonly type: "vesu::extension::components::interest_rate_model::InterestRateConfig";
        }, {
            readonly name: "pragma_oracle_params";
            readonly type: "vesu::extension::default_extension::PragmaOracleParams";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly name: "set_asset_parameter";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "parameter";
            readonly type: "core::felt252";
        }, {
            readonly name: "value";
            readonly type: "core::integer::u256";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly name: "set_interest_rate_parameter";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "parameter";
            readonly type: "core::felt252";
        }, {
            readonly name: "value";
            readonly type: "core::integer::u256";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly name: "set_oracle_parameter";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "parameter";
            readonly type: "core::felt252";
        }, {
            readonly name: "value";
            readonly type: "core::integer::u64";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly name: "set_liquidation_config";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "collateral_asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "debt_asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "liquidation_config";
            readonly type: "vesu::extension::components::position_hooks::LiquidationConfig";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly name: "set_ltv_config";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "collateral_asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "debt_asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "ltv_config";
            readonly type: "vesu::data_model::LTVConfig";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly name: "set_shutdown_config";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "shutdown_config";
            readonly type: "vesu::extension::components::position_hooks::ShutdownConfig";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly name: "set_shutdown_ltv_config";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "collateral_asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "debt_asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "shutdown_ltv_config";
            readonly type: "vesu::data_model::LTVConfig";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly name: "set_extension";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "extension";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly name: "set_pool_owner";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "owner";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly name: "update_shutdown_status";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "collateral_asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "debt_asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "vesu::extension::components::position_hooks::ShutdownMode";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "claim_fees";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "collateral_asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }];
}, {
    readonly name: "ExtensionImpl";
    readonly type: "impl";
    readonly interface_name: "vesu::extension::interface::IExtension";
}, {
    readonly name: "vesu::data_model::AssetPrice";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "value";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "is_valid";
        readonly type: "core::bool";
    }];
}, {
    readonly name: "vesu::data_model::AssetConfig";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "total_collateral_shares";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "total_nominal_debt";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "reserve";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "max_utilization";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "floor";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "scale";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "is_legacy";
        readonly type: "core::bool";
    }, {
        readonly name: "last_updated";
        readonly type: "core::integer::u64";
    }, {
        readonly name: "last_rate_accumulator";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "last_full_utilization_rate";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "fee_rate";
        readonly type: "core::integer::u256";
    }];
}, {
    readonly name: "vesu::data_model::Position";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "collateral_shares";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "nominal_debt";
        readonly type: "core::integer::u256";
    }];
}, {
    readonly name: "vesu::data_model::Context";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly name: "extension";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "collateral_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "debt_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "collateral_asset_config";
        readonly type: "vesu::data_model::AssetConfig";
    }, {
        readonly name: "debt_asset_config";
        readonly type: "vesu::data_model::AssetConfig";
    }, {
        readonly name: "collateral_asset_price";
        readonly type: "vesu::data_model::AssetPrice";
    }, {
        readonly name: "debt_asset_price";
        readonly type: "vesu::data_model::AssetPrice";
    }, {
        readonly name: "collateral_asset_fee_shares";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "debt_asset_fee_shares";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "max_ltv";
        readonly type: "core::integer::u64";
    }, {
        readonly name: "user";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "position";
        readonly type: "vesu::data_model::Position";
    }];
}, {
    readonly name: "vesu::data_model::AmountType";
    readonly type: "enum";
    readonly variants: readonly [{
        readonly name: "Delta";
        readonly type: "()";
    }, {
        readonly name: "Target";
        readonly type: "()";
    }];
}, {
    readonly name: "vesu::data_model::AmountDenomination";
    readonly type: "enum";
    readonly variants: readonly [{
        readonly name: "Native";
        readonly type: "()";
    }, {
        readonly name: "Assets";
        readonly type: "()";
    }];
}, {
    readonly name: "alexandria_math::i257::i257";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "abs";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "is_negative";
        readonly type: "core::bool";
    }];
}, {
    readonly name: "vesu::data_model::Amount";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "amount_type";
        readonly type: "vesu::data_model::AmountType";
    }, {
        readonly name: "denomination";
        readonly type: "vesu::data_model::AmountDenomination";
    }, {
        readonly name: "value";
        readonly type: "alexandria_math::i257::i257";
    }];
}, {
    readonly name: "core::array::Span::<core::felt252>";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "snapshot";
        readonly type: "@core::array::Array::<core::felt252>";
    }];
}, {
    readonly name: "vesu::data_model::UnsignedAmount";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "amount_type";
        readonly type: "vesu::data_model::AmountType";
    }, {
        readonly name: "denomination";
        readonly type: "vesu::data_model::AmountDenomination";
    }, {
        readonly name: "value";
        readonly type: "core::integer::u256";
    }];
}, {
    readonly name: "vesu::extension::interface::IExtension";
    readonly type: "interface";
    readonly items: readonly [{
        readonly name: "singleton";
        readonly type: "function";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "price";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "vesu::data_model::AssetPrice";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "interest_rate";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "utilization";
            readonly type: "core::integer::u256";
        }, {
            readonly name: "last_updated";
            readonly type: "core::integer::u64";
        }, {
            readonly name: "last_full_utilization_rate";
            readonly type: "core::integer::u256";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "rate_accumulator";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "utilization";
            readonly type: "core::integer::u256";
        }, {
            readonly name: "last_updated";
            readonly type: "core::integer::u64";
        }, {
            readonly name: "last_rate_accumulator";
            readonly type: "core::integer::u256";
        }, {
            readonly name: "last_full_utilization_rate";
            readonly type: "core::integer::u256";
        }];
        readonly outputs: readonly [{
            readonly type: "(core::integer::u256, core::integer::u256)";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "before_modify_position";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "context";
            readonly type: "vesu::data_model::Context";
        }, {
            readonly name: "collateral";
            readonly type: "vesu::data_model::Amount";
        }, {
            readonly name: "debt";
            readonly type: "vesu::data_model::Amount";
        }, {
            readonly name: "data";
            readonly type: "core::array::Span::<core::felt252>";
        }, {
            readonly name: "caller";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "(vesu::data_model::Amount, vesu::data_model::Amount)";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "after_modify_position";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "context";
            readonly type: "vesu::data_model::Context";
        }, {
            readonly name: "collateral_delta";
            readonly type: "alexandria_math::i257::i257";
        }, {
            readonly name: "collateral_shares_delta";
            readonly type: "alexandria_math::i257::i257";
        }, {
            readonly name: "debt_delta";
            readonly type: "alexandria_math::i257::i257";
        }, {
            readonly name: "nominal_debt_delta";
            readonly type: "alexandria_math::i257::i257";
        }, {
            readonly name: "data";
            readonly type: "core::array::Span::<core::felt252>";
        }, {
            readonly name: "caller";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::bool";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "before_transfer_position";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "from_context";
            readonly type: "vesu::data_model::Context";
        }, {
            readonly name: "to_context";
            readonly type: "vesu::data_model::Context";
        }, {
            readonly name: "collateral";
            readonly type: "vesu::data_model::UnsignedAmount";
        }, {
            readonly name: "debt";
            readonly type: "vesu::data_model::UnsignedAmount";
        }, {
            readonly name: "data";
            readonly type: "core::array::Span::<core::felt252>";
        }, {
            readonly name: "caller";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "(vesu::data_model::UnsignedAmount, vesu::data_model::UnsignedAmount)";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "after_transfer_position";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "from_context";
            readonly type: "vesu::data_model::Context";
        }, {
            readonly name: "to_context";
            readonly type: "vesu::data_model::Context";
        }, {
            readonly name: "collateral_delta";
            readonly type: "core::integer::u256";
        }, {
            readonly name: "collateral_shares_delta";
            readonly type: "core::integer::u256";
        }, {
            readonly name: "debt_delta";
            readonly type: "core::integer::u256";
        }, {
            readonly name: "nominal_debt_delta";
            readonly type: "core::integer::u256";
        }, {
            readonly name: "data";
            readonly type: "core::array::Span::<core::felt252>";
        }, {
            readonly name: "caller";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::bool";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "before_liquidate_position";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "context";
            readonly type: "vesu::data_model::Context";
        }, {
            readonly name: "data";
            readonly type: "core::array::Span::<core::felt252>";
        }, {
            readonly name: "caller";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "(core::integer::u256, core::integer::u256, core::integer::u256)";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "after_liquidate_position";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "context";
            readonly type: "vesu::data_model::Context";
        }, {
            readonly name: "collateral_delta";
            readonly type: "alexandria_math::i257::i257";
        }, {
            readonly name: "collateral_shares_delta";
            readonly type: "alexandria_math::i257::i257";
        }, {
            readonly name: "debt_delta";
            readonly type: "alexandria_math::i257::i257";
        }, {
            readonly name: "nominal_debt_delta";
            readonly type: "alexandria_math::i257::i257";
        }, {
            readonly name: "bad_debt";
            readonly type: "core::integer::u256";
        }, {
            readonly name: "data";
            readonly type: "core::array::Span::<core::felt252>";
        }, {
            readonly name: "caller";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::bool";
        }];
        readonly state_mutability: "external";
    }];
}, {
    readonly name: "constructor";
    readonly type: "constructor";
    readonly inputs: readonly [{
        readonly name: "singleton";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "oracle_address";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "v_token_class_hash";
        readonly type: "core::felt252";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::extension::components::position_hooks::position_hooks_component::SetLiquidationConfig";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "data";
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly kind: "data";
        readonly name: "collateral_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "data";
        readonly name: "debt_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "data";
        readonly name: "liquidation_config";
        readonly type: "vesu::extension::components::position_hooks::LiquidationConfig";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::extension::components::position_hooks::position_hooks_component::SetShutdownConfig";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "data";
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly kind: "data";
        readonly name: "shutdown_config";
        readonly type: "vesu::extension::components::position_hooks::ShutdownConfig";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::extension::components::position_hooks::position_hooks_component::SetShutdownLTVConfig";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "data";
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly kind: "data";
        readonly name: "collateral_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "data";
        readonly name: "debt_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "data";
        readonly name: "shutdown_ltv_config";
        readonly type: "vesu::data_model::LTVConfig";
    }];
}, {
    readonly kind: "enum";
    readonly name: "vesu::extension::components::position_hooks::position_hooks_component::Event";
    readonly type: "event";
    readonly variants: readonly [{
        readonly kind: "nested";
        readonly name: "SetLiquidationConfig";
        readonly type: "vesu::extension::components::position_hooks::position_hooks_component::SetLiquidationConfig";
    }, {
        readonly kind: "nested";
        readonly name: "SetShutdownConfig";
        readonly type: "vesu::extension::components::position_hooks::position_hooks_component::SetShutdownConfig";
    }, {
        readonly kind: "nested";
        readonly name: "SetShutdownLTVConfig";
        readonly type: "vesu::extension::components::position_hooks::position_hooks_component::SetShutdownLTVConfig";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::extension::components::interest_rate_model::interest_rate_model_component::SetInterestRateConfig";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "data";
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly kind: "data";
        readonly name: "asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "data";
        readonly name: "interest_rate_config";
        readonly type: "vesu::extension::components::interest_rate_model::InterestRateConfig";
    }];
}, {
    readonly kind: "enum";
    readonly name: "vesu::extension::components::interest_rate_model::interest_rate_model_component::Event";
    readonly type: "event";
    readonly variants: readonly [{
        readonly kind: "nested";
        readonly name: "SetInterestRateConfig";
        readonly type: "vesu::extension::components::interest_rate_model::interest_rate_model_component::SetInterestRateConfig";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::extension::components::pragma_oracle::pragma_oracle_component::SetOracleConfig";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "data";
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly kind: "data";
        readonly name: "asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "data";
        readonly name: "oracle_config";
        readonly type: "vesu::extension::components::pragma_oracle::OracleConfig";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::extension::components::pragma_oracle::pragma_oracle_component::SetOracleParameter";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "data";
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly kind: "data";
        readonly name: "asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "data";
        readonly name: "parameter";
        readonly type: "core::felt252";
    }, {
        readonly kind: "data";
        readonly name: "value";
        readonly type: "core::integer::u64";
    }];
}, {
    readonly kind: "enum";
    readonly name: "vesu::extension::components::pragma_oracle::pragma_oracle_component::Event";
    readonly type: "event";
    readonly variants: readonly [{
        readonly kind: "nested";
        readonly name: "SetOracleConfig";
        readonly type: "vesu::extension::components::pragma_oracle::pragma_oracle_component::SetOracleConfig";
    }, {
        readonly kind: "nested";
        readonly name: "SetOracleParameter";
        readonly type: "vesu::extension::components::pragma_oracle::pragma_oracle_component::SetOracleParameter";
    }];
}, {
    readonly kind: "enum";
    readonly name: "vesu::map_list::map_list_component::Event";
    readonly type: "event";
    readonly variants: readonly [];
}, {
    readonly kind: "struct";
    readonly name: "vesu::extension::components::fee_model::fee_model_component::SetFeeConfig";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "key";
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly kind: "key";
        readonly name: "fee_config";
        readonly type: "vesu::extension::components::fee_model::FeeConfig";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::extension::components::fee_model::fee_model_component::ClaimFees";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "key";
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly kind: "data";
        readonly name: "collateral_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "data";
        readonly name: "debt_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "data";
        readonly name: "recipient";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "data";
        readonly name: "amount";
        readonly type: "core::integer::u256";
    }];
}, {
    readonly kind: "enum";
    readonly name: "vesu::extension::components::fee_model::fee_model_component::Event";
    readonly type: "event";
    readonly variants: readonly [{
        readonly kind: "nested";
        readonly name: "SetFeeConfig";
        readonly type: "vesu::extension::components::fee_model::fee_model_component::SetFeeConfig";
    }, {
        readonly kind: "nested";
        readonly name: "ClaimFees";
        readonly type: "vesu::extension::components::fee_model::fee_model_component::ClaimFees";
    }];
}, {
    readonly kind: "enum";
    readonly name: "vesu::extension::components::tokenization::tokenization_component::Event";
    readonly type: "event";
    readonly variants: readonly [];
}, {
    readonly kind: "struct";
    readonly name: "vesu::extension::default_extension::DefaultExtension::SetAssetParameter";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "key";
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly kind: "key";
        readonly name: "asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "parameter";
        readonly type: "core::felt252";
    }, {
        readonly kind: "data";
        readonly name: "value";
        readonly type: "core::integer::u256";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::extension::default_extension::DefaultExtension::SetPoolOwner";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "key";
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly kind: "key";
        readonly name: "owner";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }];
}, {
    readonly kind: "enum";
    readonly name: "vesu::extension::default_extension::DefaultExtension::Event";
    readonly type: "event";
    readonly variants: readonly [{
        readonly kind: "nested";
        readonly name: "PositionHooksEvents";
        readonly type: "vesu::extension::components::position_hooks::position_hooks_component::Event";
    }, {
        readonly kind: "nested";
        readonly name: "InterestRateModelEvents";
        readonly type: "vesu::extension::components::interest_rate_model::interest_rate_model_component::Event";
    }, {
        readonly kind: "nested";
        readonly name: "PragmaOracleEvents";
        readonly type: "vesu::extension::components::pragma_oracle::pragma_oracle_component::Event";
    }, {
        readonly kind: "nested";
        readonly name: "MapListEvents";
        readonly type: "vesu::map_list::map_list_component::Event";
    }, {
        readonly kind: "nested";
        readonly name: "FeeModelEvents";
        readonly type: "vesu::extension::components::fee_model::fee_model_component::Event";
    }, {
        readonly kind: "nested";
        readonly name: "TokenizationEvents";
        readonly type: "vesu::extension::components::tokenization::tokenization_component::Event";
    }, {
        readonly kind: "nested";
        readonly name: "SetAssetParameter";
        readonly type: "vesu::extension::default_extension::DefaultExtension::SetAssetParameter";
    }, {
        readonly kind: "nested";
        readonly name: "SetPoolOwner";
        readonly type: "vesu::extension::default_extension::DefaultExtension::SetPoolOwner";
    }];
}];
