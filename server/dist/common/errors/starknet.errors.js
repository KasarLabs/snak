"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetRpcError = exports.StarknetTransactionError = void 0;
const base_error_1 = require("./base.error");
const error_types_1 = require("./error.types");
class StarknetTransactionError extends base_error_1.BaseError {
    constructor(message, metadata) {
        super(error_types_1.ErrorType.STARKNET_TRANSACTION_ERROR, message, metadata);
    }
}
exports.StarknetTransactionError = StarknetTransactionError;
class StarknetRpcError extends base_error_1.BaseError {
    constructor(message, metadata) {
        super(error_types_1.ErrorType.STARKNET_RPC_ERROR, message, metadata);
    }
}
exports.StarknetRpcError = StarknetRpcError;
//# sourceMappingURL=starknet.errors.js.map