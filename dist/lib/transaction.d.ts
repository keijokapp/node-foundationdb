/// <reference types="node" />
import { Watch, Callback, NativeValue, Version } from './native';
import { KeySelector } from './keySelector';
import { TransactionOptionCode, StreamingMode, MutationType } from './opts.g';
import Database from './database';
import Subspace, { GetSubspace } from './subspace';
export interface RangeOptionsBatch {
    streamingMode?: undefined | StreamingMode;
    limit?: undefined | number;
    reverse?: undefined | boolean;
}
export interface RangeOptions extends RangeOptionsBatch {
    targetBytes?: undefined | number;
}
export type KVList<Key, Value> = {
    results: [Key, Value][];
    more: boolean;
};
export { Watch };
export type WatchOptions = {
    throwAllErrors?: undefined | boolean;
};
/**
 * This class wraps a foundationdb transaction object. All interaction with the
 * data in a foundationdb database happens through a transaction. For more
 * detail about how to model your queries, see the [transaction chapter of the
 * FDB developer
 * guide](https://apple.github.io/foundationdb/developer-guide.html?#transaction-basics).
 *
 * You should never create transactions directly. Instead, open a database and
 * call `await db.doTn(async tn => {...})`.
 *
 * ```javascript
 * const db = fdb.open()
 * const val = await db.doTn(async tn => {
 *   // Use the transaction in this block. The transaction will be automatically
 *   // committed (and potentially retried) after this block returns.
 *   tn.set('favorite color', 'hotpink')
 *   return await tn.get('another key')
 * })
 * ```
 *
 * ---
 *
 * This class has 4 template parameters - which is kind of messy. They're used
 * to make the class typesafe in the face of key and value transformers. These
 * parameters should be automatically inferred, but sometimes you will need to
 * specify them explicitly. They are:
 *
 * @param KeyIn The type for keys passed by the user into functions (eg `get(k:
 * KeyIn)`). Defaults to string | Buffer. Change this by scoping the transaction
 * with a subspace with a key transformer. Eg
 * `txn.at(fdb.root.withKeyEncoding(fdb.tuple)).get([1, 2, 3])`.
 * @param KeyOut The type of keys returned by methods which return keys - like
 * `getKey(..) => Promise<KeyOut?>`. Unless you have a KV transformer, this will
 * be Buffer.
 * @param ValIn The type of values passed into transaction functions, like
 * `txn.set(key, val: ValIn)`. By default this is string | Buffer. Override this
 * by applying a value transformer to your subspace.
 * @param ValOut The type of database values returned by functions. Eg,
 * `txn.get(...) => Promise<ValOut | undefined>`. Defaults to Buffer, but if you
 * apply a value transformer this will change.
 */
