use starknet::ContractAddress;

// Define the ERC20 contract interface
#[starknet::interface]
trait IERC20<TContractState> {
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
}

// Define the contract module
#[starknet::contract]
mod ERC20 {
    use super::IERC20;
    use starknet::ContractAddress;
    use starknet::get_caller_address;

    #[storage]
    struct Storage {
        balances: Map<ContractAddress, u256>,
        total_supply: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Transfer: Transfer,
    }

    #[derive(Drop, starknet::Event)]
    struct Transfer {
        from: ContractAddress,
        to: ContractAddress,
        amount: u256,
    }

    #[abi(embed_v0)]
    impl ERC20Impl of IERC20<ContractState> {
        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            // Get the sender's address
            let sender = get_caller_address();

            // Check that the recipient is not the zero address
            assert(recipient != ContractAddress::default(), 'Recipient address cannot be zero');

            // Get the sender's balance
            let sender_balance = self.balances.get(sender);

            // Check that the sender has sufficient balance
            assert(sender_balance >= amount, 'Insufficient balance');

            // Update the sender's balance
            self.balances.insert(sender, sender_balance - amount);

            // Update the recipient's balance
            let recipient_balance = self.balances.get(recipient);
            self.balances.insert(recipient, recipient_balance + amount);

            // Emit a Transfer event
            self.emit(Event::Transfer(Transfer { from: sender, to: recipient, amount }));

            true
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.get(account)
        }
    }
}