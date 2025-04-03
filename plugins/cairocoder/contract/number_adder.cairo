use core::starknet::ContractAddress;
use starknet::contract_address_const;

// number_provider contract interface
#[starknet::interface]
trait INumberProvider<TContractState> {
    fn get_number(self: @TContractState) -> u32;
}

// number_consumer contract interface
#[starknet::interface]
trait INumberConsumer<TContractState> {
    fn get_number_plus_five(self: @TContractState) -> u32;
}

#[starknet::contract]
mod NumberConsumer {
    // use the dispatcher trait
    use super::INumberProviderDispatcherTrait;
    use core::starknet::ContractAddress;
    // imports for storage read and write access
    use core::starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        number_provider_address: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, number_provider_address: ContractAddress) {
        self.number_provider_address.write(number_provider_address);
    }

    #[abi(embed_v0)]
    impl NumberConsumerImpl of super::INumberConsumer<ContractState> {
        fn get_number_plus_five(self: @ContractState) -> u32 {
            // Calls the get_number() function from the number_provider contract
            let number = super::INumberProviderDispatcher {
                contract_address: self.number_provider_address.read()
            }.get_number();

            // Adds 5 to the returned value
            let result = number + 5;

            // Returns the result
            result
        }
    }
}