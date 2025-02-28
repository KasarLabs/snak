export declare const sentinelAbi: readonly [{
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
}];
