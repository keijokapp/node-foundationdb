// @ts-check

import keySelector from './keySelector.js'
import { MutationType, StreamingMode, TransactionOptionCode } from './opts.g.js'
import Subspace from './subspace.js'
import { asBuf, strInc, strNext } from './util.js'
import {packVersionstamp, packVersionstampPrefixSuffix} from './versionstamp.js'

/**
 * @typedef {{
 *   streamingMode?: undefined | StreamingMode, // defaults to Iterator for batch mode, WantAll for getRangeAll.
 *   limit?: undefined | number,
 *   reverse?: undefined | boolean
 * }} RangeOptionsBatch
 * @typedef {RangeOptionsBatch & { targetBytes?: undefined | number }} RangeOptions
 */
/**
 * @template Key, Value
 * @typedef {{
 *   results: [Key, Value][], // [key, value] pair.
 *   more: boolean,
 * }} KVList
 */
/**
 * @typedef {import('./native.js').Watch} Watch
 * @typedef {{
 *   throwAllErrors?: undefined | boolean
 * }} WatchOptions
 */

const doNothing = () => {}

/**
 * @private
 * @template T
 * @typedef {{
 *   code: Buffer | undefined
 *   item: T
 *   transformer: import('./transformer.js').Transformer<T, any>
 * }} BakeItem
 */
/**
 * This scope object is shared by the family of transaction objects made with .scope().
 * @private
 * @typedef {{
 *   invalid?: true
 *   nextCode: number
 *   toBake?: BakeItem<any>[]
 * }} TxnCtx
 */

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
 * @template [KeyIn=import('./native.js').NativeValue] The type for keys passed by the user into functions (eg `get(k:
 * KeyIn)`). Defaults to string | Buffer. Change this by scoping the transaction
 * with a subspace with a key transformer. Eg
 * `txn.at(fdb.root.withKeyEncoding(fdb.encoders.tuple)).get([1, 2, 3])`.
 * @template [KeyOut=Buffer] The type of keys returned by methods which return keys - like
 * `getKey(..) => Promise<KeyOut?>`. Unless you have a KV transformer, this will
 * be Buffer.
 * @template [ValIn=import('./native.js').NativeValue] The type of values passed into transaction functions, like
 * `txn.set(key, val: ValIn)`. By default this is string | Buffer. Override this
 * by applying a value transformer to your subspace.
 * @template [ValOut=Buffer] The type of database values returned by functions. Eg,
 * `txn.get(...) => Promise<ValOut | undefined>`. Defaults to Buffer, but if you
 * apply a value transformer this will change.
 */
export default class Transaction {
  /**
   * NOTE: Do not call this directly. Instead transactions should be created
   * via db.doTn(...)
   *
   * @internal
   * @param {import('./native.js').NativeTransaction} tn
   * @param {boolean} snapshot
   * @param {Subspace<KeyIn, KeyOut, ValIn, ValOut>} subspace
   * @param {TxnCtx} [ctx]
   */
  constructor(tn, snapshot, subspace, ctx) {
    /**
     * @private
     * @type {import('./native.js').NativeTransaction}
     */
    this._tn = tn

    /** @type {boolean} */
    this.isSnapshot = snapshot

    /** @type {Subspace<KeyIn, KeyOut, ValIn, ValOut>} */
    this.subspace = subspace

    /**
     * @private
     * @type {TxnCtx}
     */
    this._ctx = ctx ?? {
      nextCode: 0
    }
  }

  /** @type {object} */
  get context() {
    return this._ctx;
  }

  /** @internal */
  _assertValid() {
    if (this._ctx.invalid) {
      throw new Error('Transaction is invalid')
    }
  }

  /** @internal */
  _invalidate() {
    this._ctx.invalid = true;
  }

  /**
   * @internal
   * @template T
   * @param {(tn: Transaction<KeyIn, KeyOut, ValIn, ValOut>) => Promise<T>} body
   * @returns {Promise<T>}
   */
  async _exec(body) {
    const result = await body(this)

    const stampPromise = this._ctx.toBake?.length
      ? this.getVersionstamp()
      : undefined

    await this.rawCommit()

    if (stampPromise) {
      const stamp = await stampPromise.promise;

      /** @type {NonNullable<BakeItem<any>[]>} */(this._ctx.toBake).forEach(({item, transformer, code}) => (
        /** @type {NonNullable<typeof transformer.bakeVersionstamp>} */(transformer.bakeVersionstamp)(item, stamp, code))
      )
    }

    return result
  }

