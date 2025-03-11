#[starknet::contract]
mod Test {
    use openzeppelin::token::erc20::ERC20Component;
    use starknet::ContractAddress;
    use core::integer::u8;
    use core::byte_array::ByteArray;
    
    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    
    // Ajout de variables de stockage dédiées pour les métadonnées
    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        token_name: ByteArray,
        token_symbol: ByteArray
    }
    
    // ERC20 Mixin
    #[abi(embed_v0)]
    impl ERC20MixinImpl = ERC20Component::ERC20Impl<ContractState>;
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;
    
    // Interface pour les métadonnées
    #[starknet::interface]
    trait IERC20Metadata<TState> {
        fn name(self: @TState) -> ByteArray;
        fn symbol(self: @TState) -> ByteArray;
        fn decimals(self: @TState) -> u8;
    }
    
    // Implémentation des métadonnées
    #[abi(embed_v0)]
    impl ERC20MetadataImpl of IERC20Metadata<ContractState> {
        fn name(self: @ContractState) -> ByteArray {
            self.token_name.read()
        }
        
        fn symbol(self: @ContractState) -> ByteArray {
            self.token_symbol.read()
        }
        
        fn decimals(self: @ContractState) -> u8 {
            18 // Valeur standard pour la plupart des tokens ERC20
        }
    }
    
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event
    }
    
    #[constructor]
    fn constructor(
        ref self: ContractState,
        recipient: ContractAddress
    ) {
        self.erc20.initializer("test2", "TST2");

        self.token_name.write("test2");
        self.token_symbol.write("TST2");
        
        self.erc20._mint(recipient, 1234000000000000);
    }
}