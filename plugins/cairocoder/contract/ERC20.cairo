use starknet::ContractAddress;

// Define the contract interface
#[starknet::interface]
trait IERC20<TContractState> {
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256);
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256);
    fn transfer_from(
        ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256
    );
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
}

#[starknet::contract]
mod ERC20 {
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use core::starknet::storage::{LegacyMap};
    use starknet::storage::StoragePointer;

    // Define storage variables
    #[storage]
    struct Storage {
        name: felt252,
        symbol: felt252,
        total_supply: u256,
        balances: LegacyMap<ContractAddress, u256>,
        allowances: LegacyMap<(ContractAddress, ContractAddress), u256>,
    }

    // Define events
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Transfer: Transfer,
        Approval: Approval,
    }

    #[derive(Drop, starknet::Event)]
    struct Transfer {
        from: ContractAddress,
        to: ContractAddress,
        value: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Approval {
        owner: ContractAddress,
        spender: ContractAddress,
        value: u256,
    }

    // Implement the contract interface
    #[abi(embed_v0)]
    impl ERC20Impl of super::IERC20<ContractState> {
        // Constructor
        fn constructor(ref self: ContractState, name: felt252, symbol: felt252, initial_supply: u256) {
            self.name.write(name);
            self.symbol.write(symbol);
            self.total_supply.write(initial_supply);
            let caller = get_caller_address();
            self.balances.write(caller, initial_supply);
            self.emit(Event::Transfer(Transfer { from: ContractAddress::default(), to: caller, value: initial_supply }));
        }

        // Transfer tokens from the caller to the recipient
        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            let sender = get_caller_address();
            assert(self.balances.read(sender) >= amount, 'ERC20: insufficient balance');
            self.balances.write(sender, self.balances.read(sender) - amount);
            self.balances.write(recipient, self.balances.read(recipient) + amount);
            self.emit(Event::Transfer(Transfer { from: sender, to: recipient, value: amount }));
        }

        // Approve a spender to spend tokens on behalf of the caller
        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) {
            let owner = get_caller_address();
            self.allowances.write((owner, spender), amount);
            self.emit(Event::Approval(Approval { owner: owner, spender: spender, value: amount }));
        }

        // Transfer tokens from a sender to a recipient, using the allowance mechanism
        fn transfer_from(
            ref self: ContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256
        ) {
            let spender = get_caller_address();
            let allowance = self.allowances.read((sender, spender));
            assert(allowance >= amount, 'ERC20: insufficient allowance');
            assert(self.balances.read(sender) >= amount, 'ERC20: insufficient balance');
            self.allowances.write((sender, spender), allowance - amount);
            self.balances.write(sender, self.balances.read(sender) - amount);
            self.balances.write(recipient, self.balances.read(recipient) + amount);
            self.emit(Event::Transfer(Transfer { from: sender, to: recipient, value: amount }));
        }

        // Get the balance of an account
        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.read(account)
        }

        // Get the allowance of a spender for an owner
        fn allowance(self: @ContractState, owner: ContractAddress, spender: ContractAddress) -> u256 {
            self.allowances.read((owner, spender))
        }
    }
}