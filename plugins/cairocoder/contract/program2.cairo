use starknet::contract_address::ContractAddress;

#[starknet::interface]
trait ICounter<TContractState> {
    fn increment(ref self: TContractState, value: felt252) -> felt252;
    fn get_current_count(self: @TContractState) -> felt252;
}

#[starknet::contract]
mod Counter {
    use starknet::contract_address::ContractAddress;

    #[storage]
    struct Storage {
        count: felt252,
    }

    #[abi(embed_v0)]
    impl CounterImpl of super::ICounter<ContractState> {
        fn increment(ref self: ContractState, value: felt252) -> felt252 {
            self.count.write(self.count.read() + value);
            self.count.read()
        }

        fn get_current_count(self: @ContractState) -> felt252 {
            self.count.read()
        }
    }
}