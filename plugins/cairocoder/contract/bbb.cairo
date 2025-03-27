use core::starknet::ContractAddress;

#[starknet::interface]
pub trait IERC20<TContractState> {
    fn name(self: @TContractState) -> felt252;
    fn symbol(self: @TContractState) -> felt252;
    fn decimals(self: @TContractState) -> u8;
    fn totalSupply(self: @TContractState) -> u256;
    fn balanceOf(self: @TContractState, account: ContractAddress) -> u256;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
    fn transferFrom(ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
}

#[starknet::contract]
pub mod ERC20 {
    use super::IERC20;
    use core::starknet::ContractAddress;
    use core::starknet::get_caller_address;
    use core::contract_address::ContractAddressTrait;
    use core::integer::u256;
    use core::integer::u256_from_felt252;
    use core::option::OptionTrait;
    use starknet::storage::{Map, StoragePathEntry};

    #[storage]
    pub struct Storage {
        name: felt252,
        symbol: felt252,
        decimals: u8,
        totalSupply: u256,
        balances: Map<ContractAddress, u256>,
        allowances: Map<(ContractAddress, ContractAddress), u256>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Transfer: Transfer,
        Approval: Approval,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Transfer {
        from: ContractAddress,
        to: ContractAddress,
        value: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Approval {
        owner: ContractAddress,
        spender: ContractAddress,
        value: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: felt252,
        symbol: felt252,
        decimals: u8,
        initialSupply: u256,
        recipient: ContractAddress
    ) {
        self.name.write(name);
        self.symbol.write(symbol);
        self.decimals.write(decimals);
        self.totalSupply.write(initialSupply);
        self.balances.entry(recipient).write(initialSupply);
        self.emit(Event::Transfer(Transfer { from: ContractAddress::default(), to: recipient, value: initialSupply }));
    }

    #[abi(embed_v0)]
    impl ERC20Impl of IERC20<ContractState> {
        fn name(self: @ContractState) -> felt252 {
            self.name.read()
        }

        fn symbol(self: @ContractState) -> felt252 {
            self.symbol.read()
        }

        fn decimals(self: @ContractState) -> u8 {
            self.decimals.read()
        }

        fn totalSupply(self: @ContractState) -> u256 {
            self.totalSupply.read()
        }

        fn balanceOf(self: @ContractState, account: ContractAddress) -> u256 {
             self.balances.entry(account).read()
        }

        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            let sender = get_caller_address();
            self._transfer(sender, recipient, amount);
            true
        }

        fn allowance(self: @ContractState, owner: ContractAddress, spender: ContractAddress) -> u256 {
            self.allowances.entry((owner, spender)).read()
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let owner = get_caller_address();
            self._approve(owner, spender, amount);
            true
        }

        fn transferFrom(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256
        ) -> bool {
            let spender = get_caller_address();
            let allowed = self.allowance(@self, sender, spender);
            assert(allowed >= amount, 'ERC20: insufficient allowance');

            self._approve(sender, spender, allowed - amount);
            self._transfer(sender, recipient, amount);
            true
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _transfer(ref self: ContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256) {
            let sender_balance = self.balanceOf(@self, sender);
            assert(sender_balance >= amount, 'ERC20: insufficient balance');
            self.balances.entry(sender).write(sender_balance - amount);
            let recipient_balance = self.balanceOf(@self, recipient);
            self.balances.entry(recipient).write(recipient_balance + amount);
            self.emit(Event::Transfer(Transfer { from: sender, to: recipient, value: amount }));
        }

        fn _approve(ref self: ContractState, owner: ContractAddress, spender: ContractAddress, amount: u256) {
            self.allowances.entry((owner, spender)).write(amount);
            self.emit(Event::Approval(Approval { owner: owner, spender: spender, value: amount }));
        }
    }
}