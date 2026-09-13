/* eslint-disable no-bitwise */
import { applyAtomic, applyAtomicChain } from './atomics.js'
import FDBError from './error.js'
import { StreamingMode } from './opts.g.js'
import { strNext } from './util.js'

/**
 * @import { MutationType } from './opts.g.js'
 * @import { NativeTransaction } from './native.js'
 * @import { KVList, NativeValue, Version, Watch } from './types.js'
 */

// ---------------------------------------------------------------------------
// Byte-key ordering helpers
// ---------------------------------------------------------------------------

/**
 * Lexicographic comparison of two packed keys.
 *
 * @param {Buffer} a
 * @param {Buffer} b
 * @returns {-1 | 0 | 1}
 */
const cmp = Buffer.compare

const EMPTY = Buffer.allocUnsafe(0)
const UNBOUNDED_END = Buffer.from([0xff])

/**
 * Do two half-open ranges [b1,e1) and [b2,e2) intersect?
 *
 * @param {Buffer} b1
 * @param {Buffer} e1
 * @param {Buffer} b2
 * @param {Buffer} e2
 * @returns {boolean}
 */
const rangesIntersect = (b1, e1, b2, e2) => cmp(b1, e2) < 0 && cmp(b2, e1) < 0

// ---------------------------------------------------------------------------
// Write buffer entries
// ---------------------------------------------------------------------------

/**
 * @typedef {{ type: 'set', value: Buffer }} SetEntry
 * @typedef {{
 *   type: 'atomic',
 *   ops: { opType: MutationType, operand: Buffer }[],
 *   overClear: boolean
 * }} AtomicEntry
 * @typedef {SetEntry | AtomicEntry} WriteEntry
 */

// ---------------------------------------------------------------------------
// SortedKeyMap: a sorted map keyed by packed Buffer key.
// ---------------------------------------------------------------------------

class SortedKeyMap {
  constructor() {
    /** @type {[Buffer, WriteEntry][]} */
    this.entries = []
  }

  /**
   * @param {Buffer} key
   * @returns {number}
   */
  _search(key) {
    let lo = 0
    let hi = this.entries.length - 1

    while (lo <= hi) {
      const mid = (lo + hi) >>> 1
      const c = cmp(this.entries[mid][0], key)

      if (c === 0) {
        return mid
      }

      if (c < 0) {
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }

    return ~lo
  }

  /**
   * @param {Buffer} key
   * @returns {WriteEntry | undefined}
   */
  get(key) {
    const i = this._search(key)

    return i >= 0 ? this.entries[i][1] : undefined
  }

  /**
   * @param {Buffer} key
   * @param {WriteEntry} entry
   */
  set(key, entry) {
    const i = this._search(key)

    if (i >= 0) {
      this.entries[i][1] = entry
    } else {
      this.entries.splice(~i, 0, [key, entry])
    }
  }

  /**
   * @param {Buffer} key
   */
  delete(key) {
    const i = this._search(key)

    if (i >= 0) {
      this.entries.splice(i, 1)
    }
  }

  /**
   * Index of the first entry with key >= `key`.
   *
   * @param {Buffer} key
   * @returns {number}
   */
  lowerBound(key) {
    const i = this._search(key)

    return i >= 0 ? i : ~i
  }

  /**
   * Iterate entries with begin <= key < end in ascending order.
   *
   * @param {Buffer} begin
   * @param {Buffer} [end]
   * @returns {IterableIterator<[Buffer, WriteEntry]>}
   */
  * range(begin, end) {
    for (let i = this.lowerBound(begin); i < this.entries.length; i++) {
      const [k, v] = this.entries[i]

      if (end !== undefined && cmp(k, end) >= 0) {
        break
      }

      yield [k, v]
    }
  }

  /**
   * Iterate entries with begin <= key < end in descending order.
   *
   * @param {Buffer} begin
   * @param {Buffer} [end]
   * @returns {IterableIterator<[Buffer, WriteEntry]>}
   */
  * rangeReverse(begin, end) {
    let i = end !== undefined ? this.lowerBound(end) : this.entries.length
    i -= 1

    for (; i >= 0; i--) {
      const [k, v] = this.entries[i]

      if (cmp(k, begin) < 0) {
        break
      }

      yield [k, v]
    }
  }
}

// ---------------------------------------------------------------------------
// RangeClearSet: a set of non-overlapping half-open ranges (clearRange).
// ---------------------------------------------------------------------------

// Kept sorted & coalesced by begin key. Used both as clearRange tombstones in
// the write buffer, and (separately) as the read/write conflict-range indexes
// when versioning is not needed.

class RangeSet {
  constructor() {
    /** @type {{ begin: Buffer, end: Buffer }[]} */
    this.ranges = []
  }

