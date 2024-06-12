"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startsWith = exports.concat2 = exports.asBuf = exports.strNext = exports.strInc = void 0;
// String increment. Find the next string (well, buffer) after this buffer.
const strInc = (val) => {
    const buf = typeof val === 'string' ? Buffer.from(val) : val;
    let lastNonFFByte;
    for (lastNonFFByte = buf.length - 1; lastNonFFByte >= 0; --lastNonFFByte) {
        if (buf[lastNonFFByte] != 0xFF)
            break;
    }
    if (lastNonFFByte < 0) {
        throw new Error(`invalid argument '${val}': prefix must have at least one byte not equal to 0xFF`);
    }
    const result = Buffer.allocUnsafe(lastNonFFByte + 1);
    buf.copy(result, 0, 0, result.length);
    ++result[lastNonFFByte];
    return result;
};
exports.strInc = strInc;
const byteZero = Buffer.alloc(1);
// This appends \x00 to a key to get the next key.
const strNext = (val) => {
    const buf = Buffer.from(val);
    return Buffer.concat([buf, byteZero], buf.length + 1);
};
exports.strNext = strNext;
const asBuf = (val) => (typeof val === 'string' ? Buffer.from(val, 'utf8') : val);
exports.asBuf = asBuf;
// Marginally faster than Buffer.concat
const concat2 = (a, b) => {
    const result = Buffer.allocUnsafe(a.length + b.length);
    a.copy(result, 0);
    b.copy(result, a.length);
    return result;
};
exports.concat2 = concat2;
const startsWith = (a, prefix) => (prefix.length <= a.length && prefix.compare(a, 0, prefix.length) === 0);
exports.startsWith = startsWith;
//# sourceMappingURL=util.js.map