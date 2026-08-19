/* eslint-disable import/prefer-default-export */
import { NestedLayer, NestedTransaction, forkLayer } from './nested.js'

/**
 * @import { NativeTransaction } from './native.js'
 * @import { KVList, NativeValue, Version, Watch } from './types.js'
 * @import { MutationType, StreamingMode } from './opts.g.js'
 */

/**
 * A passthrough native transaction which adds `createTransaction()` for opening
 * nested transactions. See nested.js.
 */
export class FoundationDbTransaction {
  /**
   * @param {NativeTransaction} tn
   */
  constructor(tn) {
    /** @type {NativeTransaction} */
    this._tn = tn

    /** @type {NestedLayer} */
    this._layer = new NestedLayer(this, undefined)
  }

  /**
   * @returns {NestedTransaction}
   */
  createTransaction() {
    return new NestedTransaction(this, forkLayer(this._layer))
  }

  /**
   * @returns {Promise<void>}
   */
  commit() {
    return this._tn.commit()
  }

  reset() {
    this._tn.reset()
  }

  cancel() {
    this._tn.cancel()
  }

  /**
   * @param {number} code
   * @returns {Promise<void>}
   */
  onError(code) {
    return this._tn.onError(code)
  }

  /**
   * @param {number} code
   * @param {string | number | Buffer | null} param
   */
  setOption(code, param) {
    this._tn.setOption(code, param)
  }

  /**
   * @returns {Promise<number>}
   */
  getApproximateSize() {
    return this._tn.getApproximateSize()
  }

  /**
   * @param {NativeValue} key
   * @param {boolean} isSnapshot
   * @returns {Promise<Buffer | undefined>}
   */
  get(key, isSnapshot) {
    return this._tn.get(key, isSnapshot)
  }

  /**
   * @param {NativeValue} key
   * @param {boolean} orEqual
   * @param {number} offset
   * @param {boolean} isSnapshot
   * @returns {Promise<Buffer>}
   */
  getKey(key, orEqual, offset, isSnapshot) {
    return this._tn.getKey(key, orEqual, offset, isSnapshot)
  }

  /**
   * @param {NativeValue} start
   * @param {boolean} beginOrEq
   * @param {number} beginOffset
   * @param {NativeValue} end
   * @param {boolean} endOrEq
   * @param {number} endOffset
   * @param {number} limit
   * @param {number} targetBytes
   * @param {StreamingMode} mode
   * @param {number} iter
   * @param {boolean} isSnapshot
   * @param {boolean} reverse
   * @returns {Promise<KVList<Buffer, Buffer>>}
   */
  getRange(
    start,
    beginOrEq,
    beginOffset,
    end,
    endOrEq,
    endOffset,
    limit,
    targetBytes,
    mode,
    iter,
    isSnapshot,
    reverse,
  ) {
    return this._tn.getRange(
      start,
      beginOrEq,
      beginOffset,
      end,
      endOrEq,
      endOffset,
      limit,
      targetBytes,
      mode,
      iter,
      isSnapshot,
      reverse,
    )
  }

  /**
   * @param {NativeValue} start
   * @param {NativeValue} end
   * @returns {Promise<number>}
   */
  getEstimatedRangeSizeBytes(start, end) {
    return this._tn.getEstimatedRangeSizeBytes(start, end)
  }

  /**
   * @param {NativeValue} start
   * @param {NativeValue} end
   * @param {number} chunkSize
   * @returns {Promise<Buffer[]>}
   */
  getRangeSplitPoints(start, end, chunkSize) {
    return this._tn.getRangeSplitPoints(start, end, chunkSize)
  }

  /**
   * @param {NativeValue} key
   * @param {NativeValue} value
   */
  set(key, value) {
    this._tn.set(key, value)
  }

  /**
   * @param {NativeValue} key
   */
  clear(key) {
    this._tn.clear(key)
  }

  /**
   * @param {NativeValue} start
   * @param {NativeValue} end
   */
  clearRange(start, end) {
    this._tn.clearRange(start, end)
  }

  /**
   * @param {MutationType} opType
   * @param {NativeValue} key
   * @param {NativeValue} operand
   */
  atomicOp(opType, key, operand) {
    this._tn.atomicOp(opType, key, operand)
  }

  /**
   * @param {NativeValue} start
   * @param {NativeValue} end
   */
  addReadConflictRange(start, end) {
    this._tn.addReadConflictRange(start, end)
  }

  /**
   * @param {NativeValue} start
   * @param {NativeValue} end
   */
  addWriteConflictRange(start, end) {
    this._tn.addWriteConflictRange(start, end)
  }

  /**
   * @param {NativeValue} key
   * @param {boolean} ignoreStandardErrs
   * @returns {Watch}
   */
  watch(key, ignoreStandardErrs) {
    return this._tn.watch(key, ignoreStandardErrs)
  }

  /**
   * @param {Version} v
   */
  setReadVersion(v) {
    this._tn.setReadVersion(v)
  }

  /**
   * @returns {Promise<Version>}
   */
  getReadVersion() {
    return this._tn.getReadVersion()
  }

  /**
   * @returns {Version}
   */
  getCommittedVersion() {
    return this._tn.getCommittedVersion()
  }

  /**
   * @returns {Promise<Buffer>}
   */
  getVersionstamp() {
    return this._tn.getVersionstamp()
  }

  /**
   * @param {NativeValue} key
   * @returns {Promise<string[]>}
   */
  getAddressesForKey(key) {
    return this._tn.getAddressesForKey(key)
  }
}