  /**
   * Add [begin, end), coalescing overlaps/adjacencies.
   *
   * @param {Buffer} begin
   * @param {Buffer} end
   */
  add(begin, end) {
    if (cmp(begin, end) >= 0) {
      return
    }

    /** @type {{ begin: Buffer, end: Buffer }[]} */
    const out = []
    let nb = begin
    let ne = end
    let inserted = false

    for (const r of this.ranges) {
      if (cmp(r.end, nb) < 0) {
        // r entirely before new range
        out.push(r)
      } else if (cmp(ne, r.begin) < 0) {
        // r entirely after new range
        if (!inserted) {
          out.push({ begin: nb, end: ne })
          inserted = true
        }

        out.push(r)
      } else {
        // overlap / adjacency: merge
        if (cmp(r.begin, nb) < 0) {
          nb = r.begin
        }

        if (cmp(r.end, ne) > 0) {
          ne = r.end
        }
      }
    }

    if (!inserted) {
      out.push({ begin: nb, end: ne })
    }

    this.ranges = out
  }

  /**
   * Does any stored range cover `key`?
   *
   * @param {Buffer} key
   * @returns {boolean}
   */
  covers(key) {
    for (const r of this.ranges) {
      if (cmp(r.begin, key) <= 0 && cmp(key, r.end) < 0) {
        return true
      }

      if (cmp(r.begin, key) > 0) {
        break
      }
    }

    return false
  }

  /**
   * Does any stored range intersect [begin, end)?
   *
   * @param {Buffer} begin
   * @param {Buffer} end
   * @returns {boolean}
   */
  intersects(begin, end) {
    for (const r of this.ranges) {
      if (rangesIntersect(r.begin, r.end, begin, end)) {
        return true
      }
    }

    return false
  }
}

// ---------------------------------------------------------------------------
// VersionedWriteRanges: write-conflict ranges tagged with a logical version.
// ---------------------------------------------------------------------------

// Each merged sibling appends its write-conflict ranges here at a fresh version.
// A child forked at version V, on merge, checks its read-set against every
// entry with version >= V. This yields FDB-style serializable conflict
// detection between the parent's timeline and its children, and between
// siblings (since a sibling's merge appends here, later siblings see it).

/**
 * @typedef {{ begin: Buffer, end: Buffer, version: number }} VersionedRange
 */

class VersionedWriteRanges {
  constructor() {
    /** @type {VersionedRange[]} */
    this.ranges = []
  }

  /**
   * @param {Buffer} begin
   * @param {Buffer} end
   * @param {number} version
   */
  add(begin, end, version) {
    if (cmp(begin, end) >= 0) {
      return
    }

    this.ranges.push({ begin, end, version })
  }