  /**
   * Set options on the transaction object. These options can have a variety of
   * effects - see TransactionOptionCode for details. For options which are
   * persistent on the transaction, its recommended to set the option when the
   * transaction is constructed.
   *
   * Note that options are shared between a transaction object and any aliases
   * of the transaction object (eg in other scopes or from `txn.snapshot()`).
   *
   * @param {TransactionOptionCode} opt
   * @param {number | string | Buffer} [value]
   */
  setOption(opt, value) {
    this._assertValid()

    // TODO: Check type of passed option is valid.
    this._tn.setOption(opt, value ?? null)
  }

  /**
   * @returns {Transaction<KeyIn, KeyOut, ValIn, ValOut>} A shallow copy of the transaction object which does snapshot reads.
   */
  snapshot() {
    return new Transaction(this._tn, true, this.subspace, this._ctx)
  }

  /**
   * @template CKI, CKO, CVI, CVO
   * @param {import('./subspace.js').GetSubspace<CKI, CKO, CVI, CVO>} hasSubspace
   * @returns {Transaction<CKI, CKO, CVI, CVO>} A shallow copy of the transaction in the specified subspace (or database, transaction, or directory).
   */
  at(hasSubspace) {
    return /** @type {Transaction<CKI, CKO, CVI, CVO>} */(new Transaction(this._tn, this.isSnapshot, hasSubspace.getSubspace(), this._ctx))
  }

  /** Get the current subspace */
  getSubspace() { return this.subspace }

  // You probably don't want to call any of these functions directly. Instead call db.transact(async tn => {...}).

  /**
   * This uses the raw API to commit a transaction. 99% of users shouldn't touch this, and should instead use `db.doTn(async tn => {...})`, which will automatically commit the transaction and retry if necessary.
   *
   * @returns {Promise<void>}
   */
  rawCommit() {
    this._assertValid()

    return this._tn.commit()
  }

  rawReset() {
    this._assertValid()
    this._tn.reset()
  }

  rawCancel() {
    this._assertValid()
    this._tn.cancel()
  }

  /**
   * @param {number} code
   * @returns {Promise<void>}
   */
  rawOnError(code) {
    this._assertValid()

    return this._tn.onError(code)
  }

  /**
   * Get the value for the specified key in the database.
   *
   * @param {KeyIn} key
   * @returns {Promise<ValOut | undefined>} the value for the specified key, or `undefined` if the key does
   * not exist in the database.
   */
  get(key) {
    this._assertValid()

    const keyBuf = this.subspace.packKey(key)

    return this._tn.get(keyBuf, this.isSnapshot)
      .then(val => val !== undefined ? this.subspace.unpackValue(val) : undefined)
  }

  /**
   * Checks if the key exists in the database. This is just a shorthand for
   * tn.get() !== undefined.
   *
   * @param {KeyIn} key
   * @returns {Promise<boolean>}
   */
  exists(key) {
    this._assertValid()

    const keyBuf = this.subspace.packKey(key)
    return this._tn.get(keyBuf, this.isSnapshot).then(val => val != undefined)
  }

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
   *
   * @param {import('./keySelector.js').KeySelector<KeyIn> | KeyIn} _sel
   * @returns {Promise<KeyOut | undefined>}
   */
  getKey(_sel) {
    this._assertValid()

    const sel = keySelector.from(_sel)
    return this._tn.getKey(this.subspace.packKey(sel.key), sel.orEqual, sel.offset, this.isSnapshot)
      .then(key => (
        (key.length === 0 || !this.subspace.contains(key))
          ? undefined
          : this.subspace.unpackKey(key)
      ))
  }

  /**
   * Set the specified key/value pair in the database
   *
   * @param {KeyIn} key
   * @param {ValIn} val
   */
  set(key, val) {
    this._assertValid()

    this._tn.set(this.subspace.packKey(key), this.subspace.packValue(val))
  }

  /**
   * Remove the value for the specified key
   *
   * @param {KeyIn} key
   */
  clear(key) {
    this._assertValid()

    const pack = this.subspace.packKey(key)
    this._tn.clear(pack)
  }

  /**
   * Alias for `tn.clear()` to match semantics of javascripts Map/Set/etc classes
   *
   * @param {KeyIn} key
   */
  delete(key) {
    return this.clear(key)
  }

