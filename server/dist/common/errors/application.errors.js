"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForbiddenError = exports.UnauthorizedError = exports.NotFoundError = exports.ValidationError = void 0;
const base_error_1 = require("./base.error");
const error_types_1 = require("./error.types");
class ValidationError extends base_error_1.BaseError {
    constructor(message, metadata) {
        super(error_types_1.ErrorType.VALIDATION_ERROR, message, metadata);
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends base_error_1.BaseError {
    constructor(message, metadata) {
        super(error_types_1.ErrorType.NOT_FOUND, message, metadata);
    }
}
exports.NotFoundError = NotFoundError;
class UnauthorizedError extends base_error_1.BaseError {
    constructor(message, metadata) {
        super(error_types_1.ErrorType.UNAUTHORIZED, message, metadata);
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends base_error_1.BaseError {
    constructor(message, metadata) {
        super(error_types_1.ErrorType.FORBIDDEN, message, metadata);
    }
}
exports.ForbiddenError = ForbiddenError;
//# sourceMappingURL=application.errors.js.map