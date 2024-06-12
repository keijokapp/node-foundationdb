"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBoundaryKeys = void 0;
const getBoundaryKeys = (db, begin, end) => {
    const tn = db.rawCreateTransaction({
        read_system_keys: true,
        lock_aware: true,
    });
};
exports.getBoundaryKeys = getBoundaryKeys;
//# sourceMappingURL=locality.js.map