  /**
   * This just destructively edits the result in-place.
   *
   * @private
   * @param {[Buffer, Buffer][]} r
   * @returns {[KeyOut, ValOut][]}
   */
  _encodeRangeResult(r) {
    // This is slightly faster but I have to throw away the TS checks in the process. :/
    for (let i = 0; i < r.length; i++) {
      ;/** @type {any} */(r)[i][0] = this.subspace.unpackKey(r[i][0])
      ;/** @type {any} */(r)[i][1] = this.subspace.unpackValue(r[i][1])
    }
    return /** @type {[KeyOut, ValOut][]} */(r)
  }

  /**
   * @param {import('./keySelector.js').KeySelector<import('./native.js').NativeValue>} start
   * @param {import('./keySelector.js').KeySelector<import('./native.js').NativeValue> | undefined} end
   * @param {number} limit
   * @param {number} targetBytes
   * @param {StreamingMode} streamingMode
   * @param {number} iter
   * @param {boolean} reverse
   * @returns {Promise<import('./native.js').KVList<Buffer, Buffer>>}
   */
  getRangeNative(start, end, limit, targetBytes, streamingMode, iter, reverse)  {
    this._assertValid()

    const _end = end != null ? end : keySelector.firstGreaterOrEqual(strInc(start.key))
    return this._tn.getRange(
      start.key, start.orEqual, start.offset,
      _end.key, _end.orEqual, _end.offset,
      limit, targetBytes, streamingMode,
      iter, this.isSnapshot, reverse)
  }

  /**
   * @param {import('./keySelector.js').KeySelector<KeyIn>} start
   * @param {import('./keySelector.js').KeySelector<KeyIn> | undefined} end
   * @param {number} limit
   * @param {number} targetBytes
   * @param {StreamingMode} streamingMode
   * @param {number} iter
   * @param {boolean} reverse
   * @returns {Promise<import('./native.js').KVList<KeyOut, ValOut>>}
   */
  getRangeRaw(start, end, limit, targetBytes, streamingMode, iter, reverse) {
    return this.getRangeNative(
      keySelector(this.subspace.packKey(start.key), start.orEqual, start.offset),
      end != null ? keySelector(this.subspace.packKey(end.key), end.orEqual, end.offset) : undefined,
      limit, targetBytes, streamingMode, iter, reverse)
    .then(r => ({more: r.more, results: this._encodeRangeResult(r.results)}))
  }

  /**
   * @param {KeyIn} [start]
   * @param {KeyIn} [end]
   * @returns {Promise<number>}
   */
  getEstimatedRangeSizeBytes(start, end) {
    this._assertValid()

    const range = this.subspace.packRange(start, end)

    return this._tn.getEstimatedRangeSizeBytes(range.begin, range.end)
  }

  /**
   * @param {KeyIn | undefined} start
   * @param {KeyIn | undefined} end
   * @param {number} chunkSize
   * @returns {Promise<KeyOut[]>}
   */
  getRangeSplitPoints(start, end, chunkSize) {
    this._assertValid()

    const range = this.subspace.packRange(start, end)

    return this._tn.getRangeSplitPoints(range.begin, range.end, chunkSize).then(results => (
      results.map(r => this.subspace.unpackKey(r))
    ))
  }

  /**
   * @param {import('./keySelector.js').KeySelector<import('./native.js').NativeValue>} start
   * @param {import('./keySelector.js').KeySelector<import('./native.js').NativeValue>} end
   * @param {RangeOptions} opts
   */
  async *getRangeBatchNative(
    start,
    end,
    {
      limit = 0,
      reverse = false,
      streamingMode = StreamingMode.Iterator
    } = {}
  ) {
    let iter = 0

    while (1) {
      const { results, more } = await this.getRangeNative(
        start,
        end,
        limit,
        0,
        streamingMode,
        ++iter,
        reverse
      )

      if (results.length) {
        if (!reverse) start = keySelector.firstGreaterThan(results[results.length-1][0])
        else end = keySelector.firstGreaterOrEqual(results[results.length-1][0])
      }

      // This destructively consumes results.
      yield this._encodeRangeResult(results)
      if (!more) break

      if (limit) {
        limit -= results.length
        if (limit <= 0) break
      }
    }
  }

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
   *
   * @param {KeyIn | import('./keySelector.js').KeySelector<undefined | KeyIn>} [start]
   * @param {KeyIn | import('./keySelector.js').KeySelector<undefined | KeyIn>} [end]
   * @param {RangeOptions} [opts]
   */
  getRangeBatch(start, end, opts = {}) {
    const startSelector = keySelector.from(start)
    const endSelector = keySelector.from(end)
    const range = this.subspace.packRange(startSelector.key, endSelector.key)

    return this.getRangeBatchNative(
      keySelector(range.begin, startSelector.orEqual, startSelector.offset),
      keySelector(range.end, endSelector.orEqual, endSelector.offset),
      opts
    )
  }

