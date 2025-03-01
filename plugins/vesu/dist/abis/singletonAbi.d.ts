export declare const singletonAbi: readonly [{
    readonly name: "SingletonImpl";
    readonly type: "impl";
    readonly interface_name: "vesu::singleton::ISingleton";
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
    readonly name: "vesu::data_model::LTVConfig";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "max_ltv";
        readonly type: "core::integer::u64";
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
    readonly name: "core::array::Span::<core::felt252>";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "snapshot";
        readonly type: "@core::array::Array::<core::felt252>";
    }];
}, {
    readonly name: "vesu::data_model::ModifyPositionParams";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly name: "collateral_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "debt_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "user";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "collateral";
        readonly type: "vesu::data_model::Amount";
    }, {
        readonly name: "debt";
        readonly type: "vesu::data_model::Amount";
    }, {
        readonly name: "data";
        readonly type: "core::array::Span::<core::felt252>";
    }];
}, {
    readonly name: "vesu::data_model::UpdatePositionResponse";
    readonly type: "struct";
    readonly members: readonly [{
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
    readonly name: "vesu::data_model::TransferPositionParams";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly name: "from_collateral_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "from_debt_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "to_collateral_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "to_debt_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "from_user";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "to_user";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "collateral";
        readonly type: "vesu::data_model::UnsignedAmount";
    }, {
        readonly name: "debt";
        readonly type: "vesu::data_model::UnsignedAmount";
    }, {
        readonly name: "from_data";
        readonly type: "core::array::Span::<core::felt252>";
    }, {
        readonly name: "to_data";
        readonly type: "core::array::Span::<core::felt252>";
    }];
}, {
    readonly name: "vesu::data_model::LiquidatePositionParams";
    readonly type: "struct";
    readonly members: readonly [{
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly name: "collateral_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "debt_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "user";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "receive_as_shares";
        readonly type: "core::bool";
    }, {
        readonly name: "data";
        readonly type: "core::array::Span::<core::felt252>";
    }];
}, {
    readonly name: "vesu::singleton::ISingleton";
    readonly type: "interface";
    readonly items: readonly [{
        readonly name: "creator_nonce";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "creator";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::felt252";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "extension";
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
        readonly name: "asset_config_unsafe";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "(vesu::data_model::AssetConfig, core::integer::u256)";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "asset_config";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "(vesu::data_model::AssetConfig, core::integer::u256)";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "ltv_config";
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
        readonly name: "position_unsafe";
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
            readonly name: "user";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "(vesu::data_model::Position, core::integer::u256, core::integer::u256)";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "position";
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
            readonly name: "user";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "(vesu::data_model::Position, core::integer::u256, core::integer::u256)";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "check_collateralization_unsafe";
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
            readonly name: "user";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "(core::bool, core::integer::u256, core::integer::u256)";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "check_collateralization";
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
            readonly name: "user";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "(core::bool, core::integer::u256, core::integer::u256)";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "rate_accumulator_unsafe";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
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
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "utilization_unsafe";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "utilization";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "delegation";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "delegator";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "delegatee";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::bool";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "calculate_pool_id";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "caller_address";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "nonce";
            readonly type: "core::felt252";
        }];
        readonly outputs: readonly [{
            readonly type: "core::felt252";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "calculate_debt";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "nominal_debt";
            readonly type: "alexandria_math::i257::i257";
        }, {
            readonly name: "rate_accumulator";
            readonly type: "core::integer::u256";
        }, {
            readonly name: "asset_scale";
            readonly type: "core::integer::u256";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "calculate_nominal_debt";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "debt";
            readonly type: "alexandria_math::i257::i257";
        }, {
            readonly name: "rate_accumulator";
            readonly type: "core::integer::u256";
        }, {
            readonly name: "asset_scale";
            readonly type: "core::integer::u256";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "calculate_collateral_shares_unsafe";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "collateral";
            readonly type: "alexandria_math::i257::i257";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "calculate_collateral_shares";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "collateral";
            readonly type: "alexandria_math::i257::i257";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "calculate_collateral_unsafe";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "collateral_shares";
            readonly type: "alexandria_math::i257::i257";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "calculate_collateral";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "collateral_shares";
            readonly type: "alexandria_math::i257::i257";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "deconstruct_collateral_amount_unsafe";
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
            readonly name: "user";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "collateral";
            readonly type: "vesu::data_model::Amount";
        }];
        readonly outputs: readonly [{
            readonly type: "(alexandria_math::i257::i257, alexandria_math::i257::i257)";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "deconstruct_collateral_amount";
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
            readonly name: "user";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "collateral";
            readonly type: "vesu::data_model::Amount";
        }];
        readonly outputs: readonly [{
            readonly type: "(alexandria_math::i257::i257, alexandria_math::i257::i257)";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "deconstruct_debt_amount_unsafe";
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
            readonly name: "user";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "debt";
            readonly type: "vesu::data_model::Amount";
        }];
        readonly outputs: readonly [{
            readonly type: "(alexandria_math::i257::i257, alexandria_math::i257::i257)";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "deconstruct_debt_amount";
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
            readonly name: "user";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "debt";
            readonly type: "vesu::data_model::Amount";
        }];
        readonly outputs: readonly [{
            readonly type: "(alexandria_math::i257::i257, alexandria_math::i257::i257)";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "context_unsafe";
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
            readonly name: "user";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "vesu::data_model::Context";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "context";
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
            readonly name: "user";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "vesu::data_model::Context";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "create_pool";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "asset_params";
            readonly type: "core::array::Span::<vesu::data_model::AssetParams>";
        }, {
            readonly name: "ltv_params";
            readonly type: "core::array::Span::<vesu::data_model::LTVParams>";
        }, {
            readonly name: "extension";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::felt252";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "modify_position";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "params";
            readonly type: "vesu::data_model::ModifyPositionParams";
        }];
        readonly outputs: readonly [{
            readonly type: "vesu::data_model::UpdatePositionResponse";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "transfer_position";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "params";
            readonly type: "vesu::data_model::TransferPositionParams";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly name: "liquidate_position";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "params";
            readonly type: "vesu::data_model::LiquidatePositionParams";
        }];
        readonly outputs: readonly [{
            readonly type: "vesu::data_model::UpdatePositionResponse";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "flash_loan";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "receiver";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "amount";
            readonly type: "core::integer::u256";
        }, {
            readonly name: "is_legacy";
            readonly type: "core::bool";
        }, {
            readonly name: "data";
            readonly type: "core::array::Span::<core::felt252>";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly name: "modify_delegation";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "delegatee";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "delegation";
            readonly type: "core::bool";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly name: "donate_to_reserve";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "amount";
            readonly type: "core::integer::u256";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly name: "retrieve_from_reserve";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "receiver";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "amount";
            readonly type: "core::integer::u256";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly name: "set_asset_config";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "params";
            readonly type: "vesu::data_model::AssetParams";
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
        readonly name: "claim_fee_shares";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "pool_id";
            readonly type: "core::felt252";
        }, {
            readonly name: "asset";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::singleton::Singleton::CreatePool";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "key";
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly kind: "key";
        readonly name: "extension";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "creator";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::singleton::Singleton::ModifyPosition";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "key";
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly kind: "key";
        readonly name: "collateral_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "debt_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "user";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "data";
        readonly name: "collateral_delta";
        readonly type: "alexandria_math::i257::i257";
    }, {
        readonly kind: "data";
        readonly name: "collateral_shares_delta";
        readonly type: "alexandria_math::i257::i257";
    }, {
        readonly kind: "data";
        readonly name: "debt_delta";
        readonly type: "alexandria_math::i257::i257";
    }, {
        readonly kind: "data";
        readonly name: "nominal_debt_delta";
        readonly type: "alexandria_math::i257::i257";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::singleton::Singleton::TransferPosition";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "key";
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly kind: "key";
        readonly name: "from_collateral_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "from_debt_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "to_collateral_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "to_debt_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "from_user";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "to_user";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::singleton::Singleton::LiquidatePosition";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "key";
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly kind: "key";
        readonly name: "collateral_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "debt_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "user";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "liquidator";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "data";
        readonly name: "collateral_delta";
        readonly type: "alexandria_math::i257::i257";
    }, {
        readonly kind: "data";
        readonly name: "collateral_shares_delta";
        readonly type: "alexandria_math::i257::i257";
    }, {
        readonly kind: "data";
        readonly name: "debt_delta";
        readonly type: "alexandria_math::i257::i257";
    }, {
        readonly kind: "data";
        readonly name: "nominal_debt_delta";
        readonly type: "alexandria_math::i257::i257";
    }, {
        readonly kind: "data";
        readonly name: "bad_debt";
        readonly type: "core::integer::u256";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::singleton::Singleton::AccrueFees";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "key";
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly kind: "key";
        readonly name: "collateral_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "debt_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "recipient";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "data";
        readonly name: "collateral_asset_fee_shares";
        readonly type: "core::integer::u256";
    }, {
        readonly kind: "data";
        readonly name: "debt_asset_fee_shares";
        readonly type: "core::integer::u256";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::singleton::Singleton::UpdateContext";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "key";
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly kind: "key";
        readonly name: "collateral_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "debt_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "data";
        readonly name: "collateral_asset_config";
        readonly type: "vesu::data_model::AssetConfig";
    }, {
        readonly kind: "data";
        readonly name: "debt_asset_config";
        readonly type: "vesu::data_model::AssetConfig";
    }, {
        readonly kind: "data";
        readonly name: "collateral_asset_price";
        readonly type: "vesu::data_model::AssetPrice";
    }, {
        readonly kind: "data";
        readonly name: "debt_asset_price";
        readonly type: "vesu::data_model::AssetPrice";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::singleton::Singleton::Flashloan";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "key";
        readonly name: "sender";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "receiver";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "data";
        readonly name: "amount";
        readonly type: "core::integer::u256";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::singleton::Singleton::ModifyDelegation";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "key";
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly kind: "key";
        readonly name: "delegator";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "delegatee";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "data";
        readonly name: "delegation";
        readonly type: "core::bool";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::singleton::Singleton::Donate";
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
        readonly kind: "data";
        readonly name: "amount";
        readonly type: "core::integer::u256";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::singleton::Singleton::RetrieveReserve";
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
        readonly name: "receiver";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::singleton::Singleton::SetLTVConfig";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "key";
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly kind: "key";
        readonly name: "collateral_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "debt_asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "data";
        readonly name: "ltv_config";
        readonly type: "vesu::data_model::LTVConfig";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::singleton::Singleton::SetAssetConfig";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "key";
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly kind: "key";
        readonly name: "asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::singleton::Singleton::SetAssetParameter";
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
    readonly name: "vesu::singleton::Singleton::SetExtension";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "key";
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly kind: "key";
        readonly name: "extension";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }];
}, {
    readonly kind: "enum";
    readonly name: "vesu::singleton::Singleton::Event";
    readonly type: "event";
    readonly variants: readonly [{
        readonly kind: "nested";
        readonly name: "CreatePool";
        readonly type: "vesu::singleton::Singleton::CreatePool";
    }, {
        readonly kind: "nested";
        readonly name: "ModifyPosition";
        readonly type: "vesu::singleton::Singleton::ModifyPosition";
    }, {
        readonly kind: "nested";
        readonly name: "TransferPosition";
        readonly type: "vesu::singleton::Singleton::TransferPosition";
    }, {
        readonly kind: "nested";
        readonly name: "LiquidatePosition";
        readonly type: "vesu::singleton::Singleton::LiquidatePosition";
    }, {
        readonly kind: "nested";
        readonly name: "AccrueFees";
        readonly type: "vesu::singleton::Singleton::AccrueFees";
    }, {
        readonly kind: "nested";
        readonly name: "UpdateContext";
        readonly type: "vesu::singleton::Singleton::UpdateContext";
    }, {
        readonly kind: "nested";
        readonly name: "Flashloan";
        readonly type: "vesu::singleton::Singleton::Flashloan";
    }, {
        readonly kind: "nested";
        readonly name: "ModifyDelegation";
        readonly type: "vesu::singleton::Singleton::ModifyDelegation";
    }, {
        readonly kind: "nested";
        readonly name: "Donate";
        readonly type: "vesu::singleton::Singleton::Donate";
    }, {
        readonly kind: "nested";
        readonly name: "RetrieveReserve";
        readonly type: "vesu::singleton::Singleton::RetrieveReserve";
    }, {
        readonly kind: "nested";
        readonly name: "SetLTVConfig";
        readonly type: "vesu::singleton::Singleton::SetLTVConfig";
    }, {
        readonly kind: "nested";
        readonly name: "SetAssetConfig";
        readonly type: "vesu::singleton::Singleton::SetAssetConfig";
    }, {
        readonly kind: "nested";
        readonly name: "SetAssetParameter";
        readonly type: "vesu::singleton::Singleton::SetAssetParameter";
    }, {
        readonly kind: "nested";
        readonly name: "SetExtension";
        readonly type: "vesu::singleton::Singleton::SetExtension";
    }];
}];
