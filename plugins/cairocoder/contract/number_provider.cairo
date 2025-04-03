#[starknet::interface]
pub trait IConstantNumber<TContractState> {
    fn get_number(self: @TContractState) -> u32;
}

#[starknet::contract]
pub mod ConstantNumber {
    // Import necessary Starknet dependencies
    use core::starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {}

    const THE_NUMBER: u32 = 42;

    #[abi(embed_v0)]
    impl ConstantNumberImpl of super::IConstantNumber<ContractState> {
        fn get_number(self: @ContractState) -> u32 {
            THE_NUMBER
        }
    }
}