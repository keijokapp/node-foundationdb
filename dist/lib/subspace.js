"use strict";
// A subspace is a wrapper around a prefix and key and value transformers. This
// is nearly equivalent to subspaces in the other bindings - the difference is
// it also includes kv transformers, so a subspace here will also automatically
// encode and decode keys and values.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isGetSubspace = exports.root = void 0;
const transformer_1 = require("./transformer");
const util_1 = require("./util");
const EMPTY_BUF = Buffer.allocUnsafe(0);
const concatPrefix = (p1, p2) => (p2 == null ? p1
    : p1.length === 0 ? (0, util_1.asBuf)(p2)
        : (0, util_1.concat2)(p1, (0, util_1.asBuf)(p2)));
// Template parameters refer to the types of the allowed key and values you pass
// in to the database (eg in a set(keyin, valin) call) and the types of keys and
// values returned. KeyIn == KeyOut and ValIn == ValOut in almost all cases.
class Subspace {
    prefix; // This is baked into bakedKeyXf but we hold it so we can call .at / .atPrefix.
    keyXf;
    valueXf;
    _bakedKeyXf; // This is cached from _prefix + keyXf.
    _noDefaultPrefix;
    constructor(rawPrefix, keyXf, valueXf, noDefaultPrefix = false) {
        this.prefix = rawPrefix != null ? Buffer.from(rawPrefix) : EMPTY_BUF;
        // Ugh typing this is a mess. Usually this will be fine since if you say new
        // Subspace() you'll get the default values for KI/KO/VI/VO.
        this.keyXf = keyXf || transformer_1.defaultTransformer;
        this.valueXf = valueXf || transformer_1.defaultTransformer;
        this._bakedKeyXf = rawPrefix ? (0, transformer_1.prefixTransformer)(rawPrefix, this.keyXf) : this.keyXf;
        this._noDefaultPrefix = noDefaultPrefix;
    }
    /**
     * Switch to a new mode of handling ranges. By default, the range operations (`getRange` family
     * and `clearRange`) treat calls with missing end key as operations on prefix ranges. That means
     * that a call like `tn.at('a').getRange('x')` acts on prefix `ax`, ie key range `[ax, ay)`. In
     * the new mode, the missing end key defaults to a subspace end (inclusive), ie that call would
     * act on a range `[ax, b)`. This enabled specifying key ranges not possible before.
     *
     * To specifiy range as a prefix, use `StartsWith` version of those methods (eg
     * `getRangeAllStartsWith`).
     *
     * @see Subspace.packRange
     */
    noDefaultPrefix() {
        return new Subspace(this.prefix, this.keyXf, this.valueXf, true);
    }
    at(prefix, keyXf = this.keyXf, valueXf = this.valueXf) {
        const _prefix = prefix == null ? null : this.keyXf.pack(prefix);
        return new Subspace(concatPrefix(this.prefix, _prefix), keyXf, valueXf, this._noDefaultPrefix);
    }
    /** At a child prefix thats specified without reference to the key transformer */
    atRaw(prefix) {
        return new Subspace(concatPrefix(this.prefix, prefix), this.keyXf, this.valueXf, this._noDefaultPrefix);
    }
    withKeyEncoding(keyXf) {
        return new Subspace(this.prefix, keyXf, this.valueXf, this._noDefaultPrefix);
    }
    withValueEncoding(valueXf) {
        return new Subspace(this.prefix, this.keyXf, valueXf, this._noDefaultPrefix);
    }
    // GetSubspace implementation
    getSubspace() { return this; }
    // Helpers to inspect whats going on.
    packKey(key) {
        return this._bakedKeyXf.pack(key);
    }
    unpackKey(key) {
        return this._bakedKeyXf.unpack(key);
    }
    packKeyUnboundVersionstamp(key) {
        if (!this._bakedKeyXf.packUnboundVersionstamp) {
            throw TypeError('Value encoding does not support unbound versionstamps. Use setVersionstampPrefixedValue instead');
        }
        return this._bakedKeyXf.packUnboundVersionstamp(key);
    }
    packValue(val) {
        return this.valueXf.pack(val);
    }
    unpackValue(val) {
        return this.valueXf.unpack(val);
    }
    packValueUnboundVersionstamp(value) {
        if (!this.valueXf.packUnboundVersionstamp) {
            throw TypeError('Value encoding does not support unbound versionstamps. Use setVersionstampPrefixedValue instead');
        }
        return this.valueXf.packUnboundVersionstamp(value);
    }
    /**
     * Encodes a range specified by `start`/`end` pair using configured key encoder.
     *
     * @param start Start of the key range. If undefined, the start of the subspace is assumed.
     * @param end End of the key range. If undefined, the end of the subspace is assumed, unless
     * `noDefaultPrefix` flag is set or enabled for this subspace, in which case, start key is treated
     * as a prefix.
     * @param noDefaultPrefix Disable treating start key as a prefix if end key is not specified.
     * @returns Encoded range as a `{ begin, end }` record.
     */
    packRange(start, end, noDefaultPrefix = false) {
        if (start !== undefined && end === undefined && !this._noDefaultPrefix && !noDefaultPrefix) {
            return this.packRangeStartsWith(start);
        }
        return {
            begin: start !== undefined ? this._bakedKeyXf.pack(start) : this.prefix,
            end: end !== undefined ? this._bakedKeyXf.pack(end) : (0, util_1.strInc)(this.prefix)
        };
    }
    /**
     * Encodes a range specified by the prefix using configured key encoder.
     *
     * @param prefix Start of the key key range. If undefined, the start of the subspace is assumed.
     * @returns Encoded range as a `{ begin, end }` record.
     */
    packRangeStartsWith(prefix) {
        const encodePrefix = this._bakedKeyXf.range ?? transformer_1.defaultGetRange;
        return encodePrefix(prefix, this._bakedKeyXf);
    }
    contains(key) {
        // TODO: This is a little dangerous - we should check if the key exists between this.keyXf.range().
        return (0, util_1.startsWith)((0, util_1.asBuf)(key), this.prefix);
    }
}
exports.default = Subspace;
exports.root = new Subspace(null, transformer_1.defaultTransformer, transformer_1.defaultTransformer);
const isGetSubspace = (obj) => {
    return obj != null && typeof obj === 'object' && 'getSubspace' in obj;
};
exports.isGetSubspace = isGetSubspace;
//# sourceMappingURL=subspace.js.map