export declare const vTokenAbi: readonly [{
    readonly name: "VToken";
    readonly type: "impl";
    readonly interface_name: "vesu::v_token::IVToken";
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
    readonly name: "vesu::v_token::IVToken";
    readonly type: "interface";
    readonly items: readonly [{
        readonly name: "extension";
        readonly type: "function";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "approve_extension";
        readonly type: "function";
        readonly inputs: readonly [];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly name: "mint_v_token";
        readonly type: "function";
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
        readonly name: "burn_v_token";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "from";
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
    readonly name: "IERC4626";
    readonly type: "impl";
    readonly interface_name: "vesu::v_token::IERC4626";
}, {
    readonly name: "vesu::v_token::IERC4626";
    readonly type: "interface";
    readonly items: readonly [{
        readonly name: "asset";
        readonly type: "function";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "total_assets";
        readonly type: "function";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "convert_to_shares";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "assets";
            readonly type: "core::integer::u256";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "convert_to_assets";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "shares";
            readonly type: "core::integer::u256";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "max_deposit";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "receiver";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "preview_deposit";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "assets";
            readonly type: "core::integer::u256";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "deposit";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "assets";
            readonly type: "core::integer::u256";
        }, {
            readonly name: "receiver";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "max_mint";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "receiver";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "preview_mint";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "shares";
            readonly type: "core::integer::u256";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "mint";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "shares";
            readonly type: "core::integer::u256";
        }, {
            readonly name: "receiver";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "max_withdraw";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "owner";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "preview_withdraw";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "assets";
            readonly type: "core::integer::u256";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "withdraw";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "assets";
            readonly type: "core::integer::u256";
        }, {
            readonly name: "receiver";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "owner";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "external";
    }, {
        readonly name: "max_redeem";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "owner";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "preview_redeem";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "shares";
            readonly type: "core::integer::u256";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "redeem";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "shares";
            readonly type: "core::integer::u256";
        }, {
            readonly name: "receiver";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "owner";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "external";
    }];
}, {
    readonly name: "ERC20Impl";
    readonly type: "impl";
    readonly interface_name: "vesu::vendor::erc20::IERC20";
}, {
    readonly name: "vesu::vendor::erc20::IERC20";
    readonly type: "interface";
    readonly items: readonly [{
        readonly name: "total_supply";
        readonly type: "function";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "balance_of";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "account";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "allowance";
        readonly type: "function";
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
        readonly name: "transfer";
        readonly type: "function";
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
        readonly name: "transfer_from";
        readonly type: "function";
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
        readonly name: "approve";
        readonly type: "function";
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
    readonly name: "ERC20MetadataImpl";
    readonly type: "impl";
    readonly interface_name: "vesu::vendor::erc20::IERC20Metadata";
}, {
    readonly name: "vesu::vendor::erc20::IERC20Metadata";
    readonly type: "interface";
    readonly items: readonly [{
        readonly name: "name";
        readonly type: "function";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::felt252";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "symbol";
        readonly type: "function";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::felt252";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "decimals";
        readonly type: "function";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::integer::u8";
        }];
        readonly state_mutability: "view";
    }];
}, {
    readonly name: "ERC20CamelOnlyImpl";
    readonly type: "impl";
    readonly interface_name: "vesu::vendor::erc20::IERC20CamelOnly";
}, {
    readonly name: "vesu::vendor::erc20::IERC20CamelOnly";
    readonly type: "interface";
    readonly items: readonly [{
        readonly name: "totalSupply";
        readonly type: "function";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "balanceOf";
        readonly type: "function";
        readonly inputs: readonly [{
            readonly name: "account";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u256";
        }];
        readonly state_mutability: "view";
    }, {
        readonly name: "transferFrom";
        readonly type: "function";
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
    readonly name: "constructor";
    readonly type: "constructor";
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
        readonly name: "pool_id";
        readonly type: "core::felt252";
    }, {
        readonly name: "extension";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "asset";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::vendor::erc20_component::ERC20Component::Transfer";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "key";
        readonly name: "from";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "to";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "data";
        readonly name: "value";
        readonly type: "core::integer::u256";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::vendor::erc20_component::ERC20Component::Approval";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "key";
        readonly name: "owner";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "spender";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "data";
        readonly name: "value";
        readonly type: "core::integer::u256";
    }];
}, {
    readonly kind: "enum";
    readonly name: "vesu::vendor::erc20_component::ERC20Component::Event";
    readonly type: "event";
    readonly variants: readonly [{
        readonly kind: "nested";
        readonly name: "Transfer";
        readonly type: "vesu::vendor::erc20_component::ERC20Component::Transfer";
    }, {
        readonly kind: "nested";
        readonly name: "Approval";
        readonly type: "vesu::vendor::erc20_component::ERC20Component::Approval";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::v_token::VToken::Deposit";
    readonly type: "event";
    readonly members: readonly [{
        readonly kind: "key";
        readonly name: "sender";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "key";
        readonly name: "owner";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "data";
        readonly name: "assets";
        readonly type: "core::integer::u256";
    }, {
        readonly kind: "data";
        readonly name: "shares";
        readonly type: "core::integer::u256";
    }];
}, {
    readonly kind: "struct";
    readonly name: "vesu::v_token::VToken::Withdraw";
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
        readonly name: "owner";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly kind: "data";
        readonly name: "assets";
        readonly type: "core::integer::u256";
    }, {
        readonly kind: "data";
        readonly name: "shares";
        readonly type: "core::integer::u256";
    }];
}, {
    readonly kind: "enum";
    readonly name: "vesu::v_token::VToken::Event";
    readonly type: "event";
    readonly variants: readonly [{
        readonly kind: "flat";
        readonly name: "ERC20Event";
        readonly type: "vesu::vendor::erc20_component::ERC20Component::Event";
    }, {
        readonly kind: "nested";
        readonly name: "Deposit";
        readonly type: "vesu::v_token::VToken::Deposit";
    }, {
        readonly kind: "nested";
        readonly name: "Withdraw";
        readonly type: "vesu::v_token::VToken::Withdraw";
    }];
}];
