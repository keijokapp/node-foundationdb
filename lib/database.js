import FDBError from './error.js'
import { FoundationDbTransaction } from './foundationdb.js'
import { eachOption } from './opts.js'
import { MutationType, databaseOptionData, transactionOptionData } from './opts.g.js'
import { root, isGetSubspace } from './subspace.js'
import Transaction from './transaction.js'

/**
 * @import { NativeDatabase } from './native.js'
 * @import { DatabaseOptions, TransactionOptions } from './opts.g.js'
 * @import Subspace, { GetSubspace } from './subspace.js'
 * @import { KeySelector, NativeValue, RangeOptions, Transformer, Watch, WatchWithValue } from './types.js'
 */

/**
 * @template [KeyIn=NativeValue]
 * @template [KeyOut=Buffer]
 * @template [ValIn=NativeValue]
 * @template [ValOut=Buffer]
 */
export default class Database {
  /**
   * @param {NativeDatabase} db
   * @param {Subspace<KeyIn, KeyOut, ValIn, ValOut>} subspace
   */
  constructor(db, subspace) {
    /** @type {NativeDatabase} */
    this._db = db

    /** @type {Subspace<KeyIn, KeyOut, ValIn, ValOut>} */
    this.subspace = subspace
  }

  /**
   * @param {DatabaseOptions} opts
   */
  setNativeOptions(opts) {
    eachOption(databaseOptionData, opts, (code, val) => this._db.setOption(code, val))
  }

  close() {
    this._db.close()
  }

  // **** Scoping functions

  /**
   * @returns {Database}
   */
  getRoot() {
    return new Database(this._db, root)
  }

  /**
   * @returns {Subspace<KeyIn, KeyOut, ValIn, ValOut>}
   */
  getSubspace() { return this.subspace }

  /**
   * @returns {Buffer}
   */
  getPrefix() { return this.subspace.prefix }

  /**
   * @template CKI, CKO, CVI, CVO
   * @overload
   * @param {GetSubspace<CKI, CKO, CVI, CVO>} hasSubspace
   * @returns {Database<CKI, CKO, CVI, CVO>}
   */
  /**
   * @overload
   * @param {KeyIn} [prefix]
   * @param {undefined} [keyXf]
   * @param {undefined} [valueXf]
   * @returns {Database<KeyIn, KeyOut, ValIn, ValOut>}
   */
  /**
   * @template CKI, CKO
   * @overload
   * @param {KeyIn | undefined} prefix
   * @param {Transformer<CKI, CKO>} keyXf
   * @param {undefined} [valueXf]
   * @returns {Database<CKI, CKO, ValIn, ValOut>}
   */
  /**
   * @template CVI, CVO
   * @overload
   * @param {KeyIn | undefined} prefix
   * @param {undefined} keyXf
   * @param {Transformer<CVI, CVO>} valueXf
   * @returns {Database<KeyIn, KeyOut, CVI, CVO>}
   */
  /**
   * @template CKI, CKO, CVI, CVO
   * @overload
   * @param {KeyIn | undefined} prefix
   * @param {Transformer<CKI, CKO>} keyXf
   * @param {Transformer<CVI, CVO>} valueXf
   * @returns {Database<CKI, CKO, CVI, CVO>}
   */
  /**
   * @template CKI, CKO
   * @overload
   * @param {KeyIn | undefined} prefix
   * @param {Transformer<CKI, CKO>} [keyXf]
   * @param {undefined} [valueXf]
   * @returns {(
   *   | Database<KeyIn, KeyOut, ValIn, ValOut>
   *   | Database<CKI, CKO, ValIn, ValOut>
   * )}
   */
  /**
   * @template CVI, CVO
   * @overload
   * @param {KeyIn | undefined} prefix
   * @param {undefined} keyXf
   * @param {Transformer<CVI, CVO>} [valueXf]
   * @returns {(
   *   | Database<KeyIn, KeyOut, ValIn, ValOut>
   *   | Database<KeyIn, KeyOut, CVI, CVO>
   * )}
   */
  /**
   * @template CKI, CKO, CVI, CVO
   * @overload
   * @param {KeyIn | undefined} prefix
   * @param {Transformer<CKI, CKO> | undefined} keyXf
   * @param {Transformer<CVI, CVO>} valueXf
   * @returns {(
   *   | Database<KeyIn, KeyOut, CVI, CVO>
   *   | Database<CKI, CKO, CVI, CVO>
   * )}
   */
  /**
   * @template CKI, CKO, CVI, CVO
   * @overload
   * @param {KeyIn | undefined} prefix
   * @param {Transformer<CKI, CKO>} keyXf
   * @param {Transformer<CVI, CVO>} [valueXf]
   * @returns {(
   *   | Database<CKI, CKO, ValIn, ValOut>
   *   | Database<CKI, CKO, CVI, CVO>
   * )}
   */
  /**
   * @template CKI, CKO, CVI, CVO
   * @overload
   * @param {KeyIn} [prefix]
   * @param {Transformer<CKI, CKO>} [keyXf]
   * @param {Transformer<CVI, CVO>} [valueXf]
   * @returns {(
   *   | Database<KeyIn, KeyOut, ValIn, ValOut>
   *   | Database<CKI, CKO, ValIn, ValOut>
   *   | Database<KeyIn, KeyOut, CVI, CVO>
   *   | Database<CKI, CKO, CVI, CVO>
   * )}
   */
  /**
   * Create a shallow reference to the database at a specified subspace
   *
   * @param {GetSubspace<unknown, unknown, unknown, unknown> | KeyIn} [prefixOrSubspace]
   * @param {Transformer<unknown, unknown>} [keyXf]
   * @param {Transformer<unknown, unknown>} [valueXf]
   * @returns {Database<any, any, any, any>}
   */
  at(prefixOrSubspace, keyXf, valueXf) {
    if (isGetSubspace(prefixOrSubspace)) {
      return new Database(this._db, prefixOrSubspace.getSubspace())
    }

    return new Database(this._db, this.subspace.at(prefixOrSubspace, keyXf, valueXf))
  }

