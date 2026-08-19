// Nested / forked transaction overlay engine.
//
// This implements an application-level buffering layer on top of a single
// underlying FoundationDB transaction. It is only activated when a Transaction
// is `fork()`ed. Until then, a Transaction behaves as a plain pass-through to
// the native `_tn`.
//
// Design (see discussion / README):
//
// - A `NestedLayer` holds the read-your-writes (RYW) buffer, the read-conflict
//   ranges, and the write-conflict ranges for one forked transaction. Layers
//   form a chain: a child layer's `base` is its parent layer (or `undefined`
//   for the root, whose base is the real FDB transaction).
//
// - The parent plays the role FDB's storage layer plays for a normal
//   transaction. When a child is forked it snapshots the parent's monotonic
//   `version`. On merge, the child's read-set is checked against every
//   write-conflict range added to the parent *at or after* that version. If any
//   intersect, the merge conflicts (retryable). Otherwise the child's buffered
//   writes are replayed into the parent and the parent's version is bumped.
//
// All keys handled here are already *packed* (Buffers). Encoding/decoding via
// the subspace happens in Transaction before calling into this engine.

/* eslint-disable no-bitwise */
import { applyAtomic, applyAtomicChain } from './atomics.js'
import { strNext } from './util.js'

/**
 * @import { MutationType } from './opts.g.js'
 */

// ---------------------------------------------------------------------------
// Byte-key ordering helpers
// ---------------------------------------------------------------------------

/**
 * Lexicographic comparison of two packed keys.
 *
 * @param {Buffer} a
 * @param {Buffer} b
 * @returns {number} -1, 0 or 1
 */
export const cmp = (a, b) => a.compare(b)

// Default exclusive upper bound for an "unbounded" forward scan. The user
// keyspace ends before the system keyspace (which begins at 0xff), so this is
// the conventional end-of-userspace boundary.
export const UNBOUNDED_END = Buffer.from([0xff])

/**
 * Half-open range [begin, end). `end === undefined` means unbounded (all keys
 * >= begin). We never need an unbounded begin here because packed ranges always
 * have a concrete begin.
 *
 * @typedef {{ begin: Buffer, end: Buffer }} Range
 */

/**
 * Do two half-open ranges [b1,e1) and [b2,e2) intersect?
 *
 * @param {Buffer} b1
 * @param {Buffer} e1
 * @param {Buffer} b2
 * @param {Buffer} e2
 * @returns {boolean}
 */
export const rangesIntersect = (b1, e1, b2, e2) => cmp(b1, e2) < 0 && cmp(b2, e1) < 0

// ---------------------------------------------------------------------------
// Write buffer entries
// ---------------------------------------------------------------------------

// A single key can carry, in order of application within this layer:
//   - a clear (tombstone), then optionally
//   - a set (concrete value), or
//   - a chain of atomic ops layered over whatever the base resolves to.
//
// We represent a key's buffered mutation as one of:
//   { type: 'set', value: Buffer }
//   { type: 'clear' }
//   { type: 'atomic', ops: [{ opType, operand }], overClear: boolean }
//
// `overClear` on an atomic entry records that a clear happened in THIS layer
// before the atomic op(s), so read resolution must treat the base value as
// absent (undefined) rather than falling through to the base layer. This
// preserves ordering semantics like `clear(k); add(k, 1)`.

/**
 * @typedef {{ type: 'set', value: Buffer }} SetEntry
 * @typedef {{ type: 'clear' }} ClearEntry
 * @typedef {{
 *   type: 'atomic',
 *   ops: { opType: MutationType, operand: Buffer }[],
 *   overClear: boolean
 * }} AtomicEntry
 * @typedef {SetEntry | ClearEntry | AtomicEntry} WriteEntry
 */

// ---------------------------------------------------------------------------
// SortedKeyMap: a sorted map keyed by packed Buffer key.
// ---------------------------------------------------------------------------

// Implemented as a sorted array of [keyBuffer, WriteEntry] with binary search.
// This is O(n) insert in the worst case but keeps range merges trivial and
// correct, which is what matters for a first correct implementation. It can be
// swapped for a balanced tree later without changing callers.

export class SortedKeyMap {
  constructor() {
    /** @type {[Buffer, WriteEntry][]} */
    this.entries = []
  }

