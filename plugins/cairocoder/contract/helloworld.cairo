use core::starknet::ContractAddress;

#[starknet::interface]
pub trait IHelloKasar<TContractState> {
    fn print(self: @TContractState) -> felt252;
}

#[starknet::contract]
pub mod HelloKasar {
    #[storage]
    struct Storage {}

    #[abi(embed_v0)]
    impl HelloKasarImpl of super::IHelloKasar<ContractState> {
        fn print(self: @ContractState) -> felt252 {
            'Hello, World'
        }
    }
}