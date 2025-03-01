export declare const erc20Abi: readonly [{
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
}];