  /**
   * Binary search for the index of `key`, or the insertion point (bitwise
   * complement) if absent. Returns index >= 0 if found.
   *
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

export class RangeSet {
  constructor() {
    /** @type {Range[]} */
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

    /** @type {Range[]} */
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

export class VersionedWriteRanges {
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
   * Is there any write range with version >= `sinceVersion` that intersects
   * [begin, end)?
   *
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
// RawBase: adapts the native transaction (_tn) to the ResolvedBase interface.
// ---------------------------------------------------------------------------

/**
 * The read interface a layer needs from whatever sits beneath it. Both the
 * native transaction (via RawBase) and a NestedLayer implement this.
 *
 * @typedef {{
 *   readKey(key: Buffer, snapshot: boolean): Promise<Buffer | undefined>
 *   readRange(begin: Buffer, end: Buffer | undefined, reverse: boolean, snapshot: boolean): AsyncIterableIterator<[Buffer, Buffer]>
 * }} ResolvedBase
 */

/**
 * A write sink: something buffered writes can be replayed into. Both a
 * NestedLayer and RawBase implement this so a child can merge into either its
 * parent layer or (for the root) directly into the native transaction.
 *
 * @typedef {{
 *   set(key: Buffer, value: Buffer): void
 *   clear(key: Buffer): void
 *   clearRange(begin: Buffer, end: Buffer): void
 *   atomicOp(opType: MutationType, key: Buffer, operand: Buffer): void
 * }} WriteSink
 */

/**
 * Wraps a native transaction so a NestedLayer can read through it. Conflict
 * recording at this level is delegated to the native transaction implicitly
 * (a native get() already registers a read conflict range unless snapshot).
 *
 * @implements {ResolvedBase}
 * @implements {WriteSink}
 */
export class RawBase {
  /**
   * @param {import('./native.js').NativeTransaction} tn
   */
  constructor(tn) {
    this._tn = tn
  }

  /**
   * @param {Buffer} key
   * @param {Buffer} value
   */
  set(key, value) {
    this._tn.set(key, value)
  }

  /**
   * @param {Buffer} key
   */
  clear(key) {
    this._tn.clear(key)
  }

  /**
   * @param {Buffer} begin
   * @param {Buffer} end
   */
  clearRange(begin, end) {
    this._tn.clearRange(begin, end)
  }

  /**
   * @param {MutationType} opType
   * @param {Buffer} key
   * @param {Buffer} operand
   */
  atomicOp(opType, key, operand) {
    this._tn.atomicOp(opType, key, operand)
  }

  /**
   * @param {Buffer} key
   * @param {boolean} snapshot
   * @returns {Promise<Buffer | undefined>}
   */
  readKey(key, snapshot) {
    return this._tn.get(key, snapshot)
  }

  /**
   * @param {Buffer} begin
   * @param {Buffer} end
   * @param {boolean} reverse
   * @param {boolean} snapshot
   * @returns {AsyncIterableIterator<[Buffer, Buffer]>}
   */
  async* readRange(begin, end, reverse, snapshot) {
    const { StreamingMode } = await import('./opts.g.js')
    let iter = 0
    let b = begin
    let e = end ?? UNBOUNDED_END

    for (;;) {
      const { results, more } = await this._tn.getRange(
        b,
        false,
        1,
        e,
        false,
        1,
        0,
        0,
        StreamingMode.Iterator,
        ++iter,
        snapshot,
        reverse,
      )

      for (const pair of results) {
        yield pair
      }

      if (!more || results.length === 0) {
        break
      }

      const [lastKey] = results[results.length - 1]

      if (!reverse) {
        b = strNext(lastKey)
      } else {
        e = lastKey
      }
    }
  }
}

// ---------------------------------------------------------------------------
// NestedLayer: one forked transaction's buffered state.
// ---------------------------------------------------------------------------

export class NestedLayer {
  /**
   * @param {ResolvedBase} base The layer or RawBase beneath this one.
   * @param {NestedLayer | undefined} parentLayer The parent NestedLayer, if the base is a layer.
   * @param {WriteSink} [rootSink] If provided, this is a ROOT layer: its own
   *   writes flush straight to the sink (the native transaction) instead of
   *   being buffered, and reads fall straight through to `base`. The root still
   *   tracks `childWriteIndex`/`version` for sibling conflict detection.
   */
  constructor(base, parentLayer, rootSink) {
    /** @type {ResolvedBase} */
    this.base = base

    /** @type {NestedLayer | undefined} */
    this.parentLayer = parentLayer

    /** @type {WriteSink | undefined} */
    this.rootSink = rootSink

    // Read-your-writes buffer: per-key mutation entries.
    /** @type {SortedKeyMap} */
    this.writes = new SortedKeyMap()

    // clearRange tombstones. A point/range read must treat any key covered
    // here (and not subsequently re-set) as absent.
    /** @type {RangeSet} */
    this.clears = new RangeSet()

    // Read-conflict ranges accumulated by this layer's non-snapshot reads.
    /** @type {RangeSet} */
    this.readConflicts = new RangeSet()

    // Write-conflict ranges produced by this layer's writes.
    /** @type {RangeSet} */
    this.writeConflicts = new RangeSet()

    // Versioned write index used to validate this layer's *children* on merge.
    /** @type {VersionedWriteRanges} */
    this.childWriteIndex = new VersionedWriteRanges()

    // Monotonic logical version. Bumped every time a child merges into this
    // layer. A child records this at fork time as its `baseVersion`.
    /** @type {number} */
    this.version = 0

    // The parent's version at the moment this layer was forked. Used on merge.
    /** @type {number} */
    this.baseVersion = parentLayer ? parentLayer.version : 0

    // Count of outstanding (un-merged, un-aborted) children. A layer/txn may
    // not commit while this is > 0.
    /** @type {number} */
    this.outstandingChildren = 0

    /** @type {boolean} */
    this.merged = false

    /** @type {boolean} */
    this.aborted = false
  }

