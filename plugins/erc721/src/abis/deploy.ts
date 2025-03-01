export const DEPLOY_ERC721_ABI_SEPOLIA = [
  {
    name: 'ERC721MixinImpl',
    type: 'impl',
    interface_name: 'openzeppelin_token::erc721::interface::ERC721ABI',
  },
  {
    name: 'core::integer::u256',
    type: 'struct',
    members: [
      {
        name: 'low',
        type: 'core::integer::u128',
      },
      {
        name: 'high',
        type: 'core::integer::u128',
      },
    ],
  },
  {
    name: 'core::array::Span::<core::felt252>',
    type: 'struct',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<core::felt252>',
      },
    ],
  },
  {
    name: 'core::bool',
    type: 'enum',
    variants: [
      {
        name: 'False',
        type: '()',
      },
      {
        name: 'True',
        type: '()',
      },
    ],
  },
  {
    name: 'core::byte_array::ByteArray',
    type: 'struct',
    members: [
      {
        name: 'data',
        type: 'core::array::Array::<core::bytes_31::bytes31>',
      },
      {
        name: 'pending_word',
        type: 'core::felt252',
      },
      {
        name: 'pending_word_len',
        type: 'core::integer::u32',
      },
    ],
  },
  {
    name: 'openzeppelin_token::erc721::interface::ERC721ABI',
    type: 'interface',
    items: [
      {
        name: 'balance_of',
        type: 'function',
        inputs: [
          {
            name: 'account',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'owner_of',
        type: 'function',
        inputs: [
          {
            name: 'token_id',
            type: 'core::integer::u256',
          },
        ],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'safe_transfer_from',
        type: 'function',
        inputs: [
          {
            name: 'from',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'to',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'token_id',
            type: 'core::integer::u256',
          },
          {
            name: 'data',
            type: 'core::array::Span::<core::felt252>',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        name: 'transfer_from',
        type: 'function',
        inputs: [
          {
            name: 'from',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'to',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'token_id',
            type: 'core::integer::u256',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        name: 'approve',
        type: 'function',
        inputs: [
          {
            name: 'to',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'token_id',
            type: 'core::integer::u256',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        name: 'set_approval_for_all',
        type: 'function',
        inputs: [
          {
            name: 'operator',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'approved',
            type: 'core::bool',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        name: 'get_approved',
        type: 'function',
        inputs: [
          {
            name: 'token_id',
            type: 'core::integer::u256',
          },
        ],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'is_approved_for_all',
        type: 'function',
        inputs: [
          {
            name: 'owner',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'operator',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'core::bool',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'supports_interface',
        type: 'function',
        inputs: [
          {
            name: 'interface_id',
            type: 'core::felt252',
          },
        ],
        outputs: [
          {
            type: 'core::bool',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'name',
        type: 'function',
        inputs: [],
        outputs: [
          {
            type: 'core::byte_array::ByteArray',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'symbol',
        type: 'function',
        inputs: [],
        outputs: [
          {
            type: 'core::byte_array::ByteArray',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'token_uri',
        type: 'function',
        inputs: [
          {
            name: 'token_id',
            type: 'core::integer::u256',
          },
        ],
        outputs: [
          {
            type: 'core::byte_array::ByteArray',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'balanceOf',
        type: 'function',
        inputs: [
          {
            name: 'account',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'ownerOf',
        type: 'function',
        inputs: [
          {
            name: 'tokenId',
            type: 'core::integer::u256',
          },
        ],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'safeTransferFrom',
        type: 'function',
        inputs: [
          {
            name: 'from',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'to',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'tokenId',
            type: 'core::integer::u256',
          },
          {
            name: 'data',
            type: 'core::array::Span::<core::felt252>',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        name: 'transferFrom',
        type: 'function',
        inputs: [
          {
            name: 'from',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'to',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'tokenId',
            type: 'core::integer::u256',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        name: 'setApprovalForAll',
        type: 'function',
        inputs: [
          {
            name: 'operator',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'approved',
            type: 'core::bool',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        name: 'getApproved',
        type: 'function',
        inputs: [
          {
            name: 'tokenId',
            type: 'core::integer::u256',
          },
        ],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'isApprovedForAll',
        type: 'function',
        inputs: [
          {
            name: 'owner',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'operator',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'core::bool',
          },
        ],
        state_mutability: 'view',
      },
      {
        name: 'tokenURI',
        type: 'function',
        inputs: [
          {
            name: 'tokenId',
            type: 'core::integer::u256',
          },
        ],
        outputs: [
          {
            type: 'core::byte_array::ByteArray',
          },
        ],
        state_mutability: 'view',
      },
    ],
  },
  {
    name: 'constructor',
    type: 'constructor',
    inputs: [
      {
        name: 'name',
        type: 'core::byte_array::ByteArray',
      },
      {
        name: 'symbol',
        type: 'core::byte_array::ByteArray',
      },
      {
        name: 'base_uri',
        type: 'core::byte_array::ByteArray',
      },
      {
        name: 'total_supply',
        type: 'core::integer::u256',
      },
      {
        name: 'recipient',
        type: 'core::starknet::contract_address::ContractAddress',
      },
    ],
  },
  {
    kind: 'struct',
    name: 'openzeppelin_token::erc721::erc721::ERC721Component::Transfer',
    type: 'event',
    members: [
      {
        kind: 'key',
        name: 'from',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        kind: 'key',
        name: 'to',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        kind: 'key',
        name: 'token_id',
        type: 'core::integer::u256',
      },
    ],
  },
  {
    kind: 'struct',
    name: 'openzeppelin_token::erc721::erc721::ERC721Component::Approval',
    type: 'event',
    members: [
      {
        kind: 'key',
        name: 'owner',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        kind: 'key',
        name: 'approved',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        kind: 'key',
        name: 'token_id',
        type: 'core::integer::u256',
      },
    ],
  },
  {
    kind: 'struct',
    name: 'openzeppelin_token::erc721::erc721::ERC721Component::ApprovalForAll',
    type: 'event',
    members: [
      {
        kind: 'key',
        name: 'owner',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        kind: 'key',
        name: 'operator',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        kind: 'data',
        name: 'approved',
        type: 'core::bool',
      },
    ],
  },
  {
    kind: 'enum',
    name: 'openzeppelin_token::erc721::erc721::ERC721Component::Event',
    type: 'event',
    variants: [
      {
        kind: 'nested',
        name: 'Transfer',
        type: 'openzeppelin_token::erc721::erc721::ERC721Component::Transfer',
      },
      {
        kind: 'nested',
        name: 'Approval',
        type: 'openzeppelin_token::erc721::erc721::ERC721Component::Approval',
      },
      {
        kind: 'nested',
        name: 'ApprovalForAll',
        type: 'openzeppelin_token::erc721::erc721::ERC721Component::ApprovalForAll',
      },
    ],
  },
  {
    kind: 'enum',
    name: 'openzeppelin_introspection::src5::SRC5Component::Event',
    type: 'event',
    variants: [],
  },
  {
    kind: 'enum',
    name: 'token::erc721::ERC721Token::Event',
    type: 'event',
    variants: [
      {
        kind: 'flat',
        name: 'ERC721Event',
        type: 'openzeppelin_token::erc721::erc721::ERC721Component::Event',
      },
      {
        kind: 'flat',
        name: 'SRC5Event',
        type: 'openzeppelin_introspection::src5::SRC5Component::Event',
      },
    ],
  },
];

export const DEPLOY_ERC721_ABI_MAINNET = [{"type":"impl","name":"TokenURIImpl","interface_name":"test::erc721::ERC721::ITokenURI"},{"type":"struct","name":"core::integer::u256","members":[{"name":"low","type":"core::integer::u128"},{"name":"high","type":"core::integer::u128"}]},{"type":"interface","name":"test::erc721::ERC721::ITokenURI","items":[{"type":"function","name":"token_uri","inputs":[{"name":"token_id","type":"core::integer::u256"}],"outputs":[{"type":"core::felt252"}],"state_mutability":"view"}]},{"type":"impl","name":"ERC721Impl","interface_name":"openzeppelin::token::erc721::interface::IERC721"},{"type":"struct","name":"core::array::Span::<core::felt252>","members":[{"name":"snapshot","type":"@core::array::Array::<core::felt252>"}]},{"type":"enum","name":"core::bool","variants":[{"name":"False","type":"()"},{"name":"True","type":"()"}]},{"type":"interface","name":"openzeppelin::token::erc721::interface::IERC721","items":[{"type":"function","name":"balance_of","inputs":[{"name":"account","type":"core::starknet::contract_address::ContractAddress"}],"outputs":[{"type":"core::integer::u256"}],"state_mutability":"view"},{"type":"function","name":"owner_of","inputs":[{"name":"token_id","type":"core::integer::u256"}],"outputs":[{"type":"core::starknet::contract_address::ContractAddress"}],"state_mutability":"view"},{"type":"function","name":"safe_transfer_from","inputs":[{"name":"from","type":"core::starknet::contract_address::ContractAddress"},{"name":"to","type":"core::starknet::contract_address::ContractAddress"},{"name":"token_id","type":"core::integer::u256"},{"name":"data","type":"core::array::Span::<core::felt252>"}],"outputs":[],"state_mutability":"external"},{"type":"function","name":"transfer_from","inputs":[{"name":"from","type":"core::starknet::contract_address::ContractAddress"},{"name":"to","type":"core::starknet::contract_address::ContractAddress"},{"name":"token_id","type":"core::integer::u256"}],"outputs":[],"state_mutability":"external"},{"type":"function","name":"approve","inputs":[{"name":"to","type":"core::starknet::contract_address::ContractAddress"},{"name":"token_id","type":"core::integer::u256"}],"outputs":[],"state_mutability":"external"},{"type":"function","name":"set_approval_for_all","inputs":[{"name":"operator","type":"core::starknet::contract_address::ContractAddress"},{"name":"approved","type":"core::bool"}],"outputs":[],"state_mutability":"external"},{"type":"function","name":"get_approved","inputs":[{"name":"token_id","type":"core::integer::u256"}],"outputs":[{"type":"core::starknet::contract_address::ContractAddress"}],"state_mutability":"view"},{"type":"function","name":"is_approved_for_all","inputs":[{"name":"owner","type":"core::starknet::contract_address::ContractAddress"},{"name":"operator","type":"core::starknet::contract_address::ContractAddress"}],"outputs":[{"type":"core::bool"}],"state_mutability":"view"}]},{"type":"constructor","name":"constructor","inputs":[{"name":"name","type":"core::felt252"},{"name":"symbol","type":"core::felt252"},{"name":"base_uri","type":"core::felt252"},{"name":"total_supply","type":"core::integer::u256"},{"name":"recipient","type":"core::starknet::contract_address::ContractAddress"}]},{"type":"event","name":"openzeppelin::token::erc721::erc721::ERC721Component::Transfer","kind":"struct","members":[{"name":"from","type":"core::starknet::contract_address::ContractAddress","kind":"key"},{"name":"to","type":"core::starknet::contract_address::ContractAddress","kind":"key"},{"name":"token_id","type":"core::integer::u256","kind":"key"}]},{"type":"event","name":"openzeppelin::token::erc721::erc721::ERC721Component::Approval","kind":"struct","members":[{"name":"owner","type":"core::starknet::contract_address::ContractAddress","kind":"key"},{"name":"approved","type":"core::starknet::contract_address::ContractAddress","kind":"key"},{"name":"token_id","type":"core::integer::u256","kind":"key"}]},{"type":"event","name":"openzeppelin::token::erc721::erc721::ERC721Component::ApprovalForAll","kind":"struct","members":[{"name":"owner","type":"core::starknet::contract_address::ContractAddress","kind":"key"},{"name":"operator","type":"core::starknet::contract_address::ContractAddress","kind":"key"},{"name":"approved","type":"core::bool","kind":"data"}]},{"type":"event","name":"openzeppelin::token::erc721::erc721::ERC721Component::Event","kind":"enum","variants":[{"name":"Transfer","type":"openzeppelin::token::erc721::erc721::ERC721Component::Transfer","kind":"nested"},{"name":"Approval","type":"openzeppelin::token::erc721::erc721::ERC721Component::Approval","kind":"nested"},{"name":"ApprovalForAll","type":"openzeppelin::token::erc721::erc721::ERC721Component::ApprovalForAll","kind":"nested"}]},{"type":"event","name":"openzeppelin::introspection::src5::SRC5Component::Event","kind":"enum","variants":[]},{"type":"event","name":"test::erc721::ERC721::Event","kind":"enum","variants":[{"name":"ERC721Event","type":"openzeppelin::token::erc721::erc721::ERC721Component::Event","kind":"flat"},{"name":"SRC5Event","type":"openzeppelin::introspection::src5::SRC5Component::Event","kind":"flat"}]}];