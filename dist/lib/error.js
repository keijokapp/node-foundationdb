"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class FDBError extends Error {
    constructor(description, code) {
        super(description);
        Object.setPrototypeOf(this, FDBError.prototype);
        // Error.captureStackTrace(this, this.constructor);
        this.code = code;
    }
    code;
}
exports.default = FDBError;
//# sourceMappingURL=error.js.map