  /**
   * @param {Buffer} begin
   * @param {Buffer} end
   * @param {number} sinceVersion
   * @returns {boolean}
   */
  conflicts(begin, end, sinceVersion) {
    for (const r of this.ranges) {
      if (r.version > sinceVersion && rangesIntersect(r.begin, r.end, begin, end)) {
        return true
      }
    }

    return false
  }
}

// ---------------------------------------------------------------------------
// NestedLayer: one forked transaction's buffered state.
// ---------------------------------------------------------------------------

export class NestedLayer {
  /**
   * @param {NestedLayer} base
   */
  constructor(base) {
    /** @type {NestedLayer} */
    this.base = base

    /** @type {SortedKeyMap} */
    this.writes = new SortedKeyMap()

    /** @type {RangeSet} */
    this.clears = new RangeSet()

    /** @type {RangeSet} */
    this.readConflicts = new RangeSet()

    /** @type {RangeSet} */
    this.writeConflicts = new RangeSet()

    /** @type {VersionedWriteRanges} */
    this.childWriteIndex = new VersionedWriteRanges()

    /** @type {number} */
    this.version = 0

    /** @type {number} */
    this.baseVersion = base.version

    /** @type {number | undefined} */
    this.commitVersion = undefined

    /** @type {boolean} */
    this.merged = false

    /** @type {boolean} */
    this.aborted = false
  }

  abort() {
    if (!this.merged && !this.aborted) {
      this.aborted = true
    }
  }

  /**
   * @returns {void}
   * @throws {FDBError} code 1020 (not_committed) if the merge conflicts
   */
  merge() {
    const { base } = this

    if (!base) {
      throw new Error('Cannot merge the root transaction; use commit instead')
    }

    if (this.merged || this.aborted) {
      throw new Error('Transaction already finalized')
    }

    for (const r of this.readConflicts.ranges) {
      if (base.childWriteIndex.conflicts(r.begin, r.end, this.baseVersion)) {
        throw new FDBError('Nested transaction conflict - not committed', 1020)
      }
    }

    for (const r of this.readConflicts.ranges) {
      base.readConflicts.add(r.begin, r.end)
    }

    if (this.clears.ranges.length === 0 && this.writes.entries.length === 0 && this.writeConflicts.ranges.length === 0) {
      // no mutations or other side effects
      return
    }

    for (const r of this.clears.ranges) {
      base.clearRange(r.begin, r.end)
    }

    for (const [k, entry] of this.writes.entries) {
      if (entry.type === 'set') {
        base.set(k, entry.value)
      } else if (entry.overClear) {
        const v = applyAtomicChain(entry.ops, undefined)

        if (v === undefined) {
          base.clear(k)
        } else {
          base.set(k, v)
        }
      } else {
        for (const op of entry.ops) {
          base.atomicOp(op.opType, k, op.operand)
        }
      }
    }

    this.commitVersion = ++base.version

    for (const r of this.writeConflicts.ranges) {
      base.childWriteIndex.add(r.begin, r.end, this.commitVersion)
    }

    this.merged = true
  }

  // --- Writes -------------------------------------------------------------

  /**
   * @param {Buffer} key
   * @param {Buffer} value
   */
  set(key, value) {
    this.writes.set(key, { type: 'set', value })
    this.writeConflicts.add(key, strNext(key))
  }

  /**
   * @param {Buffer} key
   */
  clear(key) {
    const end = strNext(key)
    this.writes.delete(key)
    this.clears.add(key, end)
    this.writeConflicts.add(key, end)
  }

  /**
   * @param {Buffer} begin
   * @param {Buffer} end
   */
  clearRange(begin, end) {
    if (cmp(begin, end) >= 0) {
      return
    }

    this.clears.add(begin, end)

    for (const [k] of this.writes.range(begin, end)) {
      this.writes.delete(k)
    }

    this.writeConflicts.add(begin, end)
  }

  /**
   * @param {MutationType} opType
   * @param {Buffer} key
   * @param {Buffer} operand
   */
  atomicOp(opType, key, operand) {
    const existing = this.writes.get(key)

    if (existing === undefined) {
      const overClear = this.clears.covers(key)
      this.writes.set(key, { type: 'atomic', ops: [{ opType, operand }], overClear })
    } else if (existing.type === 'set') {
      // Fold the atomic op into the concrete value immediately.
      const folded = applyAtomic(opType, existing.value, operand)

      if (folded === undefined) {
        this.writes.delete(key)
        this.clears.add(key, strNext(key))
      } else {
        existing.value = folded
      }
    } else {
      existing.ops.push({ opType, operand })
    }

    this.writeConflicts.add(key, strNext(key))
  }