  /**
   * @overload
   * @param {undefined} [keyXf]
   * @returns {Database<NativeValue, Buffer, ValIn, ValOut>}
   */
  /**
   * @template CKI, CKO
   * @overload
   * @param {Transformer<CKI, CKO>} keyXf
   * @returns {Database<CKI, CKO, ValIn, ValOut>}
   */
  /**
   * @template CKI, CKO
   * @overload
   * @param {Transformer<CKI, CKO>} [keyXf]
   * @returns {(
   *   | Database<NativeValue, Buffer, ValIn, ValOut>
   *   | Database<CKI, CKO, ValIn, ValOut>
   * )}
   */
  /**
   * @param {Transformer<unknown, unknown>} [keyXf]
   * @returns {Database<any, any, any, any>}
   */
  withKeyEncoding(keyXf) {
    return new Database(this._db, this.subspace.withKeyEncoding(keyXf))
  }

  /**
   * @overload
   * @param {undefined} [keyXf]
   * @returns {Database<KeyIn, KeyOut, NativeValue, Buffer>}
   */
  /**
   * @template CVI, CVO
   * @overload
   * @param {Transformer<CVI, CVO>} valueXf
   * @returns {Database<KeyIn, KeyOut, CVI, CVO>}
   */
  /**
   * @template CVI, CVO
   * @overload
   * @param {Transformer<CVI, CVO>} [valueXf]
   * @returns {(
   *   | Database<KeyIn, KeyOut, NativeValue, Buffer>
   *   | Database<KeyIn, KeyOut, CVI, CVO>
   * )}
   */
  /**
   * @param {Transformer<unknown, unknown>} [valueXf]
   * @returns {Database<any, any, any, any>}
   */
  withValueEncoding(valueXf) {
    return new Database(this._db, this.subspace.withValueEncoding(valueXf))
  }

  /**
   * This is the API you want to use for non-trivial transactions.
   *
   * @template T
   * @param {(tn: Transaction<KeyIn, KeyOut, ValIn, ValOut>) => Promise<T>} body
   * @param {TransactionOptions} [opts]
   * @returns {Promise<T>}
   */
  async doTn(body, opts) {
    const tn = new FoundationDbTransaction(this._db.createTransaction())

    if (opts) {
      eachOption(transactionOptionData, opts, (code, val) => tn.setOption(code, val))
    }

    /** @type {Transaction<KeyIn, KeyOut, ValIn, ValOut> | undefined} */
    let transaction

    // Logic described here:
    // https://apple.github.io/foundationdb/api-c.html#c.fdb_transaction_on_error
    for (;;) {
      transaction?._invalidate()
      transaction = new Transaction(tn, false, this.subspace)

      try {
        return await transaction._exec(body)
      } catch (err) {
        // See if we can retry the transaction
        if (err instanceof FDBError) {
          await tn.onError(err.code) // If this throws, punt error to caller.
          // If that passed, loop.
        } else {
          throw err
        }
      }
    }
  }

  /**
   * Alias for db.doTn.
   *
   * @template T
   * @param {(tn: Transaction<KeyIn, KeyOut, ValIn, ValOut>) => Promise<T>} body
   * @param {TransactionOptions} [opts]
   * @returns {Promise<T>}
   */
  async doTransaction(body, opts) {
    return this.doTn(body, opts)
  }