  /**
   * This method is similar to *getRangeBatch*, but performs a query
   * on a key range specified by `prefix` instead of start and end.
   *
   * @see Transaction.getRangeBatch
   *
   * @param {KeyIn | import('./keySelector.js').KeySelector<KeyIn>} prefix
   * @param {RangeOptions} [opts]
   */
  getRangeBatchStartsWith(prefix, opts) {
    const prefixSelector = keySelector.from(prefix)
    const range = this.subspace.packRangeStartsWith(prefixSelector.key)

    return this.getRangeBatchNative(
      keySelector(range.begin, prefixSelector.orEqual, prefixSelector.offset),
      keySelector.firstGreaterOrEqual(range.end),
      opts
    )
  }

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
   *
   * @param {KeyIn | import('./keySelector.js').KeySelector<undefined | KeyIn>} [start]
   * @param {KeyIn | import('./keySelector.js').KeySelector<undefined | KeyIn>} [end]
   * @param {RangeOptions} [opts]
   */
  async *getRange(start, end, opts) {
    for await (const batch of this.getRangeBatch(start, end, opts)) {
      for (const pair of batch) yield pair
    }
  }

  /**
   * This method is similar to *getRange*, but performs a query
   * on a key range specified by `prefix` instead of start and end.
   *
   * @see Transaction.getRange
   *
   * @param {KeyIn | import('./keySelector.js').KeySelector<KeyIn>} prefix
   * @param {RangeOptions} [opts]
   */
  async *getRangeStartsWith(prefix, opts) {
    for await (const batch of this.getRangeBatchStartsWith(prefix, opts)) {
      for (const pair of batch) yield pair
    }
  }

  /**
   * Same as getRange, but prefetches and returns all values in an array rather
   * than streaming the values over the wire. This is often more convenient, and
   * makes sense when dealing with a small range.
   *
   * @see Transaction.getRange
   *
   * @param {KeyIn | import('./keySelector.js').KeySelector<undefined | KeyIn>} [start]
   * @param {KeyIn | import('./keySelector.js').KeySelector<undefined | KeyIn>} [end]
   * @param {RangeOptions} [opts]
   * @returns {Promise<[KeyOut, ValOut][]>} array of [key, value] pairs
   */
  async getRangeAll(start, end, opts) {
    /** @type {RangeOptions} */
    const childOpts = opts?.streamingMode == null
      ? { ...opts, streamingMode: StreamingMode.WantAll }
      : opts

    /** @type {[KeyOut, ValOut][]} */
    const result = []

    for await (const batch of this.getRangeBatch(start, end, childOpts)) {
      result.push(...batch)
    }

    return result
  }

  /**
   * This method is similar to *getRangeAll*, but performs a query
   * on a key range specified by `prefix` instead of start and end.
   *
   * @see Transaction.getRangeAll
   *
   * @param {KeyIn | import('./keySelector.js').KeySelector<KeyIn>} prefix
   * @param {RangeOptions} [opts]
   * @returns {Promise<[KeyOut, ValOut][]>} array of [key, value] pairs
   */
  async getRangeAllStartsWith(prefix, opts) {
    /** @type {RangeOptions} */
    const childOpts = opts?.streamingMode == null
      ? { ...opts, streamingMode: StreamingMode.WantAll }
      : opts

    /** @type {[KeyOut, ValOut][]} */
    const result = []

    for await (const batch of this.getRangeBatchStartsWith(prefix, childOpts)) {
      result.push(...batch)
    }

    return result
  }

  /**
   * Removes all key value pairs from the database in between start and end.
   *
   * @param {KeyIn} [start] Start of the range. If unspecified, the start of the keyspace is assumed.
   * @param {KeyIn} [end] End of the range. If unspecified, the inclusive end of the keyspace is assumed.
   */
  clearRange(start, end) {
    this._assertValid()

    const range = this.subspace.packRange(start, end)

    this._tn.clearRange(range.begin, range.end)
  }