  /**
   * @param {Buffer} key
   * @param {boolean} snapshot
   * @returns {Promise<Buffer | undefined>}
   */
  async get(key, snapshot) {
    if (!snapshot) {
      this.readConflicts.add(key, strNext(key))
    }

    const local = localResolve(this, key)

    if (local.resolved) {
      return local.value
    }

    const baseValue = await this.base.get(key, snapshot)

    if (local.pendingOps) {
      return applyAtomicChain(local.pendingOps, local.overClear ? undefined : baseValue)
    }

    return baseValue
  }

  /**
   * @param {Buffer} start
   * @param {boolean} beginOrEq
   * @param {number} beginOffset
   * @param {Buffer} end
   * @param {boolean} endOrEq
   * @param {number} endOffset
   * @param {number} limit
   * @param {number} targetBytes
   * @param {number} mode
   * @param {number} iter
   * @param {boolean} snapshot
   * @param {boolean} reverse
   * @returns {Promise<KVList<Buffer, Buffer>>}
   */
  async getRange(
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
    snapshot,
    reverse,
  ) {
    const { results: baseBatch, more } = await this.base.getRange(
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
      snapshot,
      reverse,
    )

    // The requested boundaries as concrete keys. The Transaction layer always
    // drives getRange with offset-1 selectors (firstGreaterOrEqual /
    // firstGreaterThan), which map directly to a boundary key.
    const startKey = boundaryKey(start, beginOrEq, beginOffset)
    const endKey = boundaryKey(end, endOrEq, endOffset)

    // The span this batch covers: from the requested start up to (and including)
    // the last base key when there is more to come, otherwise the whole request.
    let spanLo
    let spanHi

    if (!reverse) {
      spanLo = startKey
      spanHi = more && baseBatch.length ? strNext(baseBatch[baseBatch.length - 1][0]) : endKey
    } else {
      spanLo = more && baseBatch.length ? baseBatch[baseBatch.length - 1][0] : startKey
      spanHi = endKey
    }

    if (!snapshot) {
      this.readConflicts.add(spanLo, spanHi)
    }

    /** @type {LocalEffect[]} */
    const local = []
    const bufIter = reverse ? this.writes.rangeReverse(spanLo, spanHi) : this.writes.range(spanLo, spanHi)

    for (const [k, entry] of bufIter) {
      if (entry.type === 'set') {
        local.push({ key: k, value: entry.value })
      } else if (entry.type === 'clear') {
        local.push({ key: k, cleared: true })
      } else {
        local.push({ key: k, atomic: entry.ops, overClear: entry.overClear })
      }
    }

    /** @type {[Buffer, Buffer][]} */
    const results = []
    const dir = reverse ? -1 : 1
    let li = 0
    let bi = 0

    while (li < local.length || bi < baseBatch.length) {
      const l = li < local.length ? local[li] : undefined
      const b = bi < baseBatch.length ? baseBatch[bi] : undefined

      let c = 0

      if (l === undefined) {
        c = 1
      } else if (b === undefined) {
        c = -1
      } else {
        c = cmp(l.key, b[0]) * dir
      }

      if (b === undefined || c < 0) {
        // Buffered key only.
        const eff = /** @type {LocalEffect} */(l)
        const v = resolveEffect(eff, undefined)
        li += 1

        if (v !== undefined) {
          results.push([eff.key, v])
        }
      } else if (l === undefined || c > 0) {
        // Base key only: pass through unless a clearRange tombstone hides it.
        const [bk, bv] = b

        if (!this.clears.covers(bk)) {
          results.push([bk, bv])
        }

        bi += 1
      } else {
        // Same key: buffered effect overlays the base value.
        const v = resolveEffect(l, b[1])
        li += 1
        bi += 1

        if (v !== undefined) {
          results.push([l.key, v])
        }
      }
    }

    return { results, more }
  }

