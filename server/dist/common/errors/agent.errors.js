"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentCredentialsError = exports.AgentValidationError = exports.AgentInitializationError = exports.AgentExecutionError = void 0;
const base_error_1 = require("./base.error");
const error_types_1 = require("./error.types");
class AgentExecutionError extends base_error_1.BaseError {
    constructor(message, metadata) {
        super(error_types_1.ErrorType.AGENT_EXECUTION_ERROR, message, metadata);
    }
}
exports.AgentExecutionError = AgentExecutionError;
class AgentInitializationError extends base_error_1.BaseError {
    constructor(message, metadata) {
        super(error_types_1.ErrorType.AGENT_INITIALIZATION_ERROR, message, metadata);
    }
}
exports.AgentInitializationError = AgentInitializationError;
class AgentValidationError extends Error {
    constructor(message, details) {
        super(message);
        this.name = 'AgentValidationError';
        this.details = details;
    }
}
exports.AgentValidationError = AgentValidationError;
class AgentCredentialsError extends Error {
    constructor(message, details) {
        super(message);
        this.name = 'AgentCredentialsError';
        this.details = details;
    }
}
exports.AgentCredentialsError = AgentCredentialsError;
//# sourceMappingURL=agent.errors.js.map