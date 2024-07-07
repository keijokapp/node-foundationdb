"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const error_1 = require("./error");
const transaction_1 = require("./transaction");
const subspace_1 = require("./subspace");
const opts_1 = require("./opts");
const opts_g_1 = require("./opts.g");
class Database {
    _db;
    subspace;
    constructor(db, subspace) {
        this._db = db;
        this.subspace = subspace; //new Subspace<KeyIn, KeyOut, ValIn, ValOut>(prefix, keyXf, valueXf)
    }
    /**
     * Switch to a new mode of handling ranges.
     *
     * @see Subspace.noDefaultPrefix
     */
    noDefaultPrefix() {
        return new Database(this._db, this.subspace.noDefaultPrefix());
    }
    setNativeOptions(opts) {
        (0, opts_1.eachOption)(opts_g_1.databaseOptionData, opts, (code, val) => this._db.setOption(code, val));
    }
    close() {
        this._db.close();
    }
    // **** Scoping functions
    getRoot() {
        return new Database(this._db, subspace_1.root);
    }
    getSubspace() { return this.subspace; }
    getPrefix() { return this.subspace.prefix; }
    at(prefixOrSubspace, keyXf, valueXf) {
        if ((0, subspace_1.isGetSubspace)(prefixOrSubspace))
            return new Database(this._db, prefixOrSubspace.getSubspace());
        else
            return new Database(this._db, this.subspace.at(prefixOrSubspace, keyXf, valueXf));
    }
    withKeyEncoding(keyXf) {
        return new Database(this._db, this.subspace.withKeyEncoding(keyXf));
    }
    withValueEncoding(valueXf) {
        return new Database(this._db, this.subspace.withValueEncoding(valueXf));
    }
    // This is the API you want to use for non-trivial transactions.
    async doTn(body, opts) {
        const tn = this._db.createTransaction();
        if (opts)
            (0, opts_1.eachOption)(opts_g_1.transactionOptionData, opts, (code, val) => tn.setOption(code, val));
        let transaction;
        // Logic described here:
        // https://apple.github.io/foundationdb/api-c.html#c.fdb_transaction_on_error
        do {
            transaction?._invalidate();
            transaction = new transaction_1.default(tn, false, this.subspace);
            try {
                return await transaction._exec(body);
            }
            catch (err) {
                // See if we can retry the transaction
                if (err instanceof error_1.default) {
                    await tn.onError(err.code); // If this throws, punt error to caller.
                    // If that passed, loop.
                }
                else {
                    throw err;
                }
            }
        } while (true);
    }
    // Alias for db.doTn.
    async doTransaction(body, opts) {
        return this.doTn(body, opts);
    }
    doOneshot(body, opts) {
        // TODO: Could this be written better? It doesn't need a retry loop.
        return this.doTransaction(tn => {
            body(tn);
            return Promise.resolve();
        });
    }
    // TODO: setOption.
    // Infrequently used. You probably want to use doTransaction instead.
    rawCreateTransaction(opts) {
        const tn = this._db.createTransaction();
        if (opts)
            (0, opts_1.eachOption)(opts_g_1.transactionOptionData, opts, (code, val) => tn.setOption(code, val));
        return new transaction_1.default(tn, false, this.subspace);
    }
    get(key) {
        return this.doTransaction(tn => tn.snapshot().get(key));
    }
    getKey(selector) {
        return this.doTransaction(tn => tn.snapshot().getKey(selector));
    }
    getVersionstampPrefixedValue(key) {
        return this.doTransaction(tn => tn.snapshot().getVersionstampPrefixedValue(key));
    }
    set(key, value) {
        return this.doOneshot(tn => tn.set(key, value));
    }
    clear(key) {
        return this.doOneshot(tn => tn.clear(key));
    }
    clearRange(start, end) {
        return this.doOneshot(tn => tn.clearRange(start, end));
    }
    clearRangeStartsWith(prefix) {
        return this.doOneshot(tn => tn.clearRangeStartsWith(prefix));
    }
    getAndWatch(key) {
        return this.doTransaction(async (tn) => {
            const value = await tn.get(key);
            const watch = tn.watch(key);
            watch.value = value;
            return watch;
        });
    }
    // Not passing options through to the promise. The only option we support so
    // far is to pass through errors, but if we do that and the transaction
    // somehow conflicted, it would be impossible to avoid an uncaught promise
    // exception.
    setAndWatch(key, value) {
        return this.doTransaction(async (tn) => {
            tn.set(key, value);
            return tn.watch(key);
        });
    }
    clearAndWatch(key) {
        return this.doTransaction(async (tn) => {
            tn.clear(key);
            return tn.watch(key);
        });
    }
    getRangeAll(start, end, opts) {
        return this.doTransaction(tn => tn.snapshot().getRangeAll(start, end, opts));
    }
    getRangeAllStartsWith(prefix, opts) {
        return this.doTransaction(tn => tn.snapshot().getRangeAllStartsWith(prefix, opts));
    }
    getEstimatedRangeSizeBytes(start, end) {
        return this.doTransaction(tn => tn.getEstimatedRangeSizeBytes(start, end));
    }
    getRangeSplitPoints(start, end, chunkSize) {
        return this.doTransaction(tn => tn.getRangeSplitPoints(start, end, chunkSize));
    }
    // These functions all need to return their values because they're returning a child promise.
    atomicOpNative(op, key, oper) {
        return this.doOneshot(tn => tn.atomicOpNative(op, key, oper));
    }
    atomicOp(op, key, oper) {
        return this.doOneshot(tn => tn.atomicOp(op, key, oper));
    }
    atomicOpKB(op, key, oper) {
        return this.doOneshot(tn => tn.atomicOpKB(op, key, oper));
    }
    add(key, oper) { return this.atomicOp(opts_g_1.MutationType.Add, key, oper); }
    max(key, oper) { return this.atomicOp(opts_g_1.MutationType.Max, key, oper); }
    min(key, oper) { return this.atomicOp(opts_g_1.MutationType.Min, key, oper); }
    // Raw buffer variants are provided here to support fancy bit packing semantics.
    bitAnd(key, oper) { return this.atomicOp(opts_g_1.MutationType.BitAnd, key, oper); }
    bitOr(key, oper) { return this.atomicOp(opts_g_1.MutationType.BitOr, key, oper); }
    bitXor(key, oper) { return this.atomicOp(opts_g_1.MutationType.BitXor, key, oper); }
    bitAndBuf(key, oper) { return this.atomicOpKB(opts_g_1.MutationType.BitAnd, key, oper); }
    bitOrBuf(key, oper) { return this.atomicOpKB(opts_g_1.MutationType.BitOr, key, oper); }
    bitXorBuf(key, oper) { return this.atomicOpKB(opts_g_1.MutationType.BitXor, key, oper); }
    // Performs lexicographic comparison of byte strings. Sets the value in the
    // database to the lexographical min / max of its current value and the
    // value supplied as a parameter. If the key does not exist in the database
    // this is the same as set().
    byteMin(key, oper) { return this.atomicOp(opts_g_1.MutationType.ByteMin, key, oper); }
    byteMax(key, oper) { return this.atomicOp(opts_g_1.MutationType.ByteMax, key, oper); }
    // setVersionstampedKeyBuf(prefix: Buffer | undefined, suffix: Buffer | undefined, value: ValIn) {
    //   return this.doOneshot(tn => tn.setVersionstampedKeyBuf(prefix, suffix, value))
    // }
    setVersionstampedKey(key, value, bakeAfterCommit) {
        return this.doOneshot(tn => tn.setVersionstampedKey(key, value, bakeAfterCommit));
    }
    setVersionstampSuffixedKey(key, value, suffix) {
        return this.doOneshot(tn => tn.setVersionstampSuffixedKey(key, value, suffix));
    }
    // setVersionstampedKeyPrefix(prefix: KeyIn, value: ValIn) {
    //   return this.setVersionstampedKey(prefix, undefined, value)
    // }
    setVersionstampedValue(key, value, bakeAfterCommit = true) {
        return this.doOneshot(tn => tn.setVersionstampedValue(key, value, bakeAfterCommit));
    }
    // setVersionstampedValueBuf(key: KeyIn, oper: Buffer) { return this.atomicOpKB(MutationType.SetVersionstampedValue, key, oper) }
    setVersionstampPrefixedValue(key, value, prefix) {
        return this.doOneshot(tn => tn.setVersionstampPrefixedValue(key, value, prefix));
    }
}
exports.default = Database;
//# sourceMappingURL=database.js.map