  /**
   * @this {NestedLayer}
   * @param {Buffer} key
   * @param {boolean} orEqual
   * @param {number} offset
   * @param {boolean} snapshot
   * @returns {Promise<Buffer>}
   */
  async getKey(key, orEqual, offset, snapshot) {
    let found

    if (offset <= 0) {
      const upper = orEqual ? strNext(key) : key
      let remaining = -offset

      for await (const k of walkKeys(this, EMPTY, upper, true)) {
        found = k

        if (remaining === 0) {
          break
        }

        remaining -= 1
      }
    } else {
      const lower = orEqual ? strNext(key) : key
      let remaining = offset - 1

      for await (const k of walkKeys(this, lower, UNBOUNDED_END, false)) {
        found = k

        if (remaining === 0) {
          break
        }

        remaining -= 1
      }

      if (remaining > 0) {
        found = undefined
      }
    }

    if (!snapshot) {
      const ref = orEqual ? strNext(key) : key

      if (offset <= 0) {
        this.readConflicts.add(found ?? EMPTY, ref)
      } else {
        this.readConflicts.add(ref, found !== undefined ? strNext(found) : UNBOUNDED_END)
      }
    }

    // NativeTransaction.getKey returns the empty buffer when no key matches.
    return found ?? EMPTY
  }
}

// ---------------------------------------------------------------------------
// Layered range reads (read-your-writes over a base batch).
// ---------------------------------------------------------------------------

/**
 * @typedef {{ key: Buffer, value: Buffer } | { key: Buffer, cleared: true } | {
 *   key: Buffer, atomic: { opType: MutationType, operand: Buffer }[], overClear: boolean
 * }} LocalEffect
 */

/**
 * @param {LocalEffect} eff
 * @param {Buffer | undefined} baseValue
 * @returns {Buffer | undefined}
 */
function resolveEffect(eff, baseValue) {
  if ('value' in eff) {
    return eff.value
  }

  if ('cleared' in eff) {
    return undefined
  }

  return applyAtomicChain(eff.atomic, eff.overClear ? undefined : baseValue)
}

/**
 * @param {Buffer} key
 * @param {boolean} orEqual
 * @param {number} offset
 * @returns {Buffer}
 */
function boundaryKey(key, orEqual, offset) {
  if (offset === 1 && orEqual === true) {
    return strNext(key) // firstGreaterThan(key)
  }

  return key // firstGreaterOrEqual(key), or best-effort for other selectors
}

// ---------------------------------------------------------------------------
// Key selector resolution over the merged view.
// ---------------------------------------------------------------------------

// Key selectors resolve differently against a nested transaction than against
// the raw database, because buffered writes change which keys exist. We resolve
// them by walking the merged view via this layer's own getRange (paging the
// same way a caller would page a native getRange).

/**
 * @param {NestedLayer} layer
 * @param {Buffer} start
 * @param {Buffer} end
 * @param {boolean} reverse
 * @returns {AsyncIterableIterator<Buffer>}
 */
async function* walkKeys(layer, start, end, reverse) {
  let iter = 0

  for (;;) {
    const { results, more } = await layer.getRange(
      start,
      false,
      1,
      end,
      false,
      1,
      0,
      0,
      StreamingMode.Iterator,
      ++iter,
      true,
      reverse,
    )

    for (const [k] of results) {
      yield k
    }

    if (!more || results.length === 0) {
      break
    }

    const lastKey = results[results.length - 1][0]

    if (!reverse) {
      start = strNext(lastKey)
    } else {
      end = lastKey
    }
  }
}

/**
 * @param {NestedLayer} layer
 * @param {Buffer} key
 * @returns {{
 *   resolved: boolean
 *   value?: Buffer | undefined
 *   pendingOps?: { opType: MutationType, operand: Buffer }[]
 *   overClear?: boolean
 * }}
 */
function localResolve(layer, key) {
  const entry = layer.writes.get(key)

  if (entry !== undefined) {
    if (entry.type === 'set') {
      return { resolved: true, value: entry.value }
    }

    if (entry.overClear) {
      return { resolved: true, value: applyAtomicChain(entry.ops, undefined) }
    }

    return { resolved: false, pendingOps: entry.ops, overClear: false }
  }

  if (layer.clears.covers(key)) {
    return { resolved: true, value: undefined }
  }

  return { resolved: false }
}

// ---------------------------------------------------------------------------
// Fork & merge
// ---------------------------------------------------------------------------

export class NestedTransaction {
  /**
   * @param {NestedLayer} layer
   */
  constructor(layer) {
    /** @type {NestedLayer} */
    this._layer = layer
  }