  /**
   * This method is similar to *clearRange*, but performs the operation
   * on a key range specified by `prefix` instead of start and end.
   *
   * @see Transaction.clearRange
   *
   * @param {KeyIn} prefix
   */
  clearRangeStartsWith(prefix) {
    this._assertValid()

    const range = this.subspace.packRangeStartsWith(prefix)

    this._tn.clearRange(range.begin, range.end)
  }

  /**
   * @param {KeyIn} key
   * @param {WatchOptions} [opts]
   * @returns {import('./native.js').Watch}
   */
  watch(key, opts) {
    this._assertValid()

    const throwAll = opts && opts.throwAllErrors
    const watch = this._tn.watch(this.subspace.packKey(key), !throwAll)
    // Suppress the global unhandledRejection handler when a watch errors
    watch.promise.catch(doNothing)

    return watch
  }

  /**
   * @param {KeyIn} [start]
   * @param {KeyIn} [end]
   */
  addReadConflictRange(start, end) {
    this._assertValid()

    const range = this.subspace.packRange(start, end)
    this._tn.addReadConflictRange(range.begin, range.end)
  }

  /**
   * @param {KeyIn} prefix
   */
  addReadConflictRangeStartsWith(prefix) {
    this._assertValid()

    const range = this.subspace.packRangeStartsWith(prefix)
    this._tn.addReadConflictRange(range.begin, range.end)
  }

  /**
   * @param {KeyIn} key
   */
  addReadConflictKey(key) {
    this._assertValid()

    const keyBuf = this.subspace.packKey(key)
    this._tn.addReadConflictRange(keyBuf, strNext(keyBuf))
  }

  /**
   * @param {KeyIn} [start]
   * @param {KeyIn} [end]
   */
  addWriteConflictRange(start, end) {
    this._assertValid()

    const range = this.subspace.packRange(start, end)
    this._tn.addWriteConflictRange(range.begin, range.end)
  }

  /**
   * @param {KeyIn} prefix
   */
  addWriteConflictRangeStartsWith(prefix) {
    this._assertValid()

    const range = this.subspace.packRangeStartsWith(prefix)
    this._tn.addWriteConflictRange(range.begin, range.end)
  }

  /**
   * @param {KeyIn} key
   */
  addWriteConflictKey(key) {
    this._assertValid()

    const keyBuf = this.subspace.packKey(key)
    this._tn.addWriteConflictRange(keyBuf, strNext(keyBuf))
  }

  /**
   * @param {import('./native.js').Version} v 8-byte version
   */
  setReadVersion(v) {
    this._assertValid()

    this._tn.setReadVersion(v)
  }

  /**
   * Get the database version used to perform reads in this transaction.
   *
   * @returns {Promise<import('./native.js').Version>}
   */
  getReadVersion() {
    this._assertValid()

    return this._tn.getReadVersion()
  }

  /**
   * @returns {import('./native.js').Version}
   */
  getCommittedVersion() {
    this._assertValid()

    return this._tn.getCommittedVersion()
  }

  /**
   * Note: This promise can't be directly returned via the return value of a
   * transaction.
   *
   * @returns {{promise: Promise<Buffer>}}
   */
  getVersionstamp() {
    this._assertValid()

    // This one is surprisingly tricky:
    //
    // - If we return the promise as normal, you'll deadlock if you try to
    //   return it via your async tn function (since JS automatically
    //   flatmaps promises)
    // - Also if the tn conflicts, this promise will also generate an error.
    //   By default node will crash your program when it sees this error.
    //   We'll allow the error naturally, but suppress node's default
    //   response by adding an empty catch function
    const promise = this._tn.getVersionstamp()
    promise.catch(doNothing)
    return {promise}
  }

  /**
   * @param {KeyIn} key
   * @returns {string[]}
   */
  getAddressesForKey(key) {
    this._assertValid()

    return this._tn.getAddressesForKey(this.subspace.packKey(key))
  }

  // **** Atomic operations

