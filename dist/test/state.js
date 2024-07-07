"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("mocha");
const fdb = require("../lib");
const util_1 = require("./util");
const native_1 = require("../lib/native");
fdb.setAPIVersion(util_1.testApiVersion);
describe('state tests', () => {
    it('throws if a closed database has a tn run on it', async () => {
        const db = fdb.open();
        db.close();
        // Not supported on node 8 :(
        // await assert.rejects(db.get('x'))
        await db.get('x').then(() => Promise.reject('should have thrown'), (e) => true);
    });
    it.skip('cancels pending watches when the database is closed', async () => {
        // This doesn't actually work, though I thought it would.
        const db = fdb.open();
        const w = await db.getAndWatch('x');
        db.close();
        await w.promise;
    });
    it('does nothing if the native module has setAPIVersion called again', () => {
        native_1.default.setAPIVersion(util_1.testApiVersion);
        native_1.default.setAPIVersionImpl(util_1.testApiVersion, util_1.testApiVersion);
    });
});
//# sourceMappingURL=state.js.map