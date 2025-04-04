#[starknet::interface]
trait ISimpleStorage<TContractState> {
    fn set(ref self: TContractState, str: felt252);
    fn get(self: @TContractState) -> felt252;
}

#[starknet::contract]
mod SimpleStorage {
    use core::starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        stored_str: felt252,
    }

    #[abi(embed_v0)]
    impl SimpleStorage of super::ISimpleStorage<ContractState> {
        fn set(ref self: ContractState, str: felt252) {
            self.stored_str.write(str);
        }

        fn get(self: @ContractState) -> felt252 {
            self.stored_str.read()
        }
    }
}