export default class Transaction<KeyIn = NativeValue, KeyOut = Buffer, ValIn = NativeValue, ValOut = Buffer> {
    isSnapshot: boolean;
    subspace: Subspace<KeyIn, KeyOut, ValIn, ValOut>;
    private _ctx;
    get context(): object;
    /**
     * Set options on the transaction object. These options can have a variety of
     * effects - see TransactionOptionCode for details. For options which are
     * persistent on the transaction, its recommended to set the option when the
     * transaction is constructed.
     *
     * Note that options are shared between a transaction object and any aliases
     * of the transaction object (eg in other scopes or from `txn.snapshot()`).
     */
    setOption(opt: TransactionOptionCode, value?: number | string | Buffer): void;
    /**
     * Returns a shallow copy of the transaction object which does snapshot reads.
     */
    snapshot(): Transaction<KeyIn, KeyOut, ValIn, ValOut>;
    /**
     * Create a shallow copy of the transaction in the specified subspace (or database, transaction, or directory).
    */
    at<CKI, CKO, CVI, CVO>(hasSubspace: GetSubspace<CKI, CKO, CVI, CVO>): Transaction<CKI, CKO, CVI, CVO>;
    /** @deprecated - use transaction.at(db) instead. */
    scopedTo<CKI, CKO, CVI, CVO>(db: Database<CKI, CKO, CVI, CVO>): Transaction<CKI, CKO, CVI, CVO>;
    /** Get the current subspace */
    getSubspace(): Subspace<KeyIn, KeyOut, ValIn, ValOut>;
    /**
     * This uses the raw API to commit a transaction. 99% of users shouldn't touch this, and should instead use `db.doTn(async tn => {...})`, which will automatically commit the transaction and retry if necessary.
     */
    rawCommit(): Promise<void>;
    /** @deprecated - Use promises API instead. */
    rawCommit(cb: Callback<void>): void;
    rawReset(): void;
    rawCancel(): void;
    rawOnError(code: number): Promise<void>;
    /** @deprecated - Use promises API instead. */
    rawOnError(code: number, cb: Callback<void>): void;
    /**
     * Get the value for the specified key in the database.
     *
     * @returns the value for the specified key, or `undefined` if the key does
     * not exist in the database.
     */
    get(key: KeyIn): Promise<ValOut | undefined>;
    /** @deprecated - Use promises API instead. */
    get(key: KeyIn, cb: Callback<ValOut | undefined>): void;
    /** Checks if the key exists in the database. This is just a shorthand for
     * tn.get() !== undefined.
     */
    exists(key: KeyIn): Promise<boolean>;
    /**
     * Find and return the first key which matches the specified key selector
     * inside the given subspace. Returns undefined if no key matching the
     * selector falls inside the current subspace.
     *
     * If you pass a key instead of a selector, this method will find the first
     * key >= the specified key. Aka `getKey(someKey)` is the equivalent of
     * `getKey(keySelector.firstGreaterOrEqual(somekey))`.
     *
     * Note that this method is a little funky in the root subspace:
     *
     * - We cannot differentiate between "no smaller key found" and "found the
     *   empty key ('')". To make the API more consistent, we assume you aren't
     *   using the empty key in your dataset.
     * - If your key selector looks forward in the dataset, this method may find
     *   and return keys in the system portion (starting with '\xff').
     */
    getKey(_sel: KeySelector<KeyIn> | KeyIn): Promise<KeyOut | undefined>;
    /** Set the specified key/value pair in the database */
    set(key: KeyIn, val: ValIn): void;
    /** Remove the value for the specified key */
    clear(key: KeyIn): void;
    /** Alias for `tn.clear()` to match semantics of javascripts Map/Set/etc classes */
    delete(key: KeyIn): void;
    private _encodeRangeResult;
    getRangeNative(start: KeySelector<NativeValue>, end: KeySelector<NativeValue> | null, // If not specified, start is used as a prefix.
    limit: number, targetBytes: number, streamingMode: StreamingMode, iter: number, reverse: boolean): Promise<KVList<Buffer, Buffer>>;
    getRangeRaw(start: KeySelector<KeyIn>, end: KeySelector<KeyIn> | null, limit: number, targetBytes: number, streamingMode: StreamingMode, iter: number, reverse: boolean): Promise<KVList<KeyOut, ValOut>>;
    getEstimatedRangeSizeBytes(start?: KeyIn, end?: KeyIn): Promise<number>;
    getRangeSplitPoints(start: KeyIn | undefined, end: KeyIn | undefined, chunkSize: number): Promise<KeyOut[]>;
    getRangeBatchNative(start: KeySelector<NativeValue>, end: KeySelector<NativeValue>, { limit, reverse, streamingMode }?: RangeOptions): AsyncGenerator<[KeyOut, ValOut][], void, unknown>;
    /**
     * This method is functionally the same as *getRange*, but values are returned
     * in the batches they're delivered in from the database. This method is
     * present because it may be marginally faster than `getRange`.
     *
     * Example:
     *
     * ```
     * for await (const batch of tn.getRangeBatch(0, 1000)) {
     *   for (let k = 0; k < batch.length; k++) {
     *     const [key, val] = batch[k]
     *     // ...
     *   }
     * }
     * ```
     *
     * @see Transaction.getRange
     */
    getRangeBatch(start?: KeyIn | KeySelector<undefined | KeyIn>, end?: KeyIn | KeySelector<undefined | KeyIn>, opts?: RangeOptions): AsyncGenerator<[KeyOut, ValOut][], void, unknown>;
    /**
     * This method is similar to *getRangeBatch*, but performs a query
     * on a key range specified by `prefix` instead of start and end.
     *
     * @see Transaction.getRangeBatch
     */
    getRangeBatchStartsWith(prefix: KeyIn | KeySelector<KeyIn>, opts?: RangeOptions): AsyncGenerator<[KeyOut, ValOut][], void, unknown>;
    /**
     * Get all key value pairs within the specified range. This method returns an
     * async generator, which can be iterated over in a `for await(...)` loop like
     * this:
     *
     * ```
     * for await (const [key, value] of tn.getRange('a', 'z')) {
     *  // ...
     * }
     * ```
     *
     * The values will be streamed from the database as they are read.
     *
     * Key value pairs will be yielded in the order they are present in the
     * database - from lowest to highest key. (Or the reverse order if
     * `reverse:true` is set in options).
     *
     * Note that transactions are [designed to be short
     * lived](https://apple.github.io/foundationdb/developer-guide.html?#long-running-transactions),
     * and will error if the read operation takes more than 5 seconds.
     *
     * The end of the range is optional. If missing, this method will use the
     * first parameter as a prefix and fetch all key value pairs starting with
     * that key.
     *
     * The start or the end can be specified using KeySelectors instead of raw
     * keys in order to specify offsets and such.
     *
     * getRange also takes an optional extra options object parameter. Valid
     * options are:
     *
     * - **limit:** (number) Maximum number of items returned by the call to
     *   getRange
     * - **reverse:** (boolean) Flag to reverse the iteration, and instead search
     *   from `end` to `start`. Key value pairs will be returned from highest key
     *   to lowest key.
     * - **streamingMode:** (enum StreamingMode) *(rarely used)* The policy for
     *   how eager FDB should be about prefetching data. See enum StreamingMode in
     *   opts.
     */
    getRange(start?: KeyIn | KeySelector<undefined | KeyIn>, end?: KeyIn | KeySelector<undefined | KeyIn>, opts?: RangeOptions): AsyncGenerator<[KeyOut, ValOut], void, unknown>;
    /**
     * This method is similar to *getRange*, but performs a query
     * on a key range specified by `prefix` instead of start and end.
     *
     * @see Transaction.getRange
     */
    getRangeStartsWith(prefix: KeyIn | KeySelector<KeyIn>, opts?: RangeOptions): AsyncGenerator<[KeyOut, ValOut], void, unknown>;
    /**
     * Same as getRange, but prefetches and returns all values in an array rather
     * than streaming the values over the wire. This is often more convenient, and
     * makes sense when dealing with a small range.
     *
     * @see Transaction.getRange
     *
     * @returns array of [key, value] pairs
     */
    getRangeAll(start?: KeyIn | KeySelector<undefined | KeyIn>, end?: KeyIn | KeySelector<undefined | KeyIn>, opts?: RangeOptions): Promise<[KeyOut, ValOut][]>;
    /**
     * This method is similar to *getRangeAll*, but performs a query
     * on a key range specified by `prefix` instead of start and end.
     *
     * @see Transaction.getRangeAll
     */
    getRangeAllStartsWith(prefix: KeyIn | KeySelector<KeyIn>, opts?: RangeOptions): Promise<[KeyOut, ValOut][]>;
    /**
     * Removes all key value pairs from the database in between start and end.
     *
     * @param start Start of the range. If unspecified, the start of the keyspace is assumed.
     * @param end End of the range. If unspecified, the inclusive end of the keyspace is assumed.
     */
    clearRange(start?: KeyIn, end?: KeyIn): void;
    /**
     * This method is similar to *clearRange*, but performs the operation
     * on a key range specified by `prefix` instead of start and end.
     *
     * @see Transaction.clearRange
     */
    clearRangeStartsWith(prefix: KeyIn): void;
    watch(key: KeyIn, opts?: WatchOptions): Watch;
    addReadConflictRange(start?: KeyIn, end?: KeyIn): void;
    addReadConflictRangeStartsWith(prefix: KeyIn): void;
    addReadConflictKey(key: KeyIn): void;
    addWriteConflictRange(start?: KeyIn, end?: KeyIn): void;
    addWriteConflictRangeStartsWith(prefix: KeyIn): void;
    addWriteConflictKey(key: KeyIn): void;
    setReadVersion(v: Version): void;
    /** Get the database version used to perform reads in this transaction. */
    getReadVersion(): Promise<Version>;
    /** @deprecated - Use promises API instead. */
    getReadVersion(cb: Callback<Version>): void;
    getCommittedVersion(): Buffer;
    getVersionstamp(): {
        promise: Promise<Buffer>;
    };
    /** @deprecated - Use promises API instead. */
    getVersionstamp(cb: Callback<Buffer>): void;
    getAddressesForKey(key: KeyIn): string[];
    atomicOpNative(opType: MutationType, key: NativeValue, oper: NativeValue): void;
    atomicOpKB(opType: MutationType, key: KeyIn, oper: Buffer): void;
    atomicOp(opType: MutationType, key: KeyIn, oper: ValIn): void;
    /**
     * Does little-endian addition on encoded values. Value transformer should encode to some
     * little endian type.
     */
    add(key: KeyIn, oper: ValIn): void;
    max(key: KeyIn, oper: ValIn): void;
    min(key: KeyIn, oper: ValIn): void;
    bitAnd(key: KeyIn, oper: ValIn): void;
    bitOr(key: KeyIn, oper: ValIn): void;
    bitXor(key: KeyIn, oper: ValIn): void;
    bitAndBuf(key: KeyIn, oper: Buffer): void;
    bitOrBuf(key: KeyIn, oper: Buffer): void;
    bitXorBuf(key: KeyIn, oper: Buffer): void;
    byteMin(key: KeyIn, val: ValIn): void;
    byteMax(key: KeyIn, val: ValIn): void;
    getNextTransactionID(): number;
    private _bakeCode;
    setVersionstampedKeyRaw(keyBytes: Buffer, value: ValIn): void;
    setVersionstampedKeyBuf(prefix: Buffer | undefined, suffix: Buffer | undefined, value: ValIn): void;
    private _addBakeItem;
    setVersionstampedKey(key: KeyIn, value: ValIn, bakeAfterCommit?: boolean): void;
    setVersionstampSuffixedKey(key: KeyIn, value: ValIn, suffix?: Buffer): void;
    setVersionstampedValueRaw(key: KeyIn, value: Buffer): void;
    setVersionstampedValue(key: KeyIn, value: ValIn, bakeAfterCommit?: boolean): void;
    /**
     * Set key = [10 byte versionstamp, value in bytes]. This function leans on
     * the value transformer to pack & unpack versionstamps. An extra value
     * prefix is only supported on API version 520+.
     */
    setVersionstampPrefixedValue(key: KeyIn, value?: ValIn, prefix?: Buffer): void;
    /**
     * Helper to get the specified key and split out the stamp and value pair.
     * This requires that the stamp is at offset 0 (the start) of the value.
     * This is designed to work with setVersionstampPrefixedValue. If you're
     * using setVersionstampedValue with tuples, just call get().
     */
    getVersionstampPrefixedValue(key: KeyIn): Promise<{
        stamp: Buffer;
        value?: ValOut;
    } | null>;
    getApproximateSize(): Promise<number>;
}
