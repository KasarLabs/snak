#[contract]
mod Fibonacci {
    #[storage]
    struct Storage {}

    #[abi(embed_v0)]
    impl FibonacciImpl of ContractInterface {
        fn fibonacci(self: @ContractState, n: u32) -> u32 {
            if n <= 1 {
                return n;
            }

            return self.fibonacci(n - 1) + self.fibonacci(n - 2);
        }

        #[external(v0)]
        fn main(self: @ContractState) -> felt252 {
            let result: u32 = self.fibonacci(5);
            result.into()
        }
    }

    trait ContractInterface {
        fn fibonacci(self: @ContractState, n: u32) -> u32;
        fn main(self: @ContractState) -> felt252;
    }
}