  /**
   * @param {(tn: Transaction<KeyIn, KeyOut, ValIn, ValOut>) => void} body
   * @param {TransactionOptions} [opts]
   * @returns {Promise<void>}
   */
  doOneshot(body, opts) {
    // TODO: Could this be written better? It doesn't need a retry loop.
    return this.doTransaction(
      tn => {
        body(tn)

        return Promise.resolve()
      },
      opts,
    )
  }

  /**
   * Infrequently used. You probably want to use doTransaction instead.
   *
   * @param {TransactionOptions} [opts]
   * @returns {Transaction<KeyIn, KeyOut, ValIn, ValOut>}
   */
  rawCreateTransaction(opts) {
    const tn = new FoundationDbTransaction(this._db.createTransaction())

    if (opts) {
      eachOption(transactionOptionData, opts, (code, val) => tn.setOption(code, val))
    }

    return new Transaction(tn, false, this.subspace)
  }

  /**
   * @param {KeyIn} key
   * @returns {Promise<ValOut | undefined>}
   */
  get(key) {
    return this.doTransaction(tn => tn.snapshot().get(key))
  }

  /**
   * @param {KeyIn | KeySelector<KeyIn>} selector
   * @returns {Promise<KeyOut | undefined>}
   */
  getKey(selector) {
    return this.doTransaction(tn => tn.snapshot().getKey(selector))
  }

  /**
   * @param {KeyIn} key
   * @returns {Promise<{ stamp: Buffer, value?: ValOut } | undefined>}
   */
  getVersionstampPrefixedValue(key) {
    return this.doTransaction(tn => tn.snapshot().getVersionstampPrefixedValue(key))
  }

  /**
   * @param {KeyIn} key
   * @param {ValIn} value
   */
  set(key, value) {
    return this.doOneshot(tn => tn.set(key, value))
  }

  /**
   * @param {KeyIn} key
   */
  clear(key) {
    return this.doOneshot(tn => tn.clear(key))
  }

  /**
   * @param {KeyIn} [start]
   * @param {KeyIn} [end]
   */
  clearRange(start, end) {
    return this.doOneshot(tn => tn.clearRange(start, end))
  }

  /**
   * @param {KeyIn} prefix
   */
  clearRangeStartsWith(prefix) {
    return this.doOneshot(tn => tn.clearRangeStartsWith(prefix))
  }

  /**
   * @param {KeyIn} key
   * @returns {Promise<WatchWithValue<ValOut>>}
   */
  getAndWatch(key) {
    return this.doTransaction(async tn => {
      const value = await tn.get(key)
      const watch = /** @type {WatchWithValue<ValOut>} */(tn.watch(key))
      watch.value = value

      return watch
    })
  }

  // Not passing options through to the promise. The only option we support so
  // far is to pass through errors, but if we do that and the transaction
  // somehow conflicted, it would be impossible to avoid an uncaught promise
  // exception.
  /**
   * @param {KeyIn} key
   * @param {ValIn} value
   * @returns {Promise<Watch>}
   */
  setAndWatch(key, value) {
    return this.doTransaction(async tn => {
      tn.set(key, value)

      return tn.watch(key)
    })
  }

  /**
   * @param {KeyIn} key
   * @returns {Promise<Watch>}
   */
  clearAndWatch(key) {
    return this.doTransaction(async tn => {
      tn.clear(key)

      return tn.watch(key)
    })
  }

  /**
   * @param {KeyIn | KeySelector<undefined | KeyIn>} [start]
   * @param {KeyIn | KeySelector<undefined | KeyIn>} [end]
   * @param {RangeOptions} [opts]
   * @returns {Promise<[KeyOut, ValOut][]>}
   */
  getRangeAll(start, end, opts) {
    return this.doTransaction(tn => tn.snapshot().getRangeAll(start, end, opts))
  }

  /**
   * @param {KeyIn | KeySelector<KeyIn>} prefix
   * @param {RangeOptions} [opts]
   * @returns {Promise<[KeyOut, ValOut][]>}
   */
  getRangeAllStartsWith(prefix, opts) {
    return this.doTransaction(tn => tn.snapshot().getRangeAllStartsWith(prefix, opts))
  }

  /**
   * @param {KeyIn} [start]
   * @param {KeyIn} [end]
   * @returns {Promise<number>}
   */
  getEstimatedRangeSizeBytes(start, end) {
    return this.doTransaction(tn => tn.getEstimatedRangeSizeBytes(start, end))
  }

