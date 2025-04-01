use core::starknet::ContractAddress;

#[starknet::interface]
trait IHelloWorld<TContractState> {
    fn print_hello(self: @TContractState);
}

#[starknet::contract]
mod HelloWorld {
    use core::starknet::get_caller_address;

    #[storage]
    struct Storage {}

    #[abi(embed_v0)]
    impl HelloWorldImpl of super::IHelloWorld<ContractState> {
        fn print_hello(self: @ContractState) {
            let caller = get_caller_address();
            println!("Hello, World! from contract {}", caller);
        }
    }
}