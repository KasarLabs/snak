export declare const abbotAbi: readonly [{
    readonly type: "impl";
    readonly name: "IAbbotImpl";
    readonly interface_name: "opus::interfaces::IAbbot::IAbbot";
}, {
    readonly type: "enum";
    readonly name: "core::option::Option::<core::starknet::contract_address::ContractAddress>";
    readonly variants: readonly [{
        readonly name: "Some";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "None";
        readonly type: "()";
    }];
}, {
    readonly type: "struct";
    readonly name: "core::array::Span::<core::integer::u64>";
    readonly members: readonly [{
        readonly name: "snapshot";
        readonly type: "@core::array::Array::<core::integer::u64>";
    }];
}, {
    readonly type: "struct";
    readonly name: "opus::types::AssetBalance";
    readonly members: readonly [{
        readonly name: "address";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "amount";
        readonly type: "core::integer::u128";
    }];
}, {
    readonly type: "struct";
    readonly name: "core::array::Span::<opus::types::AssetBalance>";
    readonly members: readonly [{
        readonly name: "snapshot";
        readonly type: "@core::array::Array::<opus::types::AssetBalance>";
    }];
}, {
    readonly type: "struct";
    readonly name: "wadray::wadray::Wad";
    readonly members: readonly [{
        readonly name: "val";
        readonly type: "core::integer::u128";
    }];
}, {
    readonly type: "interface";
    readonly name: "opus::interfaces::IAbbot::IAbbot";
    readonly items: readonly [{
        readonly type: "function";
        readonly name: "get_trove_owner";
        readonly inputs: readonly [{
            readonly name: "trove_id";
            readonly type: "core::integer::u64";
        }];
        readonly outputs: readonly [{
            readonly type: "core::option::Option::<core::starknet::contract_address::ContractAddress>";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_user_trove_ids";
        readonly inputs: readonly [{
            readonly name: "user";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::array::Span::<core::integer::u64>";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_troves_count";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::integer::u64";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_trove_asset_balance";
        readonly inputs: readonly [{
            readonly name: "trove_id";
            readonly type: "core::integer::u64";
        }, {
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u128";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "open_trove";
        readonly inputs: readonly [{
            readonly name: "yang_assets";
            readonly type: "core::array::Span::<opus::types::AssetBalance>";
        }, {
            readonly name: "forge_amount";
            readonly type: "wadray::wadray::Wad";
        }, {
            readonly name: "max_forge_fee_pct";
            readonly type: "wadray::wadray::Wad";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u64";
        }];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "close_trove";
        readonly inputs: readonly [{
            readonly name: "trove_id";
            readonly type: "core::integer::u64";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "deposit";
        readonly inputs: readonly [{
            readonly name: "trove_id";
            readonly type: "core::integer::u64";
        }, {
            readonly name: "yang_asset";
            readonly type: "opus::types::AssetBalance";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "withdraw";
        readonly inputs: readonly [{
            readonly name: "trove_id";
            readonly type: "core::integer::u64";
        }, {
            readonly name: "yang_asset";
            readonly type: "opus::types::AssetBalance";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "forge";
        readonly inputs: readonly [{
            readonly name: "trove_id";
            readonly type: "core::integer::u64";
        }, {
            readonly name: "amount";
            readonly type: "wadray::wadray::Wad";
        }, {
            readonly name: "max_forge_fee_pct";
            readonly type: "wadray::wadray::Wad";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "melt";
        readonly inputs: readonly [{
            readonly name: "trove_id";
            readonly type: "core::integer::u64";
        }, {
            readonly name: "amount";
            readonly type: "wadray::wadray::Wad";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }];
}, {
    readonly type: "constructor";
    readonly name: "constructor";
    readonly inputs: readonly [{
        readonly name: "shrine";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "sentinel";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::utils::reentrancy_guard::reentrancy_guard_component::Event";
    readonly kind: "enum";
    readonly variants: readonly [];
}, {
    readonly type: "event";
    readonly name: "opus::core::abbot::abbot::Deposit";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "user";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "trove_id";
        readonly type: "core::integer::u64";
        readonly kind: "key";
    }, {
        readonly name: "yang";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "yang_amt";
        readonly type: "wadray::wadray::Wad";
        readonly kind: "data";
    }, {
        readonly name: "asset_amt";
        readonly type: "core::integer::u128";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::abbot::abbot::Withdraw";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "user";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "trove_id";
        readonly type: "core::integer::u64";
        readonly kind: "key";
    }, {
        readonly name: "yang";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "yang_amt";
        readonly type: "wadray::wadray::Wad";
        readonly kind: "data";
    }, {
        readonly name: "asset_amt";
        readonly type: "core::integer::u128";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::abbot::abbot::TroveOpened";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "user";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "trove_id";
        readonly type: "core::integer::u64";
        readonly kind: "key";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::abbot::abbot::TroveClosed";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "trove_id";
        readonly type: "core::integer::u64";
        readonly kind: "key";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::abbot::abbot::Event";
    readonly kind: "enum";
    readonly variants: readonly [{
        readonly name: "ReentrancyGuardEvent";
        readonly type: "opus::utils::reentrancy_guard::reentrancy_guard_component::Event";
        readonly kind: "nested";
    }, {
        readonly name: "Deposit";
        readonly type: "opus::core::abbot::abbot::Deposit";
        readonly kind: "nested";
    }, {
        readonly name: "Withdraw";
        readonly type: "opus::core::abbot::abbot::Withdraw";
        readonly kind: "nested";
    }, {
        readonly name: "TroveOpened";
        readonly type: "opus::core::abbot::abbot::TroveOpened";
        readonly kind: "nested";
    }, {
        readonly name: "TroveClosed";
        readonly type: "opus::core::abbot::abbot::TroveClosed";
        readonly kind: "nested";
    }];
}];
