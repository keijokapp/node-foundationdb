"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.packVersionstampPrefixSuffix = exports.packPrefixedVersionstamp = exports.packVersionstamp = void 0;
const apiVersion = require("./apiVersion");
const packedBufLen = (dataLen, isKey) => {
    const use4ByteOffset = apiVersion.get() >= 520;
    return dataLen + (use4ByteOffset ? 4 : (isKey ? 2 : 0));
};
// If preallocated is set, the buffer already has space for the offset at the end.
// pos is the position in data. It does not take into account the prefix length.
const packVersionstampRaw = (data, pos, isKey, preallocated) => {
    const use4ByteOffset = apiVersion.get() >= 520;
    // Before API version 520 it was a bit of a mess:
    // - Keys had a 2 byte offset appended to the end
    // - Values did not support an offset at all. Versionstamps in a value must be the first 10 bytes of that value.
    if (!isKey && !use4ByteOffset && pos > 0) {
        throw Error('API version <520 do not support versionstamps in a value at a non-zero offset');
    }
    const result = preallocated ? data : Buffer.allocUnsafe(packedBufLen(data.length, isKey));
    if (!preallocated)
        data.copy(result, 0);
    if (use4ByteOffset)
        result.writeUInt32LE(pos, result.length - 4);
    else if (isKey)
        result.writeUInt16LE(pos, result.length - 2);
    // console.log('packVersionstampRaw', result)
    return result;
};
// Exported for binding tester. TODO: Consider moving this into its own file and exporting it generally.
const packVersionstamp = ({ data, stampPos }, isKey) => (packVersionstampRaw(data, stampPos, isKey, false));
exports.packVersionstamp = packVersionstamp;
const packPrefixedVersionstamp = (prefix, { data, stampPos }, isKey) => {
    // console.log('pl', prefix.length, 'dl', data.length, 'to', packedBufLen(prefix.length + data.length, isKey))
    const buf = Buffer.allocUnsafe(packedBufLen(prefix.length + data.length, isKey));
    prefix.copy(buf);
    data.copy(buf, prefix.length);
    return packVersionstampRaw(buf, prefix.length + stampPos, isKey, true);
};
exports.packPrefixedVersionstamp = packPrefixedVersionstamp;
const zeroBuf = Buffer.allocUnsafe(0);
const packVersionstampPrefixSuffix = (prefix = zeroBuf, suffix = zeroBuf, isKey) => {
    const buf = Buffer.allocUnsafe(packedBufLen(prefix.length + 10 + suffix.length, isKey));
    prefix.copy(buf);
    suffix.copy(buf, prefix.length + 10);
    // console.log('prelen', prefix.length, 'suf len', suffix.length, 'len', buf.length)
    return packVersionstampRaw(buf, prefix.length, isKey, true);
};
exports.packVersionstampPrefixSuffix = packVersionstampPrefixSuffix;
//# sourceMappingURL=versionstamp.js.map