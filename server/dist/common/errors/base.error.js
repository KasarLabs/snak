"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseError = void 0;
class BaseError extends Error {
    constructor(type, message, metadata) {
        super(message);
        this.type = type;
        this.metadata = metadata;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
    toJSON() {
        return {
            type: this.type,
            message: this.message,
            metadata: this.metadata,
        };
    }
}
exports.BaseError = BaseError;
//# sourceMappingURL=base.error.js.map