  /**
   * @returns {NestedTransaction}
   */
  createTransaction() {
    if (this._layer.merged || this._layer.aborted) {
      throw new Error('Cannot fork a merged or aborted transaction')
    }

    return new NestedTransaction(new NestedLayer(this._layer))
  }

  /**
   * @returns {Promise<void>}
   */
  async commit() {
    this._layer.merge()
  }

  /**
   * @returns {void}
   */
  cancel() {
    this._layer.abort()
  }

  /**
   * @param {number} _code
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line typescript/no-unused-vars
  async onError(_code) {
    this._layer.abort()
  }

  /**
   * @param {Buffer} key
   * @param {boolean} isSnapshot
   * @returns {Promise<Buffer | undefined>}
   */
  get(key, isSnapshot) {
    return this._layer.get(key, isSnapshot)
  }

  /**
   * @param {Buffer} key
   * @param {boolean} orEqual
   * @param {number} offset
   * @param {boolean} isSnapshot
   * @returns {Promise<Buffer>}
   */
  getKey(key, orEqual, offset, isSnapshot) {
    return this._layer.getKey(key, orEqual, offset, isSnapshot)
  }

  /**
   * @param {Buffer} start
   * @param {boolean} beginOrEq
   * @param {number} beginOffset
   * @param {Buffer} end
   * @param {boolean} endOrEq
   * @param {number} endOffset
   * @param {number} limit
   * @param {number} targetBytes
   * @param {number} mode
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
    return this._layer.getRange(
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
   * @param {Buffer} key
   * @param {Buffer} value
   * @returns {void}
   */
  set(key, value) {
    this._layer.set(key, value)
  }

  /**
   * @param {Buffer} key
   * @returns {void}
   */
  clear(key) {
    this._layer.clear(key)
  }

  /**
   * @param {Buffer} start
   * @param {Buffer} end
   * @returns {void}
   */
  clearRange(start, end) {
    this._layer.clearRange(start, end)
  }

  /**
   * @param {MutationType} opType
   * @param {Buffer} key
   * @param {Buffer} operand
   * @returns {void}
   */
  atomicOp(opType, key, operand) {
    this._layer.atomicOp(opType, key, operand)
  }

  /**
   * @param {Buffer} start
   * @param {Buffer} end
   * @returns {void}
   */
  addReadConflictRange(start, end) {
    this._layer.readConflicts.add(start, end)
  }

  /**
   * @param {Buffer} start
   * @param {Buffer} end
   * @returns {void}
   */
  addWriteConflictRange(start, end) {
    this._layer.writeConflicts.add(start, end)
  }

  /**
   * @param {Buffer} key
   * @param {boolean} ignoreStandardErrs
   * @returns {Watch}
   */
  watch(key, ignoreStandardErrs) {
    return this._base.watch(key, ignoreStandardErrs)
  }

  /**
   * @param {number} version
   * @returns {void}
   */
  setReadVersion(version) {
    this._base.setReadVersion(version)
  }

  /**
   * @returns {number}
   */
  getReadVersion() {
    return this._layer.baseVersion
  }

  /**
   * @returns {number | undefined}
   */
  getCommittedVersion() {
    return this._layer.version
  }
}
