"use strict";
// The transformer type is used to transparently translate keys and values
// through an encoder and decoder function.
Object.defineProperty(exports, "__esModule", { value: true });
exports.prefixTransformer = exports.defaultGetRange = exports.defaultTransformer = void 0;
const util_1 = require("./util");
const id = (x) => x;
exports.defaultTransformer = {
    pack: id,
    unpack: id
};
const defaultGetRange = (prefix, keyXf) => ({
    begin: keyXf.pack(prefix),
    end: (0, util_1.strInc)(keyXf.pack(prefix)),
});
exports.defaultGetRange = defaultGetRange;
const prefixTransformer = (prefix, inner) => {
    const _prefix = (0, util_1.asBuf)(prefix);
    const transformer = {
        name: inner.name ? 'prefixed ' + inner.name : 'prefixTransformer',
        pack(v) {
            // If you heavily nest these it'll get pretty inefficient.
            const innerVal = inner.pack(v);
            return (0, util_1.concat2)(_prefix, (0, util_1.asBuf)(innerVal));
        },
        unpack(buf) {
            if (!(0, util_1.startsWith)(buf, _prefix))
                throw Error('Cannot unpack key outside of prefix range.');
            return inner.unpack(buf.subarray(_prefix.length));
        },
    };
    if (inner.packUnboundVersionstamp)
        transformer.packUnboundVersionstamp = (val) => {
            const innerVal = inner.packUnboundVersionstamp(val);
            const unboundStamp = {
                data: (0, util_1.concat2)(_prefix, innerVal.data),
                stampPos: _prefix.length + innerVal.stampPos
            };
            if (innerVal.codePos != null) {
                unboundStamp.codePos = _prefix.length + innerVal.codePos;
            }
            return unboundStamp;
        };
    if (inner.bakeVersionstamp)
        transformer.bakeVersionstamp = inner.bakeVersionstamp.bind(inner);
    if (inner.range)
        transformer.range = prefix => {
            const innerRange = inner.range(prefix);
            return {
                begin: (0, util_1.concat2)(_prefix, (0, util_1.asBuf)(innerRange.begin)),
                end: (0, util_1.concat2)(_prefix, (0, util_1.asBuf)(innerRange.end)),
            };
        };
    return transformer;
};
exports.prefixTransformer = prefixTransformer;
//# sourceMappingURL=transformer.js.map