  // --- Writes -------------------------------------------------------------

  /**
   * @param {Buffer} key
   * @param {Buffer} value
   */
  set(key, value) {
    if (this.rootSink) {
      this.rootSink.set(key, value)

      return
    }

    this.writes.set(key, { type: 'set', value })
    this.writeConflicts.add(key, strNext(key))
  }

  /**
   * @param {Buffer} key
   */
  clear(key) {
    if (this.rootSink) {
      this.rootSink.clear(key)

      return
    }

    this.writes.set(key, { type: 'clear' })
    this.writeConflicts.add(key, strNext(key))
    // A single-key clear is also a (degenerate) clearRange for read purposes;
    // but since we record an explicit per-key clear entry, range reads pick it
    // up from `writes`. We still add to `clears` so range scans uniformly see
    // absence even before any set overrides it.
    this.clears.add(key, strNext(key))
  }

  /**
   * @param {Buffer} begin
   * @param {Buffer} end
   */
  clearRange(begin, end) {
    if (cmp(begin, end) >= 0) {
      return
    }

    if (this.rootSink) {
      this.rootSink.clearRange(begin, end)

      return
    }

    this.clears.add(begin, end)

    // Remove any buffered per-key writes shadowed by this clear, so read
    // resolution doesn't resurrect them.
    for (const [k] of [...this.writes.range(begin, end)]) {
      this.writes.set(k, { type: 'clear' })
    }

    this.writeConflicts.add(begin, end)
  }

  /**
   * @param {MutationType} opType
   * @param {Buffer} key
   * @param {Buffer} operand
   */
  atomicOp(opType, key, operand) {
    if (this.rootSink) {
      this.rootSink.atomicOp(opType, key, operand)

      return
    }

    const existing = this.writes.get(key)

    if (existing === undefined) {
      const overClear = this.clears.covers(key)
      this.writes.set(key, { type: 'atomic', ops: [{ opType, operand }], overClear })
    } else if (existing.type === 'set') {
      // Fold the atomic op into the concrete value immediately.
      const folded = applyAtomic(opType, existing.value, operand)

      if (folded === undefined) {
        this.writes.set(key, { type: 'clear' })
      } else {
        existing.value = folded
      }
    } else if (existing.type === 'clear') {
      this.writes.set(key, { type: 'atomic', ops: [{ opType, operand }], overClear: true })
    } else {
      existing.ops.push({ opType, operand })
    }

    this.writeConflicts.add(key, strNext(key))
  }

  // --- Reads --------------------------------------------------------------

