"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withEachDb = exports.testApiVersion = exports.strXF = exports.numXF = exports.numToBuf = exports.bufToNum = exports.prefix = void 0;
require("mocha");
const fdb = require("../lib");
// We'll tuck everything behind this prefix and delete it all when the tests finish running.
exports.prefix = '__test_data__/';
// export const prefixBuf = (key: Buffer) => Buffer.concat([Buffer.from(prefix), key])
// Using big endian numbers because they're lexographically sorted correctly.
const bufToNum = (b, def = 0) => b ? b.readInt32BE(0) : def;
exports.bufToNum = bufToNum;
const numToBuf = (n) => {
    const b = Buffer.alloc(4);
    b.writeInt32BE(n, 0);
    return b;
};
exports.numToBuf = numToBuf;
exports.numXF = {
    pack: exports.numToBuf,
    unpack: exports.bufToNum
};
exports.strXF = {
    pack(s) { return s; },
    unpack(b) { return b.toString('utf8'); }
};
// Only testing with one API version for now.
// This should work with API versions 510, 520, 600, 610 and 620.
exports.testApiVersion = 630;
const withEachDb = (fn) => {
    fdb.setAPIVersion(exports.testApiVersion);
    // These tests just use a single shared database cluster instance which is
    // reset between tests. It would be cleaner if we used beforeEach to close &
    // reopen the database but its probably fine like this.
    const db = fdb.open().at(exports.prefix);
    // const s = defaultSubspace
    // const y = s.at(null, fdb.tuple)
    // const y2 = y.at(null, undefined, fdb.tuple)
    // const dy = db.at(null, fdb.tuple)
    // const dy2 = dy.at(null, undefined, fdb.tuple)
    after(() => {
        db.close();
        // fdb.stopNetworkSync()
    });
    // We need to do this both before and after tests run to clean up any mess
    // that a previously aborted test left behind. This is safe - it only clears
    // everything at the specified prefix. Its terrifying though.
    beforeEach(() => db.clearRangeStartsWith(''));
    afterEach(() => db.clearRangeStartsWith(''));
    describe('fdb', () => fn(db));
    // TODO: It would be nice to check that nothing was written outside of the prefix.
};
exports.withEachDb = withEachDb;
//# sourceMappingURL=util.js.map