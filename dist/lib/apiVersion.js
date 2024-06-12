"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.set = exports.get = exports.MAX_VERSION = void 0;
const native_1 = require("./native");
// To update:
// - regenerate lib/opts.g.ts using scripts/gentsopts.ts
// - re-run the test suite and binding test suite
exports.MAX_VERSION = 720;
let apiVersion = null;
const get = () => apiVersion;
exports.get = get;
function set(version, headerVersion) {
    if (typeof version !== 'number')
        throw TypeError('version must be a number');
    if (apiVersion != null) {
        if (apiVersion !== version) {
            throw Error('foundationdb already initialized with API version ' + apiVersion);
        }
    }
    else {
        // Old versions probably work fine, but there are no tests to check.
        if (version < 500)
            throw Error('FDB Node bindings only support API versions >= 500');
        if (version > exports.MAX_VERSION) {
            // I'd like allow it to work with newer versions anyway since API
            // changes seem to be backwards compatible, but nativeMod.setAPIVersion
            // will throw anyway.
            throw Error(`Cannot use foundationdb protocol version ${version} > ${exports.MAX_VERSION}. This version of node-foundationdb only supports protocol versions <= ${exports.MAX_VERSION}.

Please update node-foundationdb if you haven't done so then file a ticket:
https://github.com/josephg/node-foundationdb/issues

Until this is fixed, use FDB API version ${exports.MAX_VERSION}.
`);
        }
        if (headerVersion == null)
            native_1.default.setAPIVersion(version);
        else
            native_1.default.setAPIVersionImpl(version, headerVersion);
        apiVersion = version;
    }
}
exports.set = set;
//# sourceMappingURL=apiVersion.js.map