  /**
   * @param {KeyIn | undefined} start
   * @param {KeyIn | undefined} end
   * @param {number} chunkSize
   * @returns {Promise<KeyOut[]>}
   */
  getRangeSplitPoints(start, end, chunkSize) {
    return this.doTransaction(tn => tn.getRangeSplitPoints(start, end, chunkSize))
  }

  /**
   * @param {MutationType} op
   * @param {NativeValue} key
   * @param {NativeValue} oper
   */
  atomicOpNative(op, key, oper) {
    return this.doOneshot(tn => tn.atomicOpNative(op, key, oper))
  }

  /**
   * @param {MutationType} op
   * @param {KeyIn} key
   * @param {ValIn} oper
   */
  atomicOp(op, key, oper) {
    return this.doOneshot(tn => tn.atomicOp(op, key, oper))
  }

  /**
   * @param {MutationType} op
   * @param {KeyIn} key
   * @param {Buffer} oper
   */
  atomicOpKB(op, key, oper) {
    return this.doOneshot(tn => tn.atomicOpKB(op, key, oper))
  }

  /**
   * @param {KeyIn} key
   * @param {ValIn} oper
   */
  add(key, oper) {
    return this.atomicOp(MutationType.Add, key, oper)
  }

  /**
   * @param {KeyIn} key
   * @param {ValIn} oper
   */
  max(key, oper) {
    return this.atomicOp(MutationType.Max, key, oper)
  }

  /**
   * @param {KeyIn} key
   * @param {ValIn} oper
   */
  min(key, oper) {
    return this.atomicOp(MutationType.Min, key, oper)
  }

  // Raw buffer variants are provided here to support fancy bit packing semantics.
  /**
   * @param {KeyIn} key
   * @param {ValIn} oper
   */
  bitAnd(key, oper) {
    return this.atomicOp(MutationType.BitAnd, key, oper)
  }

  /**
   * @param {KeyIn} key
   * @param {ValIn} oper
   */
  bitOr(key, oper) {
    return this.atomicOp(MutationType.BitOr, key, oper)
  }

  /**
   * @param {KeyIn} key
   * @param {ValIn} oper
   */
  bitXor(key, oper) {
    return this.atomicOp(MutationType.BitXor, key, oper)
  }

  /**
   * @param {KeyIn} key
   * @param {Buffer} oper
   */
  bitAndBuf(key, oper) {
    return this.atomicOpKB(MutationType.BitAnd, key, oper)
  }

  /**
   * @param {KeyIn} key
   * @param {Buffer} oper
   */
  bitOrBuf(key, oper) {
    return this.atomicOpKB(MutationType.BitOr, key, oper)
  }

  /**
   * @param {KeyIn} key
   * @param {Buffer} oper
   */
  bitXorBuf(key, oper) {
    return this.atomicOpKB(MutationType.BitXor, key, oper)
  }

  // Performs lexicographic comparison of byte strings. Sets the value in the
  // database to the lexographical min / max of its current value and the
  // value supplied as a parameter. If the key does not exist in the database
  // this is the same as set().
  /**
   * @param {KeyIn} key
   * @param {ValIn} oper
   */
  byteMin(key, oper) {
    return this.atomicOp(MutationType.ByteMin, key, oper)
  }

  /**
   * @param {KeyIn} key
   * @param {ValIn} oper
   */
  byteMax(key, oper) {
    return this.atomicOp(MutationType.ByteMax, key, oper)
  }

  /**
   * @param {KeyIn} key
   * @param {ValIn} value
   * @param {boolean} [bakeAfterCommit]
   */
  setVersionstampedKey(key, value, bakeAfterCommit) {
    return this.doOneshot(tn => tn.setVersionstampedKey(key, value, bakeAfterCommit))
  }

  /**
   * @param {KeyIn} key
   * @param {ValIn} value
   * @param {Buffer} [suffix]
   */
  setVersionstampSuffixedKey(key, value, suffix) {
    return this.doOneshot(tn => tn.setVersionstampSuffixedKey(key, value, suffix))
  }

  /**
   * @param {KeyIn} key
   * @param {ValIn} value
   * @param {boolean} bakeAfterCommit
   */
  setVersionstampedValue(key, value, bakeAfterCommit = true) {
    return this.doOneshot(tn => tn.setVersionstampedValue(key, value, bakeAfterCommit))
  }

  /**
   * @param {KeyIn} key
   * @param {ValIn} [value]
   * @param {Buffer} [prefix]
   */
  setVersionstampPrefixedValue(key, value, prefix) {
    return this.doOneshot(tn => tn.setVersionstampPrefixedValue(key, value, prefix))
  }
}