  /**
   * @param {MutationType} opType
   * @param {import('./native.js').NativeValue} key
   * @param {import('./native.js').NativeValue} oper
   */
  atomicOpNative(opType, key, oper) {
    this._assertValid()
    this._tn.atomicOp(opType, key, oper)
  }
  /**
   * @param {MutationType} opType
   * @param {KeyIn} key
   * @param {Buffer} oper
   */
  atomicOpKB(opType, key, oper) {
    this._assertValid()
    this._tn.atomicOp(opType, this.subspace.packKey(key), oper)
  }
  /**
   * @param {MutationType} opType
   * @param {KeyIn} key
   * @param {ValIn} oper
   */
  atomicOp(opType, key, oper) {
    this._assertValid()
    this._tn.atomicOp(opType, this.subspace.packKey(key), this.subspace.packValue(oper))
  }

  /**
   * Does little-endian addition on encoded values. Value transformer should encode to some
   * little endian type.
   */
  /**
   * @param {KeyIn} key
   * @param {ValIn} oper
   */
  add(key, oper) { this.atomicOp(MutationType.Add, key, oper) }

  /**
   * @param {KeyIn} key
   * @param {ValIn} oper
   */
  max(key, oper) { this.atomicOp(MutationType.Max, key, oper) }

  /**
   * @param {KeyIn} key
   * @param {ValIn} oper
   */
  min(key, oper) { this.atomicOp(MutationType.Min, key, oper) }

  // Raw buffer variants are provided here to support fancy bit packing semantics.
  /**
   * @param {KeyIn} key
   * @param {ValIn} oper
   */
  bitAnd(key, oper) { this.atomicOp(MutationType.BitAnd, key, oper) }

  /**
   * @param {KeyIn} key
   * @param {ValIn} oper
   */
  bitOr(key, oper) { this.atomicOp(MutationType.BitOr, key, oper) }

  /**
   * @param {KeyIn} key
   * @param {ValIn} oper
   */
  bitXor(key, oper) { this.atomicOp(MutationType.BitXor, key, oper) }

  /**
   * @param {KeyIn} key
   * @param {Buffer} oper
   */
  bitAndBuf(key, oper) { this.atomicOpKB(MutationType.BitAnd, key, oper) }

  /**
   * @param {KeyIn} key
   * @param {Buffer} oper
   */
  bitOrBuf(key, oper) { this.atomicOpKB(MutationType.BitOr, key, oper) }

  /**
   * @param {KeyIn} key
   * @param {Buffer} oper
   */
  bitXorBuf(key, oper) { this.atomicOpKB(MutationType.BitXor, key, oper) }

  /**
   * Performs lexicographic comparison of byte strings. Sets the value in the
   * database to the lexographical min of its current value and the value
   * supplied as a parameter. If the key does not exist in the database this is
   * the same as set().
   *
   * @param {KeyIn} key
   * @param {ValIn} val
   */
  byteMin(key, val) { this.atomicOp(MutationType.ByteMin, key, val) }

  /**
   * Performs lexicographic comparison of byte strings. Sets the value in the
   * database to the lexographical max of its current value and the value
   * supplied as a parameter. If the key does not exist in the database this is
   * the same as set().
   *
   * @param {KeyIn} key
   * @param {ValIn} val
   */
  byteMax(key, val) { this.atomicOp(MutationType.ByteMax, key, val) }

  // **** Version stamp stuff

  getNextTransactionID() { return this._ctx.nextCode++ }

  /**
   * @private
   * @param {import('./versionstamp.js').UnboundStamp} into
   * @returns {Buffer | undefined}
   */
  _bakeCode(into) {
    if (this.isSnapshot) throw new Error('Cannot use this method in a snapshot transaction')
    if (into.codePos != null) {
      // We edit the buffer in-place but leave the codepos as is so if the txn
      // retries it'll overwrite the code.
      const id = this.getNextTransactionID()
      if (id > 0xffff) throw new Error('Cannot use more than 65536 unique versionstamps in a single transaction. Either split your writes into multiple transactions or add explicit codes to your unbound versionstamps')
      into.data.writeInt16BE(id, into.codePos)
      return into.data.subarray(into.codePos, into.codePos+2)
    }
  }

  /**
   * @param {Buffer} keyBytes
   * @param {ValIn} value
   */
  setVersionstampedKeyRaw(keyBytes, value) {
    this.atomicOpNative(MutationType.SetVersionstampedKey, keyBytes, this.subspace.packValue(value))
  }

  /**
   * This sets the key [prefix, 10 bytes versionstamp, suffix] to value.
   *
   * @param {Buffer | undefined} prefix
   * @param {Buffer | undefined} suffix
   * @param {ValIn} value
   */
  setVersionstampedKeyBuf(prefix, suffix, value) {
    const key = packVersionstampPrefixSuffix(prefix, suffix, true)
    this.atomicOpNative(MutationType.SetVersionstampedKey, key, this.subspace.packValue(value))
  }

