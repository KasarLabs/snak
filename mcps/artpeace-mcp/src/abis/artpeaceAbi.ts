export const artpeaceAbi = [
  {
    type: 'impl',
    name: 'MultiCanvasImpl',
    interface_name: 'art_peace::multi_canvas::IMultiCanvas',
  },
  {
    type: 'struct',
    name: 'art_peace::multi_canvas::MultiCanvas::CanvasMetadata',
    members: [
      {
        name: 'name',
        type: 'core::felt252',
      },
      {
        name: 'unique_name',
        type: 'core::felt252',
      },
      {
        name: 'width',
        type: 'core::integer::u128',
      },
      {
        name: 'height',
        type: 'core::integer::u128',
      },
      {
        name: 'start_time',
        type: 'core::integer::u64',
      },
      {
        name: 'end_time',
        type: 'core::integer::u64',
      },
    ],
  },
  {
    type: 'struct',
    name: 'core::array::Span::<core::integer::u32>',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<core::integer::u32>',
      },
    ],
  },
  {
    type: 'struct',
    name: 'art_peace::multi_canvas::MultiCanvas::CanvasInitParams',
    members: [
      {
        name: 'host',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'name',
        type: 'core::felt252',
      },
      {
        name: 'unique_name',
        type: 'core::felt252',
      },
      {
        name: 'width',
        type: 'core::integer::u128',
      },
      {
        name: 'height',
        type: 'core::integer::u128',
      },
      {
        name: 'time_between_pixels',
        type: 'core::integer::u64',
      },
      {
        name: 'color_palette',
        type: 'core::array::Span::<core::integer::u32>',
      },
      {
        name: 'start_time',
        type: 'core::integer::u64',
      },
      {
        name: 'end_time',
        type: 'core::integer::u64',
      },
    ],
  },
  {
    type: 'struct',
    name: 'art_peace::multi_canvas::MultiCanvas::StencilMetadata',
    members: [
      {
        name: 'hash',
        type: 'core::felt252',
      },
      {
        name: 'width',
        type: 'core::integer::u128',
      },
      {
        name: 'height',
        type: 'core::integer::u128',
      },
      {
        name: 'position',
        type: 'core::integer::u128',
      },
    ],
  },
  {
    type: 'interface',
    name: 'art_peace::multi_canvas::IMultiCanvas',
    items: [
      {
        type: 'function',
        name: 'get_game_master',
        inputs: [],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'set_game_master',
        inputs: [
          {
            name: 'game_master',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'get_canvas_count',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u32',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_canvas',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
        ],
        outputs: [
          {
            type: 'art_peace::multi_canvas::MultiCanvas::CanvasMetadata',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'create_canvas',
        inputs: [
          {
            name: 'init_params',
            type: 'art_peace::multi_canvas::MultiCanvas::CanvasInitParams',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u32',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'get_host',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
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
        type: 'function',
        name: 'set_host',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
          {
            name: 'host',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'get_name',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
        ],
        outputs: [
          {
            type: 'core::felt252',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_width',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u128',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_height',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u128',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_last_placed_time',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
          {
            name: 'user',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u64',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_time_between_pixels',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u64',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'set_time_between_pixels',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
          {
            name: 'time_between_pixels',
            type: 'core::integer::u64',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'enable_awards',
        inputs: [],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'disable_awards',
        inputs: [],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'award_user',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
          {
            name: 'user',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'amount',
            type: 'core::integer::u32',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'get_color_count',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u8',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_colors',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
        ],
        outputs: [
          {
            type: 'core::array::Span::<core::integer::u32>',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_start_time',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u64',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_end_time',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u64',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'check_game_running',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
        ],
        outputs: [],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'check_valid_pixel',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
          {
            name: 'pos',
            type: 'core::integer::u128',
          },
          {
            name: 'color',
            type: 'core::integer::u8',
          },
        ],
        outputs: [],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'check_timing',
        inputs: [
          {
            name: 'now',
            type: 'core::integer::u64',
          },
        ],
        outputs: [],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'place_pixel',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
          {
            name: 'pos',
            type: 'core::integer::u128',
          },
          {
            name: 'color',
            type: 'core::integer::u8',
          },
          {
            name: 'now',
            type: 'core::integer::u64',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'place_pixel_xy',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
          {
            name: 'x',
            type: 'core::integer::u128',
          },
          {
            name: 'y',
            type: 'core::integer::u128',
          },
          {
            name: 'color',
            type: 'core::integer::u8',
          },
          {
            name: 'now',
            type: 'core::integer::u64',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'favorite_canvas',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'unfavorite_canvas',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'get_stencil_count',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u32',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_stencil',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
          {
            name: 'stencil_id',
            type: 'core::integer::u32',
          },
        ],
        outputs: [
          {
            type: 'art_peace::multi_canvas::MultiCanvas::StencilMetadata',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'add_stencil',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
          {
            name: 'stencil',
            type: 'art_peace::multi_canvas::MultiCanvas::StencilMetadata',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u32',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'remove_stencil',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
          {
            name: 'stencil_id',
            type: 'core::integer::u32',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'favorite_stencil',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
          {
            name: 'stencil_id',
            type: 'core::integer::u32',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'unfavorite_stencil',
        inputs: [
          {
            name: 'canvas_id',
            type: 'core::integer::u32',
          },
          {
            name: 'stencil_id',
            type: 'core::integer::u32',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
    ],
  },
  {
    type: 'constructor',
    name: 'constructor',
    inputs: [
      {
        name: 'game_master',
        type: 'core::starknet::contract_address::ContractAddress',
      },
    ],
  },
  {
    type: 'event',
    name: 'art_peace::multi_canvas::MultiCanvas::CanvasCreated',
    kind: 'struct',
    members: [
      {
        name: 'canvas_id',
        type: 'core::integer::u32',
        kind: 'key',
      },
      {
        name: 'init_params',
        type: 'art_peace::multi_canvas::MultiCanvas::CanvasInitParams',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'art_peace::multi_canvas::MultiCanvas::CanvasHostChanged',
    kind: 'struct',
    members: [
      {
        name: 'canvas_id',
        type: 'core::integer::u32',
        kind: 'key',
      },
      {
        name: 'old_host',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'new_host',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'art_peace::multi_canvas::MultiCanvas::CanvasTimeBetweenPixelsChanged',
    kind: 'struct',
    members: [
      {
        name: 'canvas_id',
        type: 'core::integer::u32',
        kind: 'key',
      },
      {
        name: 'old_time',
        type: 'core::integer::u64',
        kind: 'data',
      },
      {
        name: 'new_time',
        type: 'core::integer::u64',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'art_peace::multi_canvas::MultiCanvas::CanvasColorAdded',
    kind: 'struct',
    members: [
      {
        name: 'canvas_id',
        type: 'core::integer::u32',
        kind: 'key',
      },
      {
        name: 'color_key',
        type: 'core::integer::u8',
        kind: 'key',
      },
      {
        name: 'color',
        type: 'core::integer::u32',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'art_peace::multi_canvas::MultiCanvas::CanvasPixelPlaced',
    kind: 'struct',
    members: [
      {
        name: 'canvas_id',
        type: 'core::integer::u32',
        kind: 'key',
      },
      {
        name: 'placed_by',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'pos',
        type: 'core::integer::u128',
        kind: 'key',
      },
      {
        name: 'color',
        type: 'core::integer::u8',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'art_peace::multi_canvas::MultiCanvas::CanvasBasicPixelPlaced',
    kind: 'struct',
    members: [
      {
        name: 'canvas_id',
        type: 'core::integer::u32',
        kind: 'key',
      },
      {
        name: 'placed_by',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'timestamp',
        type: 'core::integer::u64',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'art_peace::multi_canvas::MultiCanvas::CanvasExtraPixelsPlaced',
    kind: 'struct',
    members: [
      {
        name: 'canvas_id',
        type: 'core::integer::u32',
        kind: 'key',
      },
      {
        name: 'placed_by',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'extra_pixels',
        type: 'core::integer::u32',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'art_peace::multi_canvas::MultiCanvas::CanvasHostAwardedUser',
    kind: 'struct',
    members: [
      {
        name: 'canvas_id',
        type: 'core::integer::u32',
        kind: 'key',
      },
      {
        name: 'user',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'amount',
        type: 'core::integer::u32',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'art_peace::multi_canvas::MultiCanvas::CanvasFavorited',
    kind: 'struct',
    members: [
      {
        name: 'canvas_id',
        type: 'core::integer::u32',
        kind: 'key',
      },
      {
        name: 'user',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
    ],
  },
  {
    type: 'event',
    name: 'art_peace::multi_canvas::MultiCanvas::CanvasUnfavorited',
    kind: 'struct',
    members: [
      {
        name: 'canvas_id',
        type: 'core::integer::u32',
        kind: 'key',
      },
      {
        name: 'user',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
    ],
  },
  {
    type: 'event',
    name: 'art_peace::multi_canvas::MultiCanvas::StencilAdded',
    kind: 'struct',
    members: [
      {
        name: 'canvas_id',
        type: 'core::integer::u32',
        kind: 'key',
      },
      {
        name: 'stencil_id',
        type: 'core::integer::u32',
        kind: 'key',
      },
      {
        name: 'stencil',
        type: 'art_peace::multi_canvas::MultiCanvas::StencilMetadata',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'art_peace::multi_canvas::MultiCanvas::StencilRemoved',
    kind: 'struct',
    members: [
      {
        name: 'canvas_id',
        type: 'core::integer::u32',
        kind: 'key',
      },
      {
        name: 'stencil_id',
        type: 'core::integer::u32',
        kind: 'key',
      },
      {
        name: 'stencil',
        type: 'art_peace::multi_canvas::MultiCanvas::StencilMetadata',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'art_peace::multi_canvas::MultiCanvas::StencilFavorited',
    kind: 'struct',
    members: [
      {
        name: 'canvas_id',
        type: 'core::integer::u32',
        kind: 'key',
      },
      {
        name: 'stencil_id',
        type: 'core::integer::u32',
        kind: 'key',
      },
      {
        name: 'user',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
    ],
  },
  {
    type: 'event',
    name: 'art_peace::multi_canvas::MultiCanvas::StencilUnfavorited',
    kind: 'struct',
    members: [
      {
        name: 'canvas_id',
        type: 'core::integer::u32',
        kind: 'key',
      },
      {
        name: 'stencil_id',
        type: 'core::integer::u32',
        kind: 'key',
      },
      {
        name: 'user',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
    ],
  },
  {
    type: 'event',
    name: 'art_peace::multi_canvas::MultiCanvas::Event',
    kind: 'enum',
    variants: [
      {
        name: 'CanvasCreated',
        type: 'art_peace::multi_canvas::MultiCanvas::CanvasCreated',
        kind: 'nested',
      },
      {
        name: 'CanvasHostChanged',
        type: 'art_peace::multi_canvas::MultiCanvas::CanvasHostChanged',
        kind: 'nested',
      },
      {
        name: 'CanvasTimeBetweenPixelsChanged',
        type: 'art_peace::multi_canvas::MultiCanvas::CanvasTimeBetweenPixelsChanged',
        kind: 'nested',
      },
      {
        name: 'CanvasColorAdded',
        type: 'art_peace::multi_canvas::MultiCanvas::CanvasColorAdded',
        kind: 'nested',
      },
      {
        name: 'CanvasPixelPlaced',
        type: 'art_peace::multi_canvas::MultiCanvas::CanvasPixelPlaced',
        kind: 'nested',
      },
      {
        name: 'CanvasBasicPixelPlaced',
        type: 'art_peace::multi_canvas::MultiCanvas::CanvasBasicPixelPlaced',
        kind: 'nested',
      },
      {
        name: 'CanvasExtraPixelsPlaced',
        type: 'art_peace::multi_canvas::MultiCanvas::CanvasExtraPixelsPlaced',
        kind: 'nested',
      },
      {
        name: 'CanvasHostAwardedUser',
        type: 'art_peace::multi_canvas::MultiCanvas::CanvasHostAwardedUser',
        kind: 'nested',
      },
      {
        name: 'CanvasFavorited',
        type: 'art_peace::multi_canvas::MultiCanvas::CanvasFavorited',
        kind: 'nested',
      },
      {
        name: 'CanvasUnfavorited',
        type: 'art_peace::multi_canvas::MultiCanvas::CanvasUnfavorited',
        kind: 'nested',
      },
      {
        name: 'StencilAdded',
        type: 'art_peace::multi_canvas::MultiCanvas::StencilAdded',
        kind: 'nested',
      },
      {
        name: 'StencilRemoved',
        type: 'art_peace::multi_canvas::MultiCanvas::StencilRemoved',
        kind: 'nested',
      },
      {
        name: 'StencilFavorited',
        type: 'art_peace::multi_canvas::MultiCanvas::StencilFavorited',
        kind: 'nested',
      },
      {
        name: 'StencilUnfavorited',
        type: 'art_peace::multi_canvas::MultiCanvas::StencilUnfavorited',
        kind: 'nested',
      },
    ],
  },
] as const;
