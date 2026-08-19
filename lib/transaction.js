import keySelector from './keySelector.js'
import {
  NestedLayer, RawBase, forkLayer, NestedConflictError,
} from './nested.js'
import { MutationType, StreamingMode } from './opts.g.js'
import {
  asBuf, emptyBuffer, strInc, strNext,
} from './util.js'
import { packVersionstamp, packVersionstampPrefixSuffix } from './versionstamp.js'

/**
 * @import { NativeTransaction } from './native.js'
 * @import { TransactionOptionCode } from './opts.g.js'
 * @import Subspace, { GetSubspace } from './subspace.js'
 * @import { KeySelector, KVList, NativeValue, RangeOptions, Transformer, UnboundStamp, Version, Watch, WatchOptions } from './types.js'
 */

/**
 * @template T
 * @typedef {{
 *   code: Buffer | undefined
 *   item: T
 *   transformer: Transformer<T, any>
 * }} BakeItem
 */
/**
 * @typedef {{
 *   invalid?: true
 *   nextCode: number
 *   toBake?: BakeItem<any>[]
 *   rootLayer?: NestedLayer
 * }} TxnCtx
 */

const doNothing = () => {}

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
 * @template [KeyIn=NativeValue] The type for keys passed by the user into functions (eg `get(k:
 * KeyIn)`). Defaults to string | Buffer. Change this by scoping the transaction
 * with a subspace with a key transformer. Eg
 * `txn.at(fdb.root.withKeyEncoding(fdb.encoders.tuple)).get([1, 2, 3])`.
 * @template [KeyOut=Buffer] The type of keys returned by methods which return keys - like
 * `getKey(..) => Promise<KeyOut?>`. Unless you have a KV transformer, this will
 * be Buffer.
 * @template [ValIn=NativeValue] The type of values passed into transaction functions, like
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
   * @param {NativeTransaction} tn
   * @param {boolean} snapshot
   * @param {Subspace<KeyIn, KeyOut, ValIn, ValOut>} subspace
   * @param {TxnCtx} [ctx]
   * @param {NestedLayer} [layer] The nested overlay layer this handle operates
   *   on. Undefined for a plain (unforked) transaction, which passes straight
   *   through to the native transaction.
   */
  constructor(tn, snapshot, subspace, ctx, layer) {
    /** @type {NativeTransaction} */
    this._tn = tn

    /** @type {boolean} */
    this.isSnapshot = snapshot

    /** @type {Subspace<KeyIn, KeyOut, ValIn, ValOut>} */
    this.subspace = subspace

    /** @type {TxnCtx} */
    this._ctx = ctx ?? {
      nextCode: 0,
    }

    /** @type {NestedLayer | undefined} */
    this._layer = layer
  }

  /** @type {object} */
  get context() {
    return this._ctx
  }

  _assertValid() {
    // The whole native transaction can be invalidated (eg between retries of a
    // top-level db.doTn). A nested child handle is additionally invalid once
    // its own layer has been committed (merged) or cancelled (aborted).
    if (this._ctx.invalid) {
      throw new Error('Transaction is invalid')
    }

    if (this._layer != null && (this._layer.merged || this._layer.aborted)) {
      throw new Error('Transaction is invalid')
    }
  }

  _invalidate() {
    // For a nested child, invalidation means discarding its buffered overlay
    // (cancel), which also releases the parent's outstanding-child slot. We
    // must NOT set the shared _ctx.invalid flag, since that would poison the
    // parent and every sibling. For a root transaction, invalidate the shared
    // context as before.
    if (this._layer != null) {
      this._layer.abort()

      return
    }

    this._ctx.invalid = true
  }

  /**
   * @template T
   * @param {(tn: Transaction<KeyIn, KeyOut, ValIn, ValOut>) => Promise<T>} body
   * @returns {Promise<T>}
   */
  async _exec(body) {
    const result = await body(this)

    // Versionstamp baking only resolves at the real database commit, so it is
    // handled by the root transaction, never by a nested child.
    if (this._layer != null) {
      await this.rawCommit()

      return result
    }

    const stampPromise = this._ctx.toBake?.length
      ? this.getVersionstamp()
      : undefined

    await this.rawCommit()

    if (stampPromise) {
      const stamp = await stampPromise.promise;
      /** @type {NonNullable<BakeItem<any>[]>} */(this._ctx.toBake).forEach(
        ({ item, transformer, code }) => /** @type {NonNullable<typeof transformer['bakeVersionstamp']>} */(transformer.bakeVersionstamp)(item, stamp, code),
      )
    }

    return result
  }

  // **** Nested transactions
  //
  // A Transaction exposes the same transaction-running surface that Database
  // does (doTn / doTransaction / doOneshot / rawCreateTransaction). Calling
  // these on a Transaction opens a *nested* transaction: a child handle whose
  // writes are buffered and only applied to this transaction when the child
  // commits (via rawCommit), with the same optimistic-concurrency conflict
  // checking a top-level transaction gets from FoundationDB.
  //
  // The parent plays the role Database plays for a top-level transaction: its
  // own operations are authoritative and never conflict with its children.

  /**
   * Lazily promote this (root) transaction to a NestedLayer so children have
   * somewhere to commit into. The root layer flushes its own writes straight to
   * the native transaction (the parent is authoritative and never conflicts
   * with its children).
   *
   * @returns {NestedLayer}
   */
  _ensureRootLayer() {
    if (this._ctx.rootLayer == null) {
      const raw = new RawBase(this._tn)
      this._ctx.rootLayer = new NestedLayer(raw, undefined, raw)
    }

    return this._ctx.rootLayer
  }

  /**
   * The layer this handle reads/writes through, or the root layer if this is a
   * (promoted) root handle. Returns undefined only when nesting has never been
   * activated.
   *
   * @returns {NestedLayer | undefined}
   */
  _activeLayer() {
    return this._layer ?? this._ctx.rootLayer
  }

  /**
   * Open a nested transaction against this transaction and run `body` in it.
   *
   * This mirrors `Database.doTn`: it creates a child transaction, runs the
   * body, and commits (merges) the child. If the commit conflicts - because a
   * concurrent sibling nested transaction committed an overlapping write since
   * this one started - the body is retried on a fresh child, exactly like a
   * top-level transaction retries on an FDB conflict.
   *
   * Unlike `Database.doTn` there is no options argument: transaction options
   * apply to the shared underlying native transaction and can only be set on
   * the top-level transaction.
   *
   * @template T
   * @param {(tn: Transaction<KeyIn, KeyOut, ValIn, ValOut>) => Promise<T>} body
   * @returns {Promise<T>}
   */
  async doTn(body) {
    this._assertValid()

    /** @type {Transaction<KeyIn, KeyOut, ValIn, ValOut> | undefined} */
    let transaction

    // Mirrors Database.doTn's retry loop, but the "retryable error" is a nested
    // conflict and the retry hook (rawOnError) discards the failed child.
    for (;;) {
      transaction?._invalidate()
      transaction = this.rawCreateTransaction()

      try {
        return await transaction._exec(body)
      } catch (err) {
        if (err instanceof NestedConflictError) {
          await transaction.rawOnError(err.code) // Discards the child; then loop.
        } else {
          // Body threw (or a non-retryable error): cancel the child so the
          // parent's outstanding-child counter is released, then rethrow.
          transaction.rawCancel()

          throw err
        }
      }
    }
  }

  /**
   * Alias for `tn.doTn`.
   *
   * @template T
   * @param {(tn: Transaction<KeyIn, KeyOut, ValIn, ValOut>) => Promise<T>} body
   * @returns {Promise<T>}
   */
  async doTransaction(body) {
    return this.doTn(body)
  }

  /**
   * Run `body` in a nested transaction that performs no reads (and so cannot
   * conflict). Mirrors `Database.doOneshot`.
   *
   * @param {(tn: Transaction<KeyIn, KeyOut, ValIn, ValOut>) => void} body
   * @returns {Promise<void>}
   */
  doOneshot(body) {
    return this.doTransaction(
      tn => {
        body(tn)

        return Promise.resolve()
      },
    )
  }

  /**
   * Create a nested (child) transaction and return it without running a body.
   * You must call `child.rawCommit()` to apply it or `child.rawCancel()` to
   * discard it. Mirrors `Database.rawCreateTransaction`.
   *
   * Infrequently used - you probably want `doTn` instead, which handles
   * commit, cancel and retry for you.
   *
   * Note: unlike `Database.rawCreateTransaction`, this takes no options.
   * Transaction options configure the underlying native transaction, which is
   * shared by all nested transactions, so they can only be set on the
   * top-level transaction.
   *
   * @returns {Transaction<KeyIn, KeyOut, ValIn, ValOut>}
   */
  rawCreateTransaction() {
    this._assertValid()

    const parentLayer = this._layer ?? this._ensureRootLayer()
    const childLayer = forkLayer(parentLayer)

    return new Transaction(this._tn, this.isSnapshot, this.subspace, this._ctx, childLayer)
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
   * Returns a shallow copy of the transaction object which does snapshot reads.
   *
   * @returns {Transaction<KeyIn, KeyOut, ValIn, ValOut>} A shallow copy of the transaction object which does snapshot reads.
   */
  snapshot() {
    return new Transaction(this._tn, true, this.subspace, this._ctx, this._layer)
  }

  /**
   * Create a shallow copy of the transaction in the specified subspace (or database, transaction, or directory).
   *
   * @template CKI, CKO, CVI, CVO
   * @param {GetSubspace<CKI, CKO, CVI, CVO>} hasSubspace
   * @returns {Transaction<CKI, CKO, CVI, CVO>} A shallow copy of the transaction in the specified subspace (or database, transaction, or directory).
   */
  at(hasSubspace) {
    return /** @type {Transaction<CKI, CKO, CVI, CVO>} */(new Transaction(this._tn, this.isSnapshot, hasSubspace.getSubspace(), this._ctx, this._layer))
  }

  /** Get the current subspace */
  getSubspace() { return this.subspace }

  // You probably don't want to call any of these functions directly. Instead call db.transact(async tn => {...}).

  /**
   * This uses the raw API to commit a transaction. 99% of users shouldn't touch this, and should instead use `db.doTn(async tn => {...})`, which will automatically commit the transaction and retry if necessary.
   *
   * On a nested (child) transaction, this commits the child into its parent
   * rather than to the database. It throws `NestedConflictError` (code 1020) if
   * the child's reads conflict with writes committed to the parent by a
   * concurrent sibling since the child was created - mirroring how a top-level
   * `rawCommit` throws a retryable `FDBError` on conflict.
   *
   * @returns {Promise<void>}
   */
  rawCommit() {
    this._assertValid()

    // Nested (child) transaction: commit = merge into parent.
    if (this._layer != null) {
      this._layer.merge()

      return Promise.resolve()
    }

    // Root transaction: a real commit. Block while children are outstanding.
    const root = this._ctx.rootLayer

    if (root != null && root.outstandingChildren > 0) {
      throw new Error('Cannot commit while nested child transactions are still outstanding (un-committed/un-cancelled)')
    }

    return this._tn.commit()
  }

  rawReset() {
    this._assertValid()

    if (this._layer != null) {
      throw new Error('rawReset() is not supported on a nested transaction')
    }

    this._tn.reset()
  }

  rawCancel() {
    // On a nested (child) transaction, cancel = discard the buffered overlay.
    if (this._layer != null) {
      this._layer.abort()

      return
    }

    this._assertValid()
    this._tn.cancel()
  }

  /**
   * The retry hook after a failed commit. On a nested transaction, a
   * `NestedConflictError` is always retryable: the failed child has already
   * been discarded by the throwing `rawCommit`, so this is a no-op that lets
   * the caller loop. On a root transaction this defers to the native
   * `onError`.
   *
   * @param {number} code
   * @returns {Promise<void>}
   */
  rawOnError(code) {
    if (this._layer != null) {
      // The child that threw NestedConflictError is discarded here so the
      // parent's outstanding-child counter is released before the retry.
      this._layer.abort()

      return Promise.resolve()
    }

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

    const keyBuf = asBuf(this.subspace.packKey(key))
    const layer = this._activeLayer()

    const raw = layer != null
      ? layer.readKey(keyBuf, this.isSnapshot)
      : this._tn.get(keyBuf, this.isSnapshot)

    return raw.then(val => val !== undefined ? this.subspace.unpackValue(val) : undefined)
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

    const keyBuf = asBuf(this.subspace.packKey(key))
    const layer = this._activeLayer()

    const raw = layer != null
      ? layer.readKey(keyBuf, this.isSnapshot)
      : this._tn.get(keyBuf, this.isSnapshot)

    return raw.then(val => val !== undefined)
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
   * @param {KeySelector<KeyIn> | KeyIn} _sel
   * @returns {Promise<KeyOut | undefined>}
   */
  getKey(_sel) {
    this._assertValid()

    const sel = keySelector.from(_sel)
    const packed = asBuf(this.subspace.packKey(sel.key))
    const layer = this._activeLayer()

    const raw = layer != null
      ? layer.readKeySelector(packed, sel.orEqual, sel.offset, this.isSnapshot)
        .then(key => key ?? emptyBuffer)
      : this._tn.getKey(packed, sel.orEqual, sel.offset, this.isSnapshot)

    return raw.then(
      key => key.length === 0 || !this.subspace.contains(key)
        ? undefined
        : this.subspace.unpackKey(key),
    )
  }

  /**
   * Set the specified key/value pair in the database
   *
   * @param {KeyIn} key
   * @param {ValIn} val
   */
  set(key, val) {
    this._assertValid()

    const keyBuf = asBuf(this.subspace.packKey(key))
    const valBuf = asBuf(this.subspace.packValue(val))
    const layer = this._activeLayer()

    if (layer != null) {
      layer.set(keyBuf, valBuf)
    } else {
      this._tn.set(keyBuf, valBuf)
    }
  }

  /**
   * Remove the value for the specified key
   *
   * @param {KeyIn} key
   */
  clear(key) {
    this._assertValid()

    const pack = asBuf(this.subspace.packKey(key))
    const layer = this._activeLayer()

    if (layer != null) {
      layer.clear(pack)
    } else {
      this._tn.clear(pack)
    }
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
   * @param {[Buffer, Buffer][]} r
   * @returns {[KeyOut, ValOut][]}
   */
  _encodeRangeResult(r) {
    // This is slightly faster but I have to throw away the TS checks in the process. :/
    for (let i = 0; i < r.length; i++) {
      /** @type {any} */(r)[i][0] = this.subspace.unpackKey(r[i][0]);
      /** @type {any} */(r)[i][1] = this.subspace.unpackValue(r[i][1])
    }

    return /** @type {[KeyOut, ValOut][]} */(r)
  }

  /**
   * @param {KeySelector<NativeValue>} start
   * @param {KeySelector<NativeValue> | undefined} end
   * @param {number} limit
   * @param {number} targetBytes
   * @param {StreamingMode} streamingMode
   * @param {number} iter
   * @param {boolean} reverse
   * @returns {Promise<KVList<Buffer, Buffer>>}
   */
  getRangeNative(start, end, limit, targetBytes, streamingMode, iter, reverse) {
    this._assertValid()

    const _end = end != null ? end : keySelector.firstGreaterOrEqual(strInc(start.key))

    return this._tn.getRange(start.key, start.orEqual, start.offset, _end.key, _end.orEqual, _end.offset, limit, targetBytes, streamingMode, iter, this.isSnapshot, reverse)
  }

  /**
   * @param {KeySelector<KeyIn>} start
   * @param {KeySelector<KeyIn> | undefined} end
   * @param {number} limit
   * @param {number} targetBytes
   * @param {StreamingMode} streamingMode
   * @param {number} iter
   * @param {boolean} reverse
   * @returns {Promise<KVList<KeyOut, ValOut>>}
   */
  getRangeRaw(start, end, limit, targetBytes, streamingMode, iter, reverse) {
    return this.getRangeNative(keySelector(this.subspace.packKey(start.key), start.orEqual, start.offset), end != null ? keySelector(this.subspace.packKey(end.key), end.orEqual, end.offset) : undefined, limit, targetBytes, streamingMode, iter, reverse)
      .then(r => ({ more: r.more, results: this._encodeRangeResult(r.results) }))
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

    return this._tn.getRangeSplitPoints(range.begin, range.end, chunkSize).then(
      results => results.map(r => this.subspace.unpackKey(r)),
    )
  }

  /**
   * @param {KeySelector<NativeValue>} start
   * @param {KeySelector<NativeValue>} end
   * @param {RangeOptions} opts
   */
  async* getRangeBatchNative(
    start,
    end,
    {
      limit = 0,
      reverse = false,
      streamingMode = StreamingMode.Iterator,
    } = {},
  ) {
    const layer = this._activeLayer()

    if (layer != null) {
      yield* this._layerGetRangeBatch(layer, start, end, limit, reverse)

      return
    }

    let iter = 0

    while (1) {
      const { results, more } = await this.getRangeNative(
        start,
        end,
        limit,
        0,
        streamingMode,
        ++iter,
        reverse,
      )

      if (results.length) {
        if (!reverse) {
          start = keySelector.firstGreaterThan(results[results.length - 1][0])
        } else {
          end = keySelector.firstGreaterOrEqual(results[results.length - 1][0])
        }
      }

      // This destructively consumes results.
      yield this._encodeRangeResult(results)

      if (!more) {
        break
      }

      if (limit) {
        limit -= results.length

        if (limit <= 0) {
          break
        }
      }
    }
  }

  /**
   * Resolve a packed key selector to a concrete byte boundary for a half-open
   * range scan. Fast-paths the offset-1 selectors (firstGreaterOrEqual /
   * firstGreaterThan) that getRange produces; otherwise walks the merged view.
   *
   * @param {NestedLayer} layer
   * @param {KeySelector<NativeValue>} sel
   * @returns {Promise<Buffer | undefined>}
   */
  async _resolveScanBoundary(layer, sel) {
    const key = asBuf(sel.key)

    if (sel.offset === 1 && sel.orEqual === false) {
      // firstGreaterOrEqual(key): boundary is `key` itself.
      return key
    }

    if (sel.offset === 1 && sel.orEqual === true) {
      // firstGreaterThan(key): boundary is the key immediately after `key`.
      return strNext(key)
    }

    // General case: resolve against the merged view. An unresolvable forward
    // selector means "past the end of the scanned keyspace".
    const resolved = await layer.readKeySelector(key, sel.orEqual, sel.offset, this.isSnapshot)

    return resolved
  }

  /**
   * Layer-backed range streaming. Resolves the (packed) start/end selectors to
   * concrete boundary keys against the layer's merged view, then streams the
   * read-your-writes merged range.
   *
   * @param {NestedLayer} layer
   * @param {KeySelector<NativeValue>} start
   * @param {KeySelector<NativeValue>} end
   * @param {number} limit
   * @param {boolean} reverse
   * @returns {AsyncIterableIterator<[KeyOut, ValOut][]>}
   */
  async* _layerGetRangeBatch(layer, start, end, limit, reverse) {
    // Convert the (packed) key selectors to concrete byte boundaries for the
    // half-open scan [beginKey, endKey). The common selectors produced by
    // getRange / packRange use offset 1 (firstGreaterOrEqual / firstGreaterThan)
    // which map directly to byte boundaries without needing a merged-view
    // resolution. Non-trivial offsets fall back to the layer's selector
    // resolver, which walks the merged view.
    const beginKey = await this._resolveScanBoundary(layer, start)
    const endKey = await this._resolveScanBoundary(layer, end)

    // If either boundary is unresolvable or empty, the range is empty.
    if (beginKey === undefined || endKey === undefined || beginKey.compare(endKey) >= 0) {
      return
    }

    /** @type {[Buffer, Buffer][]} */
    let batch = []
    let count = 0

    for await (const pair of layer.readRange(beginKey, endKey, reverse, this.isSnapshot)) {
      batch.push(pair)
      count += 1

      if (batch.length >= 1000) {
        yield this._encodeRangeResult(batch)
        batch = []
      }

      if (limit && count >= limit) {
        break
      }
    }

    if (batch.length) {
      yield this._encodeRangeResult(batch)
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
   * @param {KeyIn | KeySelector<undefined | KeyIn>} [start]
   * @param {KeyIn | KeySelector<undefined | KeyIn>} [end]
   * @param {RangeOptions} [opts]
   */
  getRangeBatch(start, end, opts = {}) {
    const startSelector = keySelector.from(start)
    const endSelector = keySelector.from(end)
    const range = this.subspace.packRange(startSelector.key, endSelector.key)

    return this.getRangeBatchNative(keySelector(range.begin, startSelector.orEqual, startSelector.offset), keySelector(range.end, endSelector.orEqual, endSelector.offset), opts)
  }

  /**
   * This method is similar to *getRangeBatch*, but performs a query
   * on a key range specified by `prefix` instead of start and end.
   *
   * @see Transaction.getRangeBatch
   *
   * @param {KeyIn | KeySelector<KeyIn>} prefix
   * @param {RangeOptions} [opts]
   */
  getRangeBatchStartsWith(prefix, opts) {
    const prefixSelector = keySelector.from(prefix)
    const range = this.subspace.packRangeStartsWith(prefixSelector.key)

    return this.getRangeBatchNative(keySelector(range.begin, prefixSelector.orEqual, prefixSelector.offset), keySelector.firstGreaterOrEqual(range.end), opts)
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
   * @param {KeyIn | KeySelector<undefined | KeyIn>} [start]
   * @param {KeyIn | KeySelector<undefined | KeyIn>} [end]
   * @param {RangeOptions} [opts]
   */
  async* getRange(start, end, opts) {
    for await (const batch of this.getRangeBatch(start, end, opts)) {
      for (const pair of batch) {
        yield pair
      }
    }
  }

  /**
   * This method is similar to *getRange*, but performs a query
   * on a key range specified by `prefix` instead of start and end.
   *
   * @see Transaction.getRange
   *
   * @param {KeyIn | KeySelector<KeyIn>} prefix
   * @param {RangeOptions} [opts]
   */
  async* getRangeStartsWith(prefix, opts) {
    for await (const batch of this.getRangeBatchStartsWith(prefix, opts)) {
      for (const pair of batch) {
        yield pair
      }
    }
  }

  /**
   * Same as getRange, but prefetches and returns all values in an array rather
   * than streaming the values over the wire. This is often more convenient, and
   * makes sense when dealing with a small range.
   *
   * @see Transaction.getRange
   *
   * @param {KeyIn | KeySelector<undefined | KeyIn>} [start]
   * @param {KeyIn | KeySelector<undefined | KeyIn>} [end]
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
   * @param {KeyIn | KeySelector<KeyIn>} prefix
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
    const layer = this._activeLayer()

    if (layer != null) {
      layer.clearRange(asBuf(range.begin), asBuf(range.end))
    } else {
      this._tn.clearRange(range.begin, range.end)
    }
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
    const layer = this._activeLayer()

    if (layer != null) {
      layer.clearRange(asBuf(range.begin), asBuf(range.end))
    } else {
      this._tn.clearRange(range.begin, range.end)
    }
  }

  /**
   * @param {KeyIn} key
   * @param {WatchOptions} [opts]
   * @returns {Watch}
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
    const layer = this._activeLayer()

    if (layer != null) {
      layer.readConflicts.add(asBuf(range.begin), asBuf(range.end))
    } else {
      this._tn.addReadConflictRange(range.begin, range.end)
    }
  }

  /**
   * @param {KeyIn} prefix
   */
  addReadConflictRangeStartsWith(prefix) {
    this._assertValid()

    const range = this.subspace.packRangeStartsWith(prefix)
    const layer = this._activeLayer()

    if (layer != null) {
      layer.readConflicts.add(asBuf(range.begin), asBuf(range.end))
    } else {
      this._tn.addReadConflictRange(range.begin, range.end)
    }
  }

  /**
   * @param {KeyIn} key
   */
  addReadConflictKey(key) {
    this._assertValid()

    const keyBuf = asBuf(this.subspace.packKey(key))
    const layer = this._activeLayer()

    if (layer != null) {
      layer.readConflicts.add(keyBuf, strNext(keyBuf))
    } else {
      this._tn.addReadConflictRange(keyBuf, strNext(keyBuf))
    }
  }

  /**
   * @param {KeyIn} [start]
   * @param {KeyIn} [end]
   */
  addWriteConflictRange(start, end) {
    this._assertValid()

    const range = this.subspace.packRange(start, end)
    const layer = this._activeLayer()

    if (layer != null) {
      layer.writeConflicts.add(asBuf(range.begin), asBuf(range.end))
    } else {
      this._tn.addWriteConflictRange(range.begin, range.end)
    }
  }

  /**
   * @param {KeyIn} prefix
   */
  addWriteConflictRangeStartsWith(prefix) {
    this._assertValid()

    const range = this.subspace.packRangeStartsWith(prefix)
    const layer = this._activeLayer()

    if (layer != null) {
      layer.writeConflicts.add(asBuf(range.begin), asBuf(range.end))
    } else {
      this._tn.addWriteConflictRange(range.begin, range.end)
    }
  }

  /**
   * @param {KeyIn} key
   */
  addWriteConflictKey(key) {
    this._assertValid()

    const keyBuf = asBuf(this.subspace.packKey(key))
    const layer = this._activeLayer()

    if (layer != null) {
      layer.writeConflicts.add(keyBuf, strNext(keyBuf))
    } else {
      this._tn.addWriteConflictRange(keyBuf, strNext(keyBuf))
    }
  }

  /**
   * @param {Version} v 8-byte version
   */
  setReadVersion(v) {
    this._assertValid()

    this._tn.setReadVersion(v)
  }

  /**
   * Get the database version used to perform reads in this transaction.
   *
   * @returns {Promise<Version>}
   */
  getReadVersion() {
    this._assertValid()

    return this._tn.getReadVersion()
  }

  /**
   * @returns {Version}
   */
  getCommittedVersion() {
    this._assertValid()

    return this._tn.getCommittedVersion()
  }

  /**
   * Note: This promise can't be directly returned via the return value of a
   * transaction.
   *
   * @returns {{ promise: Promise<Buffer> }}
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

    return { promise }
  }

  /**
   * @param {KeyIn} key
   * @returns {Promise<string[]>}
   */
  getAddressesForKey(key) {
    this._assertValid()

    return this._tn.getAddressesForKey(this.subspace.packKey(key))
  }

  // **** Atomic operations

  /**
   * @param {MutationType} opType
   * @param {NativeValue} key
   * @param {NativeValue} oper
   */
  atomicOpNative(opType, key, oper) {
    this._assertValid()

    const layer = this._activeLayer()

    if (layer != null) {
      layer.atomicOp(opType, asBuf(key), asBuf(oper))
    } else {
      this._tn.atomicOp(opType, key, oper)
    }
  }

  /**
   * @param {MutationType} opType
   * @param {KeyIn} key
   * @param {Buffer} oper
   */
  atomicOpKB(opType, key, oper) {
    this._assertValid()
    this.atomicOpNative(opType, this.subspace.packKey(key), oper)
  }

  /**
   * @param {MutationType} opType
   * @param {KeyIn} key
   * @param {ValIn} oper
   */
  atomicOp(opType, key, oper) {
    this._assertValid()
    this.atomicOpNative(opType, this.subspace.packKey(key), this.subspace.packValue(oper))
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
   * @param {UnboundStamp} into
   * @returns {Buffer | undefined}
   */
  _bakeCode(into) {
    if (this.isSnapshot) {
      throw new Error('Cannot use this method in a snapshot transaction')
    }

    if (into.codePos != null) {
      // We edit the buffer in-place but leave the codepos as is so if the txn
      // retries it'll overwrite the code.
      const id = this.getNextTransactionID()

      if (id > 0xffff) {
        throw new Error('Cannot use more than 65536 unique versionstamps in a single transaction. Either split your writes into multiple transactions or add explicit codes to your unbound versionstamps')
      }

      into.data.writeInt16BE(id, into.codePos)

      return into.data.subarray(into.codePos, into.codePos + 2)
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
   * @template T
   * @param {T} item
   * @param {Transformer<T, any>} transformer
   * @param {Buffer} [code]
   */
  _addBakeItem(item, transformer, code) {
    if (transformer.bakeVersionstamp) {
      const scope = this._ctx

      if (scope.toBake == null) {
        scope.toBake = []
      }

      scope.toBake.push({ item, transformer, code })
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

    if (bakeAfterCommit) {
      this._addBakeItem(key, this.subspace._bakedKeyXf, code)
    }
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

    if (bakeAfterCommit) {
      this._addBakeItem(value, this.subspace.valueXf, code)
    }
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
          stamp: val,
        }
        : {
          stamp: val.subarray(0, 10),

          // So this is a bit opinionated - if you call
          // setVersionstampPrefixedValue with no value, the db will just have
          // the 10 byte versionstamp. So when you get here, we have no bytes
          // for the decoder and that can cause issues. We'll just return undefined
          // in that case - but, yeah, controversial. You might want some other
          // encoding or something. File an issue if this causes you grief.
          value: this.subspace.unpackValue(val.subarray(10)),
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