  /**
   * @private
   * @template T
   * @param {T} item
   * @param {import('./transformer.js').Transformer<T, any>} transformer
   * @param {Buffer} [code]
   */
  _addBakeItem(item, transformer, code) {
    if (transformer.bakeVersionstamp) {
      const scope = this._ctx
      if (scope.toBake == null) scope.toBake = []
      scope.toBake.push({item, transformer, code})
    }
  }

  // TODO: These method names are a bit confusing.
  //
  // The short version is, if you're using the tuple type with an unbound
  // versionstamp, use setVersionstampedKey. Otherwise if you just want your
  // key to be baked out with a versionstamp after it, use
  // setVersionstampSuffixedKey.

  /**
   * @param {KeyIn} key
   * @param {ValIn} value
   * @param {boolean} bakeAfterCommit
   */
  setVersionstampedKey(key, value, bakeAfterCommit = true) {
    const pack = this.subspace.packKeyUnboundVersionstamp(key)
    const code = this._bakeCode(pack)
    this.setVersionstampedKeyRaw(packVersionstamp(pack, true), value)

    if (bakeAfterCommit) this._addBakeItem(key, this.subspace._bakedKeyXf, code)
  }

  /**
   * @param {KeyIn} key
   * @param {ValIn} value
   * @param {Buffer} [suffix]
   */
  setVersionstampSuffixedKey(key, value, suffix) {
    const prefix = asBuf(this.subspace.packKey(key))
    this.setVersionstampedKeyBuf(prefix, suffix, value)
  }

  // Ok now versionstamped values

  /**
   * @param {KeyIn} key
   * @param {Buffer} value
   */
  setVersionstampedValueRaw(key, value) {
    this.atomicOpKB(MutationType.SetVersionstampedValue, key, value)
  }

  /**
   * @param {KeyIn} key
   * @param {ValIn} value
   * @param {boolean} bakeAfterCommit
   */
  setVersionstampedValue(key, value, bakeAfterCommit = true) {
    const pack = this.subspace.packValueUnboundVersionstamp(value)
    const code = this._bakeCode(pack)
    const val = packVersionstamp(pack, false)
    this.atomicOpKB(MutationType.SetVersionstampedValue, key, val)

    if (bakeAfterCommit) this._addBakeItem(value, this.subspace.valueXf, code)
  }

  /**
   * Set key = [10 byte versionstamp, value in bytes]. This function leans on
   * the value transformer to pack & unpack versionstamps. An extra value
   * prefix is only supported on API version 520+.
   *
   * @param {KeyIn} key
   * @param {ValIn} [value]
   * @param {Buffer} [prefix]
   */
  setVersionstampPrefixedValue(key, value, prefix) {
    const valBuf = value !== undefined ? asBuf(this.subspace.packValue(value)) : undefined
    const val = packVersionstampPrefixSuffix(prefix, valBuf, false)
    this.atomicOpKB(MutationType.SetVersionstampedValue, key, val)
  }

  /**
   * Helper to get the specified key and split out the stamp and value pair.
   * This requires that the stamp is at offset 0 (the start) of the value.
   * This is designed to work with setVersionstampPrefixedValue. If you're
   * using setVersionstampedValue with tuples, just call get().
   *
   * @param {KeyIn} key
   * @returns {Promise<{ stamp: Buffer, value?: ValOut } | undefined>}
   */
  async getVersionstampPrefixedValue(key) {
    this._assertValid()

    const val = await this._tn.get(this.subspace.packKey(key), this.isSnapshot)

    if (val != null) {
      return val.length <= 10
        ? {
          stamp: val
        }
        : {
          stamp: val.subarray(0, 10),

          // So this is a bit opinionated - if you call
          // setVersionstampPrefixedValue with no value, the db will just have
          // the 10 byte versionstamp. So when you get here, we have no bytes
          // for the decoder and that can cause issues. We'll just return undefined
          // in that case - but, yeah, controversial. You might want some other
          // encoding or something. File an issue if this causes you grief.
          value: this.subspace.unpackValue(val.subarray(10))
        }
      }
  }

  /**
   * @returns {Promise<number>}
   */
  getApproximateSize() {
    this._assertValid()

    return this._tn.getApproximateSize()
  }
}
