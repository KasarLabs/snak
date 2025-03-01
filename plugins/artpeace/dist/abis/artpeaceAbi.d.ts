export declare const artpeaceAbi: readonly [{
    readonly type: "impl";
    readonly name: "MultiCanvasImpl";
    readonly interface_name: "art_peace::multi_canvas::IMultiCanvas";
}, {
    readonly type: "struct";
    readonly name: "art_peace::multi_canvas::MultiCanvas::CanvasMetadata";
    readonly members: readonly [{
        readonly name: "name";
        readonly type: "core::felt252";
    }, {
        readonly name: "unique_name";
        readonly type: "core::felt252";
    }, {
        readonly name: "width";
        readonly type: "core::integer::u128";
    }, {
        readonly name: "height";
        readonly type: "core::integer::u128";
    }, {
        readonly name: "start_time";
        readonly type: "core::integer::u64";
    }, {
        readonly name: "end_time";
        readonly type: "core::integer::u64";
    }];
}, {
    readonly type: "struct";
    readonly name: "core::array::Span::<core::integer::u32>";
    readonly members: readonly [{
        readonly name: "snapshot";
        readonly type: "@core::array::Array::<core::integer::u32>";
    }];
}, {
    readonly type: "struct";
    readonly name: "art_peace::multi_canvas::MultiCanvas::CanvasInitParams";
    readonly members: readonly [{
        readonly name: "host";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }, {
        readonly name: "name";
        readonly type: "core::felt252";
    }, {
        readonly name: "unique_name";
        readonly type: "core::felt252";
    }, {
        readonly name: "width";
        readonly type: "core::integer::u128";
    }, {
        readonly name: "height";
        readonly type: "core::integer::u128";
    }, {
        readonly name: "time_between_pixels";
        readonly type: "core::integer::u64";
    }, {
        readonly name: "color_palette";
        readonly type: "core::array::Span::<core::integer::u32>";
    }, {
        readonly name: "start_time";
        readonly type: "core::integer::u64";
    }, {
        readonly name: "end_time";
        readonly type: "core::integer::u64";
    }];
}, {
    readonly type: "struct";
    readonly name: "art_peace::multi_canvas::MultiCanvas::StencilMetadata";
    readonly members: readonly [{
        readonly name: "hash";
        readonly type: "core::felt252";
    }, {
        readonly name: "width";
        readonly type: "core::integer::u128";
    }, {
        readonly name: "height";
        readonly type: "core::integer::u128";
    }, {
        readonly name: "position";
        readonly type: "core::integer::u128";
    }];
}, {
    readonly type: "interface";
    readonly name: "art_peace::multi_canvas::IMultiCanvas";
    readonly items: readonly [{
        readonly type: "function";
        readonly name: "get_game_master";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "set_game_master";
        readonly inputs: readonly [{
            readonly name: "game_master";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "get_canvas_count";
        readonly inputs: readonly [];
        readonly outputs: readonly [{
            readonly type: "core::integer::u32";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_canvas";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }];
        readonly outputs: readonly [{
            readonly type: "art_peace::multi_canvas::MultiCanvas::CanvasMetadata";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "create_canvas";
        readonly inputs: readonly [{
            readonly name: "init_params";
            readonly type: "art_peace::multi_canvas::MultiCanvas::CanvasInitParams";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u32";
        }];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "get_host";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }];
        readonly outputs: readonly [{
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "set_host";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }, {
            readonly name: "host";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "get_name";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }];
        readonly outputs: readonly [{
            readonly type: "core::felt252";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_width";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u128";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_height";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u128";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_last_placed_time";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }, {
            readonly name: "user";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u64";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_time_between_pixels";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u64";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "set_time_between_pixels";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }, {
            readonly name: "time_between_pixels";
            readonly type: "core::integer::u64";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "enable_awards";
        readonly inputs: readonly [];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "disable_awards";
        readonly inputs: readonly [];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "award_user";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }, {
            readonly name: "user";
            readonly type: "core::starknet::contract_address::ContractAddress";
        }, {
            readonly name: "amount";
            readonly type: "core::integer::u32";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "get_color_count";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u8";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_colors";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }];
        readonly outputs: readonly [{
            readonly type: "core::array::Span::<core::integer::u32>";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_start_time";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u64";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_end_time";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u64";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "check_game_running";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "check_valid_pixel";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }, {
            readonly name: "pos";
            readonly type: "core::integer::u128";
        }, {
            readonly name: "color";
            readonly type: "core::integer::u8";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "check_timing";
        readonly inputs: readonly [{
            readonly name: "now";
            readonly type: "core::integer::u64";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "place_pixel";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }, {
            readonly name: "pos";
            readonly type: "core::integer::u128";
        }, {
            readonly name: "color";
            readonly type: "core::integer::u8";
        }, {
            readonly name: "now";
            readonly type: "core::integer::u64";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "place_pixel_xy";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }, {
            readonly name: "x";
            readonly type: "core::integer::u128";
        }, {
            readonly name: "y";
            readonly type: "core::integer::u128";
        }, {
            readonly name: "color";
            readonly type: "core::integer::u8";
        }, {
            readonly name: "now";
            readonly type: "core::integer::u64";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "favorite_canvas";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "unfavorite_canvas";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "get_stencil_count";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u32";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "get_stencil";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }, {
            readonly name: "stencil_id";
            readonly type: "core::integer::u32";
        }];
        readonly outputs: readonly [{
            readonly type: "art_peace::multi_canvas::MultiCanvas::StencilMetadata";
        }];
        readonly state_mutability: "view";
    }, {
        readonly type: "function";
        readonly name: "add_stencil";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }, {
            readonly name: "stencil";
            readonly type: "art_peace::multi_canvas::MultiCanvas::StencilMetadata";
        }];
        readonly outputs: readonly [{
            readonly type: "core::integer::u32";
        }];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "remove_stencil";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }, {
            readonly name: "stencil_id";
            readonly type: "core::integer::u32";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "favorite_stencil";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }, {
            readonly name: "stencil_id";
            readonly type: "core::integer::u32";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }, {
        readonly type: "function";
        readonly name: "unfavorite_stencil";
        readonly inputs: readonly [{
            readonly name: "canvas_id";
            readonly type: "core::integer::u32";
        }, {
            readonly name: "stencil_id";
            readonly type: "core::integer::u32";
        }];
        readonly outputs: readonly [];
        readonly state_mutability: "external";
    }];
}, {
    readonly type: "constructor";
    readonly name: "constructor";
    readonly inputs: readonly [{
        readonly name: "game_master";
        readonly type: "core::starknet::contract_address::ContractAddress";
    }];
}, {
    readonly type: "event";
    readonly name: "art_peace::multi_canvas::MultiCanvas::CanvasCreated";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "canvas_id";
        readonly type: "core::integer::u32";
        readonly kind: "key";
    }, {
        readonly name: "init_params";
        readonly type: "art_peace::multi_canvas::MultiCanvas::CanvasInitParams";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "art_peace::multi_canvas::MultiCanvas::CanvasHostChanged";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "canvas_id";
        readonly type: "core::integer::u32";
        readonly kind: "key";
    }, {
        readonly name: "old_host";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "data";
    }, {
        readonly name: "new_host";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "art_peace::multi_canvas::MultiCanvas::CanvasTimeBetweenPixelsChanged";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "canvas_id";
        readonly type: "core::integer::u32";
        readonly kind: "key";
    }, {
        readonly name: "old_time";
        readonly type: "core::integer::u64";
        readonly kind: "data";
    }, {
        readonly name: "new_time";
        readonly type: "core::integer::u64";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "art_peace::multi_canvas::MultiCanvas::CanvasColorAdded";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "canvas_id";
        readonly type: "core::integer::u32";
        readonly kind: "key";
    }, {
        readonly name: "color_key";
        readonly type: "core::integer::u8";
        readonly kind: "key";
    }, {
        readonly name: "color";
        readonly type: "core::integer::u32";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "art_peace::multi_canvas::MultiCanvas::CanvasPixelPlaced";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "canvas_id";
        readonly type: "core::integer::u32";
        readonly kind: "key";
    }, {
        readonly name: "placed_by";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "pos";
        readonly type: "core::integer::u128";
        readonly kind: "key";
    }, {
        readonly name: "color";
        readonly type: "core::integer::u8";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "art_peace::multi_canvas::MultiCanvas::CanvasBasicPixelPlaced";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "canvas_id";
        readonly type: "core::integer::u32";
        readonly kind: "key";
    }, {
        readonly name: "placed_by";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "timestamp";
        readonly type: "core::integer::u64";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "art_peace::multi_canvas::MultiCanvas::CanvasExtraPixelsPlaced";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "canvas_id";
        readonly type: "core::integer::u32";
        readonly kind: "key";
    }, {
        readonly name: "placed_by";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "extra_pixels";
        readonly type: "core::integer::u32";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "art_peace::multi_canvas::MultiCanvas::CanvasHostAwardedUser";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "canvas_id";
        readonly type: "core::integer::u32";
        readonly kind: "key";
    }, {
        readonly name: "user";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }, {
        readonly name: "amount";
        readonly type: "core::integer::u32";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "art_peace::multi_canvas::MultiCanvas::CanvasFavorited";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "canvas_id";
        readonly type: "core::integer::u32";
        readonly kind: "key";
    }, {
        readonly name: "user";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }];
}, {
    readonly type: "event";
    readonly name: "art_peace::multi_canvas::MultiCanvas::CanvasUnfavorited";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "canvas_id";
        readonly type: "core::integer::u32";
        readonly kind: "key";
    }, {
        readonly name: "user";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }];
}, {
    readonly type: "event";
    readonly name: "art_peace::multi_canvas::MultiCanvas::StencilAdded";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "canvas_id";
        readonly type: "core::integer::u32";
        readonly kind: "key";
    }, {
        readonly name: "stencil_id";
        readonly type: "core::integer::u32";
        readonly kind: "key";
    }, {
        readonly name: "stencil";
        readonly type: "art_peace::multi_canvas::MultiCanvas::StencilMetadata";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "art_peace::multi_canvas::MultiCanvas::StencilRemoved";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "canvas_id";
        readonly type: "core::integer::u32";
        readonly kind: "key";
    }, {
        readonly name: "stencil_id";
        readonly type: "core::integer::u32";
        readonly kind: "key";
    }, {
        readonly name: "stencil";
        readonly type: "art_peace::multi_canvas::MultiCanvas::StencilMetadata";
        readonly kind: "data";
    }];
}, {
    readonly type: "event";
    readonly name: "art_peace::multi_canvas::MultiCanvas::StencilFavorited";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "canvas_id";
        readonly type: "core::integer::u32";
        readonly kind: "key";
    }, {
        readonly name: "stencil_id";
        readonly type: "core::integer::u32";
        readonly kind: "key";
    }, {
        readonly name: "user";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }];
}, {
    readonly type: "event";
    readonly name: "art_peace::multi_canvas::MultiCanvas::StencilUnfavorited";
    readonly kind: "struct";
    readonly members: readonly [{
        readonly name: "canvas_id";
        readonly type: "core::integer::u32";
        readonly kind: "key";
    }, {
        readonly name: "stencil_id";
        readonly type: "core::integer::u32";
        readonly kind: "key";
    }, {
        readonly name: "user";
        readonly type: "core::starknet::contract_address::ContractAddress";
        readonly kind: "key";
    }];
}, {
    readonly type: "event";
    readonly name: "art_peace::multi_canvas::MultiCanvas::Event";
    readonly kind: "enum";
    readonly variants: readonly [{
        readonly name: "CanvasCreated";
        readonly type: "art_peace::multi_canvas::MultiCanvas::CanvasCreated";
        readonly kind: "nested";
    }, {
        readonly name: "CanvasHostChanged";
        readonly type: "art_peace::multi_canvas::MultiCanvas::CanvasHostChanged";
        readonly kind: "nested";
    }, {
        readonly name: "CanvasTimeBetweenPixelsChanged";
        readonly type: "art_peace::multi_canvas::MultiCanvas::CanvasTimeBetweenPixelsChanged";
        readonly kind: "nested";
    }, {
        readonly name: "CanvasColorAdded";
        readonly type: "art_peace::multi_canvas::MultiCanvas::CanvasColorAdded";
        readonly kind: "nested";
    }, {
        readonly name: "CanvasPixelPlaced";
        readonly type: "art_peace::multi_canvas::MultiCanvas::CanvasPixelPlaced";
        readonly kind: "nested";
    }, {
        readonly name: "CanvasBasicPixelPlaced";
        readonly type: "art_peace::multi_canvas::MultiCanvas::CanvasBasicPixelPlaced";
        readonly kind: "nested";
    }, {
        readonly name: "CanvasExtraPixelsPlaced";
        readonly type: "art_peace::multi_canvas::MultiCanvas::CanvasExtraPixelsPlaced";
        readonly kind: "nested";
    }, {
        readonly name: "CanvasHostAwardedUser";
        readonly type: "art_peace::multi_canvas::MultiCanvas::CanvasHostAwardedUser";
        readonly kind: "nested";
    }, {
        readonly name: "CanvasFavorited";
        readonly type: "art_peace::multi_canvas::MultiCanvas::CanvasFavorited";
        readonly kind: "nested";
    }, {
        readonly name: "CanvasUnfavorited";
        readonly type: "art_peace::multi_canvas::MultiCanvas::CanvasUnfavorited";
        readonly kind: "nested";
    }, {
        readonly name: "StencilAdded";
        readonly type: "art_peace::multi_canvas::MultiCanvas::StencilAdded";
        readonly kind: "nested";
    }, {
        readonly name: "StencilRemoved";
        readonly type: "art_peace::multi_canvas::MultiCanvas::StencilRemoved";
        readonly kind: "nested";
    }, {
        readonly name: "StencilFavorited";
        readonly type: "art_peace::multi_canvas::MultiCanvas::StencilFavorited";
        readonly kind: "nested";
    }, {
        readonly name: "StencilUnfavorited";
        readonly type: "art_peace::multi_canvas::MultiCanvas::StencilUnfavorited";
        readonly kind: "nested";
    }];
}];
