"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const keySelector = (key, orEqual, offset) => ({ key, orEqual, offset, _isKeySelector: true });
const add = (sel, addOffset) => keySelector(sel.key, sel.orEqual, sel.offset + addOffset);
const next = (sel) => add(sel, 1);
const prev = (sel) => add(sel, -1);
// From the [docs](https://apple.github.io/foundationdb/developer-guide.html#key-selectors):
//
// To resolve these key selectors FoundationDB first finds the last key less
// than the reference key (or equal to the reference key, if the equality flag
// is true), then moves forward a number of keys equal to the offset (or
// backwards, if the offset is negative).
const lastLessThan = (key) => keySelector(key, false, 0);
const lastLessOrEqual = (key) => keySelector(key, true, 0);
const firstGreaterThan = (key) => keySelector(key, true, 1);
const firstGreaterOrEqual = (key) => keySelector(key, false, 1);
const isKeySelector = (val) => {
    return (typeof val === 'object' && val != null && val._isKeySelector);
};
const from = (valOrKS) => (isKeySelector(valOrKS) ? valOrKS : firstGreaterOrEqual(valOrKS));
const toNative = (sel, xf) => (keySelector(xf.pack(sel.key), sel.orEqual, sel.offset));
exports.default = Object.assign(keySelector, {
    add, next, prev, lastLessThan, lastLessOrEqual, firstGreaterThan, firstGreaterOrEqual, isKeySelector, from, toNative
});
//# sourceMappingURL=keySelector.js.map