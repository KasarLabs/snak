import { constants } from 'starknet';
export declare const getErc20Contract: (address: string) => import("starknet").TypedContractV2<readonly [{
    readonly type: "impl";
    readonly name: "ERC20Impl";
    readonly interface_name: "opus::mock::erc20::IERC20";
}, {
    readonly type: "struct";
    readonly name: "core::integer::u256";
    readonly members: readonly [{
        readonly name: "low";
        readonly type: "core::integer::u128";
    }, {
        readonly name: "high";
        readonly type: "core::integer::u128";
    }];
}, {
    readonly type: "enum";
    readonly name: "core::bool";
    readonly variants: readonly [{
        readonly name: "False";
        readonly type: "()";
    }, {
        readonly name: "True";
        readonly type: "()";
    }];
}, {
    readonly type: "interface";
    readonly name: "opus::mock::erc20::IERC20";
    readonly items: readonly [{
        readonly type: "function";
        readonly name: "name";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::felt252";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "symbol";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::felt252";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "decimals";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::integer::u8";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "total_supply";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "balance_of";
        readonly inputs: readonly [{
            readonly name: "account";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "allowance";
        readonly inputs: readonly [{
            readonly name: "owner";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "spender";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "transfer";
        readonly inputs: readonly [{
            readonly name: "recipient";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "amount";
            readonly type: "core::integer::u256";
        }];
        readonly outputs: readonly [{
            readonly type: "core::bool";
        }];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "transfer_from";
        readonly inputs: readonly [{
            readonly name: "sender";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "recipient";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "amount";
            readonly type: "core::integer::u256";
        }];
        readonly outputs: readonly [{
            readonly type: "core::bool";
        }];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "approve";
        readonly inputs: readonly [{
            readonly name: "spender";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "amount";
            readonly type: "core::integer::u256";
        }];
        readonly outputs: readonly [{
            readonly type: "core::bool";
        }];
        readonly state_mutability: "external";
    }];
}, {
    readonly type: "constructor";
    readonly name: "constructor";
    readonly inputs: readonly [{
        readonly name: "name";
        readonly type: "core::felt252";
    }, {
        readonly name: "symbol";
        readonly type: "core::felt252";
    }, {
        readonly name: "decimals";
        readonly type: "core::integer::u8";
    }, {
        readonly name: "initial_supply";
        readonly type: "core::integer::u256";
    }, {
        readonly name: "recipient";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::mock::erc20::erc20::Transfer";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "from";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "to";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "value";
        readonly type: "core::integer::u256";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::mock::erc20::erc20::Approval";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "owner";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "spender";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "value";
        readonly type: "core::integer::u256";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::mock::erc20::erc20::Event";
    readonly kind: "enum";
    readonly variants: readonly [{
        readonly name: "Transfer";
        readonly type: "opus::mock::erc20::erc20::Transfer";
        readonly kind: "nested";
    }, {
        readonly name: "Approval";
        readonly type: "opus::mock::erc20::erc20::Approval";
        readonly kind: "nested";
    }];
}]>;
export declare const getAbbotContract: (chainId: constants.StarknetChainId) => import("starknet").TypedContractV2<readonly [{
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
}]>;
export declare const getSentinelContract: (chainId: constants.StarknetChainId) => import("starknet").TypedContractV2<readonly [{
    readonly type: "impl";
    readonly name: "ISentinelImpl";
    readonly interface_name: "opus::interfaces::ISentinel::ISentinel";
}, {
    readonly type: "enum";
    readonly name: "core::bool";
    readonly variants: readonly [{
        readonly name: "False";
        readonly type: "()";
    }, {
        readonly name: "True";
        readonly type: "()";
    }];
}, {
    readonly type: "struct";
    readonly name: "core::array::Span::<core::starknet::contract_address::ContractAddress>";
    readonly members: readonly [{
        readonly name: "snapshot";
        readonly type: "@core::array::Array::<core::starknet::contract_address::ContractAddress>";
    }];
}, {
    readonly type: "struct";
    readonly name: "wadray::wadray::Wad";
    readonly members: readonly [{
        readonly name: "val";
        readonly type: "core::integer::u128";
    }];
}, {
    readonly type: "struct";
    readonly name: "wadray::wadray::Ray";
    readonly members: readonly [{
        readonly name: "val";
        readonly type: "core::integer::u128";
    }];
}, {
    readonly type: "interface";
    readonly name: "opus::interfaces::ISentinel::ISentinel";
    readonly items: readonly [{
        readonly type: "function";
        readonly name: "get_gate_address";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_gate_live";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::bool";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_yang_addresses";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::array::Span::<core::starknet::contract_address::ContractAddress>";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_yang_addresses_count";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::integer::u32";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_yang";
        readonly inputs: readonly [{
            readonly name: "idx";
            readonly type: "core::integer::u32";
        }];
        readonly outputs: readonly [{
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_yang_asset_max";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u128";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_asset_amt_per_yang";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "wadray::wadray::Wad";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "add_yang";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "yang_asset_max";
            readonly type: "core::integer::u128";
        }, {
            readonly name: "yang_threshold";
            readonly type: "wadray::wadray::Ray";
        }, {
            readonly name: "yang_price";
            readonly type: "wadray::wadray::Wad";
        }, {
            readonly name: "yang_rate";
            readonly type: "wadray::wadray::Ray";
        }, {
            readonly name: "gate";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "set_yang_asset_max";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "new_asset_max";
            readonly type: "core::integer::u128";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "enter";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "user";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "asset_amt";
            readonly type: "core::integer::u128";
        }];
        readonly outputs: readonly [{
            readonly type: "wadray::wadray::Wad";
        }];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "exit";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "user";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "yang_amt";
            readonly type: "wadray::wadray::Wad";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u128";
        }];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "kill_gate";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "suspend_yang";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "unsuspend_yang";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "convert_to_yang";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "asset_amt";
            readonly type: "core::integer::u128";
        }];
        readonly outputs: readonly [{
            readonly type: "wadray::wadray::Wad";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "convert_to_assets";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "yang_amt";
            readonly type: "wadray::wadray::Wad";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u128";
        }];
        readonly state_mutability: "view";
    }];
}, {
    readonly type: "impl";
    readonly name: "AccessControlPublic";
    readonly interface_name: "access_control::access_control::IAccessControl";
}, {
    readonly type: "interface";
    readonly name: "access_control::access_control::IAccessControl";
    readonly items: readonly [{
        readonly type: "function";
        readonly name: "get_roles";
        readonly inputs: readonly [{
            readonly name: "account";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u128";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "has_role";
        readonly inputs: readonly [{
            readonly name: "role";
            readonly type: "core::integer::u128";
        }, {
            readonly name: "account";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::bool";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_admin";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_pending_admin";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "grant_role";
        readonly inputs: readonly [{
            readonly name: "role";
            readonly type: "core::integer::u128";
        }, {
            readonly name: "account";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "revoke_role";
        readonly inputs: readonly [{
            readonly name: "role";
            readonly type: "core::integer::u128";
        }, {
            readonly name: "account";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "renounce_role";
        readonly inputs: readonly [{
            readonly name: "role";
            readonly type: "core::integer::u128";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "set_pending_admin";
        readonly inputs: readonly [{
            readonly name: "new_admin";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "accept_admin";
        readonly inputs: readonly [];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }];
}, {
    readonly type: "constructor";
    readonly name: "constructor";
    readonly inputs: readonly [{
        readonly name: "admin";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "shrine";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }];
}, {
    readonly type: "event";
    readonly name: "access_control::access_control::access_control_component::AdminChanged";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "old_admin";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "data";
    }, {
        readonly name: "new_admin";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "access_control::access_control::access_control_component::NewPendingAdmin";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "new_admin";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "access_control::access_control::access_control_component::RoleGranted";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "user";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "data";
    }, {
        readonly name: "role_granted";
        readonly type: "core::integer::u128";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "access_control::access_control::access_control_component::RoleRevoked";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "user";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "data";
    }, {
        readonly name: "role_revoked";
        readonly type: "core::integer::u128";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "access_control::access_control::access_control_component::Event";
    readonly kind: "enum";
    readonly variants: readonly [{
        readonly name: "AdminChanged";
        readonly type: "access_control::access_control::access_control_component::AdminChanged";
        readonly kind: "nested";
    }, {
        readonly name: "NewPendingAdmin";
        readonly type: "access_control::access_control::access_control_component::NewPendingAdmin";
        readonly kind: "nested";
    }, {
        readonly name: "RoleGranted";
        readonly type: "access_control::access_control::access_control_component::RoleGranted";
        readonly kind: "nested";
    }, {
        readonly name: "RoleRevoked";
        readonly type: "access_control::access_control::access_control_component::RoleRevoked";
        readonly kind: "nested";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::sentinel::sentinel::YangAdded";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "yang";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "gate";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::sentinel::sentinel::YangAssetMaxUpdated";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "yang";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "old_max";
        readonly type: "core::integer::u128";
        readonly kind: "data";
    }, {
        readonly name: "new_max";
        readonly type: "core::integer::u128";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::sentinel::sentinel::GateKilled";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "yang";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "gate";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::sentinel::sentinel::Event";
    readonly kind: "enum";
    readonly variants: readonly [{
        readonly name: "AccessControlEvent";
        readonly type: "access_control::access_control::access_control_component::Event";
        readonly kind: "nested";
    }, {
        readonly name: "YangAdded";
        readonly type: "opus::core::sentinel::sentinel::YangAdded";
        readonly kind: "nested";
    }, {
        readonly name: "YangAssetMaxUpdated";
        readonly type: "opus::core::sentinel::sentinel::YangAssetMaxUpdated";
        readonly kind: "nested";
    }, {
        readonly name: "GateKilled";
        readonly type: "opus::core::sentinel::sentinel::GateKilled";
        readonly kind: "nested";
    }];
}]>;
export declare const getShrineContract: (chainId: constants.StarknetChainId) => import("starknet").TypedContractV2<readonly [{
    readonly type: "impl";
    readonly name: "IShrineImpl";
    readonly interface_name: "opus::interfaces::IShrine::IShrine";
}, {
    readonly type: "struct";
    readonly name: "wadray::wadray::Wad";
    readonly members: readonly [{
        readonly name: "val";
        readonly type: "core::integer::u128";
    }];
}, {
    readonly type: "enum";
    readonly name: "core::bool";
    readonly variants: readonly [{
        readonly name: "False";
        readonly type: "()";
    }, {
        readonly name: "True";
        readonly type: "()";
    }];
}, {
    readonly type: "struct";
    readonly name: "wadray::wadray_signed::SignedWad";
    readonly members: readonly [{
        readonly name: "val";
        readonly type: "core::integer::u128";
    }, {
        readonly name: "sign";
        readonly type: "core::bool";
    }];
}, {
    readonly type: "struct";
    readonly name: "wadray::wadray::Ray";
    readonly members: readonly [{
        readonly name: "val";
        readonly type: "core::integer::u128";
    }];
}, {
    readonly type: "enum";
    readonly name: "opus::types::YangSuspensionStatus";
    readonly variants: readonly [{
        readonly name: "None";
        readonly type: "()";
    }, {
        readonly name: "Temporary";
        readonly type: "()";
    }, {
        readonly name: "Permanent";
        readonly type: "()";
    }];
}, {
    readonly type: "struct";
    readonly name: "opus::types::YangRedistribution";
    readonly members: readonly [{
        readonly name: "unit_debt";
        readonly type: "wadray::wadray::Wad";
    }, {
        readonly name: "error";
        readonly type: "wadray::wadray::Wad";
    }, {
        readonly name: "exception";
        readonly type: "core::bool";
    }];
}, {
    readonly type: "struct";
    readonly name: "opus::types::ExceptionalYangRedistribution";
    readonly members: readonly [{
        readonly name: "unit_debt";
        readonly type: "wadray::wadray::Wad";
    }, {
        readonly name: "unit_yang";
        readonly type: "wadray::wadray::Wad";
    }];
}, {
    readonly type: "struct";
    readonly name: "core::array::Span::<core::starknet::contract_address::ContractAddress>";
    readonly members: readonly [{
        readonly name: "snapshot";
        readonly type: "@core::array::Array::<core::starknet::contract_address::ContractAddress>";
    }];
}, {
    readonly type: "struct";
    readonly name: "core::array::Span::<wadray::wadray::Ray>";
    readonly members: readonly [{
        readonly name: "snapshot";
        readonly type: "@core::array::Array::<wadray::wadray::Ray>";
    }];
}, {
    readonly type: "struct";
    readonly name: "opus::types::Health";
    readonly members: readonly [{
        readonly name: "threshold";
        readonly type: "wadray::wadray::Ray";
    }, {
        readonly name: "ltv";
        readonly type: "wadray::wadray::Ray";
    }, {
        readonly name: "value";
        readonly type: "wadray::wadray::Wad";
    }, {
        readonly name: "debt";
        readonly type: "wadray::wadray::Wad";
    }];
}, {
    readonly type: "struct";
    readonly name: "opus::types::YangBalance";
    readonly members: readonly [{
        readonly name: "yang_id";
        readonly type: "core::integer::u32";
    }, {
        readonly name: "amount";
        readonly type: "wadray::wadray::Wad";
    }];
}, {
    readonly type: "struct";
    readonly name: "core::array::Span::<opus::types::YangBalance>";
    readonly members: readonly [{
        readonly name: "snapshot";
        readonly type: "@core::array::Array::<opus::types::YangBalance>";
    }];
}, {
    readonly type: "interface";
    readonly name: "opus::interfaces::IShrine::IShrine";
    readonly items: readonly [{
        readonly type: "function";
        readonly name: "get_yin";
        readonly inputs: readonly [{
            readonly name: "user";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "wadray::wadray::Wad";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_total_yin";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "wadray::wadray::Wad";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_yin_spot_price";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "wadray::wadray::Wad";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_yang_total";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "wadray::wadray::Wad";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_initial_yang_amt";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "wadray::wadray::Wad";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_yangs_count";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::integer::u32";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_deposit";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "trove_id";
            readonly type: "core::integer::u64";
        }];
        readonly outputs: readonly [{
            readonly type: "wadray::wadray::Wad";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_budget";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "wadray::wadray_signed::SignedWad";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_yang_price";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "interval";
            readonly type: "core::integer::u64";
        }];
        readonly outputs: readonly [{
            readonly type: "(wadray::wadray::Wad, wadray::wadray::Wad)";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_yang_rate";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "rate_era";
            readonly type: "core::integer::u64";
        }];
        readonly outputs: readonly [{
            readonly type: "wadray::wadray::Ray";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_current_rate_era";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::integer::u64";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_minimum_trove_value";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "wadray::wadray::Wad";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_debt_ceiling";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "wadray::wadray::Wad";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_multiplier";
        readonly inputs: readonly [{
            readonly name: "interval";
            readonly type: "core::integer::u64";
        }];
        readonly outputs: readonly [{
            readonly type: "(wadray::wadray::Ray, wadray::wadray::Ray)";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_yang_suspension_status";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "opus::types::YangSuspensionStatus";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_yang_threshold";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "(wadray::wadray::Ray, wadray::wadray::Ray)";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_redistributions_count";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::integer::u32";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_trove_redistribution_id";
        readonly inputs: readonly [{
            readonly name: "trove_id";
            readonly type: "core::integer::u64";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u32";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_redistribution_for_yang";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "redistribution_id";
            readonly type: "core::integer::u32";
        }];
        readonly outputs: readonly [{
            readonly type: "opus::types::YangRedistribution";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_exceptional_redistribution_for_yang_to_yang";
        readonly inputs: readonly [{
            readonly name: "recipient_yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "redistribution_id";
            readonly type: "core::integer::u32";
        }, {
            readonly name: "redistributed_yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "opus::types::ExceptionalYangRedistribution";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "is_recovery_mode";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::bool";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_live";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::bool";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "add_yang";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "threshold";
            readonly type: "wadray::wadray::Ray";
        }, {
            readonly name: "start_price";
            readonly type: "wadray::wadray::Wad";
        }, {
            readonly name: "initial_rate";
            readonly type: "wadray::wadray::Ray";
        }, {
            readonly name: "initial_yang_amt";
            readonly type: "wadray::wadray::Wad";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "set_threshold";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "new_threshold";
            readonly type: "wadray::wadray::Ray";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "suspend_yang";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "unsuspend_yang";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "update_rates";
        readonly inputs: readonly [{
            readonly name: "yangs";
            readonly type: "core::array::Span::<core::starknet::contract_address::ContractAddress>";
        }, {
            readonly name: "new_rates";
            readonly type: "core::array::Span::<wadray::wadray::Ray>";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "advance";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "price";
            readonly type: "wadray::wadray::Wad";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "set_multiplier";
        readonly inputs: readonly [{
            readonly name: "multiplier";
            readonly type: "wadray::wadray::Ray";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "set_minimum_trove_value";
        readonly inputs: readonly [{
            readonly name: "value";
            readonly type: "wadray::wadray::Wad";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "set_debt_ceiling";
        readonly inputs: readonly [{
            readonly name: "ceiling";
            readonly type: "wadray::wadray::Wad";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "adjust_budget";
        readonly inputs: readonly [{
            readonly name: "amount";
            readonly type: "wadray::wadray_signed::SignedWad";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "update_yin_spot_price";
        readonly inputs: readonly [{
            readonly name: "new_price";
            readonly type: "wadray::wadray::Wad";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "kill";
        readonly inputs: readonly [];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "deposit";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "trove_id";
            readonly type: "core::integer::u64";
        }, {
            readonly name: "amount";
            readonly type: "wadray::wadray::Wad";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "withdraw";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "trove_id";
            readonly type: "core::integer::u64";
        }, {
            readonly name: "amount";
            readonly type: "wadray::wadray::Wad";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "forge";
        readonly inputs: readonly [{
            readonly name: "user";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
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
            readonly name: "user";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "trove_id";
            readonly type: "core::integer::u64";
        }, {
            readonly name: "amount";
            readonly type: "wadray::wadray::Wad";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "seize";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "trove_id";
            readonly type: "core::integer::u64";
        }, {
            readonly name: "amount";
            readonly type: "wadray::wadray::Wad";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "redistribute";
        readonly inputs: readonly [{
            readonly name: "trove_id";
            readonly type: "core::integer::u64";
        }, {
            readonly name: "debt_to_redistribute";
            readonly type: "wadray::wadray::Wad";
        }, {
            readonly name: "pct_value_to_redistribute";
            readonly type: "wadray::wadray::Ray";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "inject";
        readonly inputs: readonly [{
            readonly name: "receiver";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "amount";
            readonly type: "wadray::wadray::Wad";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "eject";
        readonly inputs: readonly [{
            readonly name: "burner";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "amount";
            readonly type: "wadray::wadray::Wad";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "get_shrine_health";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "opus::types::Health";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_current_yang_price";
        readonly inputs: readonly [{
            readonly name: "yang";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "(wadray::wadray::Wad, wadray::wadray::Wad, core::integer::u64)";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_current_multiplier";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "(wadray::wadray::Ray, wadray::wadray::Ray, core::integer::u64)";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_forge_fee_pct";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "wadray::wadray::Wad";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "is_healthy";
        readonly inputs: readonly [{
            readonly name: "trove_id";
            readonly type: "core::integer::u64";
        }];
        readonly outputs: readonly [{
            readonly type: "core::bool";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_max_forge";
        readonly inputs: readonly [{
            readonly name: "trove_id";
            readonly type: "core::integer::u64";
        }];
        readonly outputs: readonly [{
            readonly type: "wadray::wadray::Wad";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_trove_health";
        readonly inputs: readonly [{
            readonly name: "trove_id";
            readonly type: "core::integer::u64";
        }];
        readonly outputs: readonly [{
            readonly type: "opus::types::Health";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_redistributions_attributed_to_trove";
        readonly inputs: readonly [{
            readonly name: "trove_id";
            readonly type: "core::integer::u64";
        }];
        readonly outputs: readonly [{
            readonly type: "(core::array::Span::<opus::types::YangBalance>, wadray::wadray::Wad)";
        }];
        readonly state_mutability: "view";
    }];
}, {
    readonly type: "impl";
    readonly name: "IERC20Impl";
    readonly interface_name: "opus::interfaces::IERC20::IERC20";
}, {
    readonly type: "struct";
    readonly name: "core::integer::u256";
    readonly members: readonly [{
        readonly name: "low";
        readonly type: "core::integer::u128";
    }, {
        readonly name: "high";
        readonly type: "core::integer::u128";
    }];
}, {
    readonly type: "interface";
    readonly name: "opus::interfaces::IERC20::IERC20";
    readonly items: readonly [{
        readonly type: "function";
        readonly name: "name";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::felt252";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "symbol";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::felt252";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "decimals";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::integer::u8";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "total_supply";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "balance_of";
        readonly inputs: readonly [{
            readonly name: "account";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "allowance";
        readonly inputs: readonly [{
            readonly name: "owner";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "spender";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "transfer";
        readonly inputs: readonly [{
            readonly name: "recipient";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "amount";
            readonly type: "core::integer::u256";
        }];
        readonly outputs: readonly [{
            readonly type: "core::bool";
        }];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "transfer_from";
        readonly inputs: readonly [{
            readonly name: "sender";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "recipient";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "amount";
            readonly type: "core::integer::u256";
        }];
        readonly outputs: readonly [{
            readonly type: "core::bool";
        }];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "approve";
        readonly inputs: readonly [{
            readonly name: "spender";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "amount";
            readonly type: "core::integer::u256";
        }];
        readonly outputs: readonly [{
            readonly type: "core::bool";
        }];
        readonly state_mutability: "external";
    }];
}, {
    readonly type: "impl";
    readonly name: "IERC20CamelImpl";
    readonly interface_name: "opus::interfaces::IERC20::IERC20CamelOnly";
}, {
    readonly type: "interface";
    readonly name: "opus::interfaces::IERC20::IERC20CamelOnly";
    readonly items: readonly [{
        readonly type: "function";
        readonly name: "totalSupply";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "balanceOf";
        readonly inputs: readonly [{
            readonly name: "account";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "transferFrom";
        readonly inputs: readonly [{
            readonly name: "sender";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "recipient";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "amount";
            readonly type: "core::integer::u256";
        }];
        readonly outputs: readonly [{
            readonly type: "core::bool";
        }];
        readonly state_mutability: "external";
    }];
}, {
    readonly type: "impl";
    readonly name: "ISRC5Impl";
    readonly interface_name: "opus::interfaces::ISRC5::ISRC5";
}, {
    readonly type: "interface";
    readonly name: "opus::interfaces::ISRC5::ISRC5";
    readonly items: readonly [{
        readonly type: "function";
        readonly name: "supports_interface";
        readonly inputs: readonly [{
            readonly name: "interface_id";
            readonly type: "core::felt252";
        }];
        readonly outputs: readonly [{
            readonly type: "core::bool";
        }];
        readonly state_mutability: "view";
    }];
}, {
    readonly type: "impl";
    readonly name: "AccessControlPublic";
    readonly interface_name: "access_control::access_control::IAccessControl";
}, {
    readonly type: "interface";
    readonly name: "access_control::access_control::IAccessControl";
    readonly items: readonly [{
        readonly type: "function";
        readonly name: "get_roles";
        readonly inputs: readonly [{
            readonly name: "account";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u128";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "has_role";
        readonly inputs: readonly [{
            readonly name: "role";
            readonly type: "core::integer::u128";
        }, {
            readonly name: "account";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::bool";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_admin";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_pending_admin";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "grant_role";
        readonly inputs: readonly [{
            readonly name: "role";
            readonly type: "core::integer::u128";
        }, {
            readonly name: "account";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "revoke_role";
        readonly inputs: readonly [{
            readonly name: "role";
            readonly type: "core::integer::u128";
        }, {
            readonly name: "account";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "renounce_role";
        readonly inputs: readonly [{
            readonly name: "role";
            readonly type: "core::integer::u128";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "set_pending_admin";
        readonly inputs: readonly [{
            readonly name: "new_admin";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "accept_admin";
        readonly inputs: readonly [];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }];
}, {
    readonly type: "constructor";
    readonly name: "constructor";
    readonly inputs: readonly [{
        readonly name: "admin";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "name";
        readonly type: "core::felt252";
    }, {
        readonly name: "symbol";
        readonly type: "core::felt252";
    }];
}, {
    readonly type: "event";
    readonly name: "access_control::access_control::access_control_component::AdminChanged";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "old_admin";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "data";
    }, {
        readonly name: "new_admin";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "access_control::access_control::access_control_component::NewPendingAdmin";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "new_admin";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "access_control::access_control::access_control_component::RoleGranted";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "user";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "data";
    }, {
        readonly name: "role_granted";
        readonly type: "core::integer::u128";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "access_control::access_control::access_control_component::RoleRevoked";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "user";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "data";
    }, {
        readonly name: "role_revoked";
        readonly type: "core::integer::u128";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "access_control::access_control::access_control_component::Event";
    readonly kind: "enum";
    readonly variants: readonly [{
        readonly name: "AdminChanged";
        readonly type: "access_control::access_control::access_control_component::AdminChanged";
        readonly kind: "nested";
    }, {
        readonly name: "NewPendingAdmin";
        readonly type: "access_control::access_control::access_control_component::NewPendingAdmin";
        readonly kind: "nested";
    }, {
        readonly name: "RoleGranted";
        readonly type: "access_control::access_control::access_control_component::RoleGranted";
        readonly kind: "nested";
    }, {
        readonly name: "RoleRevoked";
        readonly type: "access_control::access_control::access_control_component::RoleRevoked";
        readonly kind: "nested";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::shrine::shrine::YangAdded";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "yang";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "yang_id";
        readonly type: "core::integer::u32";
        readonly kind: "data";
    }, {
        readonly name: "start_price";
        readonly type: "wadray::wadray::Wad";
        readonly kind: "data";
    }, {
        readonly name: "initial_rate";
        readonly type: "wadray::wadray::Ray";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::shrine::shrine::YangTotalUpdated";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "yang";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "total";
        readonly type: "wadray::wadray::Wad";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::shrine::shrine::TotalTrovesDebtUpdated";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "total";
        readonly type: "wadray::wadray::Wad";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::shrine::shrine::BudgetAdjusted";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "amount";
        readonly type: "wadray::wadray_signed::SignedWad";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::shrine::shrine::MultiplierUpdated";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "multiplier";
        readonly type: "wadray::wadray::Ray";
        readonly kind: "data";
    }, {
        readonly name: "cumulative_multiplier";
        readonly type: "wadray::wadray::Ray";
        readonly kind: "data";
    }, {
        readonly name: "interval";
        readonly type: "core::integer::u64";
        readonly kind: "key";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::shrine::shrine::YangRatesUpdated";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "rate_era";
        readonly type: "core::integer::u64";
        readonly kind: "key";
    }, {
        readonly name: "current_interval";
        readonly type: "core::integer::u64";
        readonly kind: "data";
    }, {
        readonly name: "yangs";
        readonly type: "core::array::Span::<core::starknet::contract_address::ContractAddress>";
        readonly kind: "data";
    }, {
        readonly name: "new_rates";
        readonly type: "core::array::Span::<wadray::wadray::Ray>";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::shrine::shrine::ThresholdUpdated";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "yang";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "threshold";
        readonly type: "wadray::wadray::Ray";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::shrine::shrine::ForgeFeePaid";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "trove_id";
        readonly type: "core::integer::u64";
        readonly kind: "key";
    }, {
        readonly name: "fee";
        readonly type: "wadray::wadray::Wad";
        readonly kind: "data";
    }, {
        readonly name: "fee_pct";
        readonly type: "wadray::wadray::Wad";
        readonly kind: "data";
    }];
}, {
    readonly type: "struct";
    readonly name: "opus::types::Trove";
    readonly members: readonly [{
        readonly name: "charge_from";
        readonly type: "core::integer::u64";
    }, {
        readonly name: "last_rate_era";
        readonly type: "core::integer::u64";
    }, {
        readonly name: "debt";
        readonly type: "wadray::wadray::Wad";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::shrine::shrine::TroveUpdated";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "trove_id";
        readonly type: "core::integer::u64";
        readonly kind: "key";
    }, {
        readonly name: "trove";
        readonly type: "opus::types::Trove";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::shrine::shrine::TroveRedistributed";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "redistribution_id";
        readonly type: "core::integer::u32";
        readonly kind: "key";
    }, {
        readonly name: "trove_id";
        readonly type: "core::integer::u64";
        readonly kind: "key";
    }, {
        readonly name: "debt";
        readonly type: "wadray::wadray::Wad";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::shrine::shrine::DepositUpdated";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "yang";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "trove_id";
        readonly type: "core::integer::u64";
        readonly kind: "key";
    }, {
        readonly name: "amount";
        readonly type: "wadray::wadray::Wad";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::shrine::shrine::YangPriceUpdated";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "yang";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "price";
        readonly type: "wadray::wadray::Wad";
        readonly kind: "data";
    }, {
        readonly name: "cumulative_price";
        readonly type: "wadray::wadray::Wad";
        readonly kind: "data";
    }, {
        readonly name: "interval";
        readonly type: "core::integer::u64";
        readonly kind: "key";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::shrine::shrine::YinPriceUpdated";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "old_price";
        readonly type: "wadray::wadray::Wad";
        readonly kind: "data";
    }, {
        readonly name: "new_price";
        readonly type: "wadray::wadray::Wad";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::shrine::shrine::MinimumTroveValueUpdated";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "value";
        readonly type: "wadray::wadray::Wad";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::shrine::shrine::DebtCeilingUpdated";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "ceiling";
        readonly type: "wadray::wadray::Wad";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::shrine::shrine::YangSuspended";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "yang";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "timestamp";
        readonly type: "core::integer::u64";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::shrine::shrine::YangUnsuspended";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "yang";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "timestamp";
        readonly type: "core::integer::u64";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::shrine::shrine::Killed";
    readonly kind: "struct";
    readonly members: readonly [];
}, {
    readonly type: "event";
    readonly name: "opus::core::shrine::shrine::Transfer";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "from";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "to";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "value";
        readonly type: "core::integer::u256";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::shrine::shrine::Approval";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "owner";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "spender";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "value";
        readonly type: "core::integer::u256";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "opus::core::shrine::shrine::Event";
    readonly kind: "enum";
    readonly variants: readonly [{
        readonly name: "AccessControlEvent";
        readonly type: "access_control::access_control::access_control_component::Event";
        readonly kind: "nested";
    }, {
        readonly name: "YangAdded";
        readonly type: "opus::core::shrine::shrine::YangAdded";
        readonly kind: "nested";
    }, {
        readonly name: "YangTotalUpdated";
        readonly type: "opus::core::shrine::shrine::YangTotalUpdated";
        readonly kind: "nested";
    }, {
        readonly name: "TotalTrovesDebtUpdated";
        readonly type: "opus::core::shrine::shrine::TotalTrovesDebtUpdated";
        readonly kind: "nested";
    }, {
        readonly name: "BudgetAdjusted";
        readonly type: "opus::core::shrine::shrine::BudgetAdjusted";
        readonly kind: "nested";
    }, {
        readonly name: "MultiplierUpdated";
        readonly type: "opus::core::shrine::shrine::MultiplierUpdated";
        readonly kind: "nested";
    }, {
        readonly name: "YangRatesUpdated";
        readonly type: "opus::core::shrine::shrine::YangRatesUpdated";
        readonly kind: "nested";
    }, {
        readonly name: "ThresholdUpdated";
        readonly type: "opus::core::shrine::shrine::ThresholdUpdated";
        readonly kind: "nested";
    }, {
        readonly name: "ForgeFeePaid";
        readonly type: "opus::core::shrine::shrine::ForgeFeePaid";
        readonly kind: "nested";
    }, {
        readonly name: "TroveUpdated";
        readonly type: "opus::core::shrine::shrine::TroveUpdated";
        readonly kind: "nested";
    }, {
        readonly name: "TroveRedistributed";
        readonly type: "opus::core::shrine::shrine::TroveRedistributed";
        readonly kind: "nested";
    }, {
        readonly name: "DepositUpdated";
        readonly type: "opus::core::shrine::shrine::DepositUpdated";
        readonly kind: "nested";
    }, {
        readonly name: "YangPriceUpdated";
        readonly type: "opus::core::shrine::shrine::YangPriceUpdated";
        readonly kind: "nested";
    }, {
        readonly name: "YinPriceUpdated";
        readonly type: "opus::core::shrine::shrine::YinPriceUpdated";
        readonly kind: "nested";
    }, {
        readonly name: "MinimumTroveValueUpdated";
        readonly type: "opus::core::shrine::shrine::MinimumTroveValueUpdated";
        readonly kind: "nested";
    }, {
        readonly name: "DebtCeilingUpdated";
        readonly type: "opus::core::shrine::shrine::DebtCeilingUpdated";
        readonly kind: "nested";
    }, {
        readonly name: "YangSuspended";
        readonly type: "opus::core::shrine::shrine::YangSuspended";
        readonly kind: "nested";
    }, {
        readonly name: "YangUnsuspended";
        readonly type: "opus::core::shrine::shrine::YangUnsuspended";
        readonly kind: "nested";
    }, {
        readonly name: "Killed";
        readonly type: "opus::core::shrine::shrine::Killed";
        readonly kind: "nested";
    }, {
        readonly name: "Transfer";
        readonly type: "opus::core::shrine::shrine::Transfer";
        readonly kind: "nested";
    }, {
        readonly name: "Approval";
        readonly type: "opus::core::shrine::shrine::Approval";
        readonly kind: "nested";
    }];
}]>;