  /**
   * Resolve a point read of `key` through this layer and its base chain.
   *
   * @param {Buffer} key
   * @param {boolean} snapshot
   * @returns {Promise<Buffer | undefined>}
   */
  async readKey(key, snapshot) {
    if (!snapshot) {
      this.readConflicts.add(key, strNext(key))
    }

    const local = this._localResolve(key)

    if (local.resolved) {
      return local.value
    }

    // Fall through to the base. If we have layered atomic ops with no local
    // concrete base, resolve the base value then apply them.
    const baseValue = await this.base.readKey(key, snapshot)

    if (local.pendingOps) {
      return applyAtomicChain(local.pendingOps, local.overClear ? undefined : baseValue)
    }

    return baseValue
  }

  /**
   * Resolve `key` using only THIS layer's buffer (no base access).
   *
   * @param {Buffer} key
   * @returns {{
   *   resolved: boolean,
   *   value?: Buffer | undefined,
   *   pendingOps?: { opType: MutationType, operand: Buffer }[],
   *   overClear?: boolean
   * }}
   */
  _localResolve(key) {
    const entry = this.writes.get(key)

    if (entry !== undefined) {
      if (entry.type === 'set') {
        return { resolved: true, value: entry.value }
      }

      if (entry.type === 'clear') {
        return { resolved: true, value: undefined }
      }

      // atomic
      if (entry.overClear) {
        return { resolved: true, value: applyAtomicChain(entry.ops, undefined) }
      }

      return { resolved: false, pendingOps: entry.ops, overClear: false }
    }

    if (this.clears.covers(key)) {
      return { resolved: true, value: undefined }
    }

    return { resolved: false }
  }
}

// ---------------------------------------------------------------------------
// Layered range reads (read-your-writes over a base stream).
// ---------------------------------------------------------------------------

/**
 * @typedef {{ key: Buffer, value: Buffer } | { key: Buffer, cleared: true } | {
 *   key: Buffer, atomic: { opType: MutationType, operand: Buffer }[], overClear: boolean
 * }} LocalEffect
 */

/**
 * NestedLayer range read: merges the base stream with this layer's buffered
 * effects. Returns concrete [key, value] pairs in key order (or reverse).
 *
 * @this {NestedLayer}
 * @param {Buffer} begin
 * @param {Buffer | undefined} end
 * @param {boolean} reverse
 * @param {boolean} snapshot
 * @returns {AsyncIterableIterator<[Buffer, Buffer]>}
 */
async function* layerReadRange(begin, end, reverse, snapshot) {
  if (!snapshot) {
    this.readConflicts.add(begin, end ?? UNBOUNDED_END)
  }

  // Local buffered effects (sets/clears/atomics) for keys in [begin, end).
  /** @type {LocalEffect[]} */
  const local = []
  const iter = reverse ? this.writes.rangeReverse(begin, end) : this.writes.range(begin, end)

  for (const [k, entry] of iter) {
    if (entry.type === 'set') {
      local.push({ key: k, value: entry.value })
    } else if (entry.type === 'clear') {
      local.push({ key: k, cleared: true })
    } else {
      local.push({ key: k, atomic: entry.ops, overClear: entry.overClear })
    }
  }

  // Base stream. For non-snapshot we still let the base register its own read
  // conflict (RawBase) but the outermost layer already recorded the whole range
  // above; deeper layers rely on their own readConflicts. Base reads use the
  // same snapshot flag.
  const baseIter = this.base.readRange(begin, end, reverse, snapshot)[Symbol.asyncIterator]()

  let li = 0
  let basePair = await baseIter.next()

  const dir = reverse ? -1 : 1

  const takeLocal = () => local[li++]
  const peekLocal = () => (li < local.length ? local[li] : undefined)

  /**
   * Resolve a local effect that may need the base value (unresolved atomic
   * over a non-cleared base). `baseValue` is the base's value for that key or
   * undefined.
   *
   * @param {LocalEffect} eff
   * @param {Buffer | undefined} baseValue
   * @returns {Buffer | undefined}
   */
  const resolveEffect = (eff, baseValue) => {
    if ('value' in eff) {
      return eff.value
    }

    if ('cleared' in eff) {
      return undefined
    }

    return applyAtomicChain(eff.atomic, eff.overClear ? undefined : baseValue)
  }

  for (;;) {
    const l = peekLocal()
    const bDone = basePair.done
    const b = bDone ? undefined : basePair.value

    if (l === undefined && b === undefined) {
      break
    }

    let c

    if (l === undefined) {
      c = 1 // only base left
    } else if (b === undefined) {
      c = -1 // only local left
    } else {
      c = cmp(l.key, b[0]) * dir
    }

    if (c < 0) {
      // Local key strictly before base key: no base value to fold in.
      const eff = /** @type {LocalEffect} */(l)
      const v = resolveEffect(eff, undefined)
      takeLocal()

      if (v !== undefined) {
        yield [eff.key, v]
      }
    } else if (c > 0) {
      // Base key strictly before local key: pass through unless a clearRange
      // tombstone (not represented as a per-key write) hides it.
      const [bk, bv] = /** @type {[Buffer, Buffer]} */(b)

      if (!this.clears.covers(bk)) {
        yield [bk, bv]
      }

      basePair = await baseIter.next()
    } else {
      // Same key in both: local overlays base.
      const [, bv] = /** @type {[Buffer, Buffer]} */(b)
      const v = resolveEffect(/** @type {LocalEffect} */(l), bv)
      takeLocal()
      basePair = await baseIter.next()

      if (v !== undefined) {
        yield [/** @type {LocalEffect} */(l).key, v]
      }
    }
  }
}

NestedLayer.prototype.readRange = layerReadRange

// ---------------------------------------------------------------------------
// Key selector resolution over the merged view.
// ---------------------------------------------------------------------------

// FDB key selectors resolve as: find the last key < reference (or <= if
// orEqual), then step `offset` keys forward (offset may be negative). The
// merged (read-your-writes) view changes which keys exist, so we must resolve
// against it, not the raw base.
//
// Strategy: reduce (key, orEqual) to an "anchor" and a remaining integer
// offset relative to a firstGreaterOrEqual-style scan, then walk the merged
// stream. This mirrors the reference resolution algorithm; it is O(offset +
// scanned keys). For large offsets this streams lazily.

/**
 * Resolve a key selector to a concrete key (or undefined if it falls outside
 * any resolvable key) against the merged view of this layer.
 *
 * @this {NestedLayer}
 * @param {Buffer} key
 * @param {boolean} orEqual
 * @param {number} offset
 * @param {boolean} snapshot
 * @returns {Promise<Buffer | undefined>}
 */
async function layerReadKeySelector(key, orEqual, offset, snapshot) {
  // Normalize to firstGreaterThan/firstGreaterOrEqual semantics.
  // firstGreaterThan(key) == (key, orEqual=true, offset=1)
  // firstGreaterOrEqual(key) == (key, orEqual=false, offset=1)
  //
  // General: resolve base position P = last key satisfying (< key) or (<= key
  // if orEqual). Then the target is the key `offset` steps after P in sorted
  // order. We implement by converting to a forward or backward scan from an
  // inclusive/exclusive boundary.

  if (offset <= 0) {
    // Scan backwards. We want the |offset| + (orEqual?0:... )th key at or
    // before the reference. Convert: we need keys strictly less-than-or-equal
    // depending on orEqual.
    // Boundary: keys we consider are those < key (orEqual false) or <= key.
    const upper = orEqual ? strNext(key) : key // exclusive end for reverse scan
    let remaining = -offset // number of steps back from the boundary key
    let last

    for await (const [k] of this.readRange(Buffer.alloc(0), upper, true, snapshot)) {
      last = k

      if (remaining === 0) {
        break
      }

      remaining -= 1
    }

    if (last === undefined) {
      return undefined
    }

    if (!snapshot) {
      this.readConflicts.add(last, strNext(last))
    }

    return last
  }

  // offset >= 1: forward scan.
  // Boundary: first key >= key (orEqual false) or > key (orEqual true).
  const lower = orEqual ? strNext(key) : key
  let remaining = offset - 1
  let found

  for await (const [k] of this.readRange(lower, undefined, false, snapshot)) {
    found = k

    if (remaining === 0) {
      break
    }

    remaining -= 1
  }

  if (found === undefined || remaining > 0) {
    return undefined
  }

  if (!snapshot) {
    this.readConflicts.add(found, strNext(found))
  }

  return found
}

NestedLayer.prototype.readKeySelector = layerReadKeySelector

// ---------------------------------------------------------------------------
// Fork & merge
// ---------------------------------------------------------------------------

/**
 * Error thrown when a merge fails its serializable conflict check. Uses FDB's
 * not_committed (1020) code so it is treated as retryable by existing retry
 * logic.
 */
export class NestedConflictError extends Error {
  constructor() {
    super('Nested transaction conflict: read set intersects a concurrent write')
    this.name = 'NestedConflictError'
    /** @type {number} */
    this.code = 1020
  }
}

/**
 * Create a child layer forked from `parent`.
 *
 * @param {NestedLayer} parent
 * @returns {NestedLayer}
 */
export function forkLayer(parent) {
  if (parent.merged || parent.aborted) {
    throw new Error('Cannot fork a merged or aborted transaction')
  }

  const child = new NestedLayer(parent, parent)
  parent.outstandingChildren += 1

  return child
}

/**
 * @this {NestedLayer}
 */
function abortLayer() {
  if (this.merged || this.aborted) {
    return
  }

  this.aborted = true

  if (this.parentLayer) {
    this.parentLayer.outstandingChildren -= 1
  }
}

NestedLayer.prototype.abort = abortLayer

/**
 * Merge this layer's buffered state into its parent, with a serializable
 * conflict check.
 *
 * @this {NestedLayer}
 * @returns {void}
 * @throws {NestedConflictError} if the merge conflicts
 */
function mergeLayer() {
  const parent = this.parentLayer

  if (!parent) {
    throw new Error('Cannot merge the root transaction; use commit instead')
  }

  if (this.merged || this.aborted) {
    throw new Error('Transaction already finalized')
  }

  if (this.outstandingChildren > 0) {
    throw new Error('Cannot merge a transaction with outstanding (un-merged) children')
  }

  // Conflict check: any of this layer's read-conflict ranges must not intersect
  // a write that landed in the parent at or after our fork version.
  for (const r of this.readConflicts.ranges) {
    if (parent.childWriteIndex.conflicts(r.begin, r.end, this.baseVersion)) {
      throw new NestedConflictError()
    }
  }

  // No conflict: replay writes into the parent (preserving key order and
  // clear/atomic semantics), then register our write-conflict ranges at a new
  // parent version so later siblings see them.
  replayWritesInto(this, parent)

  const newVersion = parent.version + 1
  parent.version = newVersion

  for (const r of this.writeConflicts.ranges) {
    parent.childWriteIndex.add(r.begin, r.end, newVersion)
  }

  // Also propagate our read-conflict ranges upward? No: read conflicts are
  // local to a transaction's own validation. The parent already validated us.
  // But the parent, when IT merges into ITS parent, must treat keys we read as
  // part of its own read set (they were read within the parent's subtree).
  for (const r of this.readConflicts.ranges) {
    parent.readConflicts.add(r.begin, r.end)
  }

  this.merged = true
  parent.outstandingChildren -= 1
}

NestedLayer.prototype.merge = mergeLayer

/**
 * Replay `child`'s buffered writes into `parent`'s buffer, preserving
 * semantics. clearRanges are applied first-in-order via a reconstructed log?
 * We don't keep a full chronological log; instead we apply: (1) child's clear
 * tombstones as clearRanges, then (2) child's per-key entries. Because a
 * per-key entry in `writes` already reflects the net effect within the child
 * (sets shadow earlier clears; clearRange rewrote shadowed keys to clear;
 * atomics fold), applying tombstones then entries reproduces the child's net
 * state. Atomic entries that were left unresolved (over a non-cleared base) are
 * replayed as raw atomic ops so the parent/database applies them.
 *
 * @param {NestedLayer} child
 * @param {NestedLayer} parent
 */
function replayWritesInto(child, parent) {
  // Apply clearRange tombstones first.
  for (const r of child.clears.ranges) {
    parent.clearRange(r.begin, r.end)
  }

  for (const [k, entry] of child.writes.entries) {
    if (entry.type === 'set') {
      parent.set(k, entry.value)
    } else if (entry.type === 'clear') {
      parent.clear(k)
    } else if (entry.overClear) {
      // Atomic chain over a known-absent base: fold to a concrete value.
      const v = applyAtomicChain(entry.ops, undefined)

      if (v === undefined) {
        parent.clear(k)
      } else {
        parent.set(k, v)
      }
    } else {
      // Atomic chain over an unknown base: replay each op so it composes with
      // whatever the parent/database resolves at commit time.
      for (const op of entry.ops) {
        parent.atomicOp(op.opType, k, op.operand)
      }
    }
  }
}
