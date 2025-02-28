export declare const ERC20_ABI: readonly [{
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
}];
