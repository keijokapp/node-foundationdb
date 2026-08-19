/* eslint-disable class-methods-use-this, no-empty-function */
// Integration tests for nested / forked transactions.
//
// These drive real Transaction objects against a MockTn (an in-memory
// key/value store implementing the NativeTransaction surface we use). This
// exercises the full wiring in transaction.js + nested.js without needing a
// live FoundationDB cluster.

import assert from 'node:assert'
import { describe, it } from 'mocha'
import { MutationType } from '../lib/opts.g.js'
import { root } from '../lib/subspace.js'
import Transaction from '../lib/transaction.js'
import { NestedConflictError } from '../lib/nested.js'
import { applyAtomic } from '../lib/atomics.js'

const B = (/** @type {string} */ s) => Buffer.from(s)
const S = (/** @type {Buffer | undefined} */ b) => (b === undefined ? undefined : b.toString())

/**
 * In-memory native transaction mock. Keys stored as hex strings.
 */
class MockTn {
  constructor() {
    /** @type {Map<string, Buffer>} */
    this.data = new Map()
    this.committed = false
  }

  _sortedKeys() {
    return [...this.data.keys()].map(h => Buffer.from(h, 'hex')).sort(Buffer.compare)
  }

  setOption() {}

  async commit() { this.committed = true }

  reset() {}

  cancel() {}

  async onError() {}

  async getApproximateSize() { return 0 }

  async get(/** @type {Buffer} */ key) {
    return this.data.get(key.toString('hex'))
  }

  async getKey(/** @type {Buffer} */ key, /** @type {boolean} */ orEqual, /** @type {number} */ offset) {
    // Minimal selector resolution for the pass-through path (not exercised in
    // forked tests, which use the layer's own resolver).
    const keys = this._sortedKeys()
    const idx = keys.findIndex(k => (orEqual ? k.compare(key) > 0 : k.compare(key) >= 0))
    const base = idx === -1 ? keys.length : idx
    const target = base + (offset - 1)

    if (target < 0 || target >= keys.length) {
      return Buffer.alloc(0)
    }

    return keys[target]
  }

  set(/** @type {Buffer} */ key, /** @type {Buffer} */ val) {
    this.data.set(key.toString('hex'), Buffer.from(val))
  }

  clear(/** @type {Buffer} */ key) {
    this.data.delete(key.toString('hex'))
  }

  clearRange(/** @type {Buffer} */ begin, /** @type {Buffer} */ end) {
    for (const k of this._sortedKeys()) {
      if (k.compare(begin) >= 0 && k.compare(end) < 0) {
        this.data.delete(k.toString('hex'))
      }
    }
  }

  atomicOp(/** @type {number} */ op, /** @type {Buffer} */ key, /** @type {Buffer} */ operand) {
    // Reuse the pure client-side implementation for the native side too.
    const cur = this.data.get(key.toString('hex'))
    const next = applyAtomic(op, cur, operand)

    if (next === undefined) {
      this.data.delete(key.toString('hex'))
    } else {
      this.data.set(key.toString('hex'), next)
    }
  }

  async getRange(
    /** @type {Buffer} */ begin,
    /** @type {any} */ _bo,
    /** @type {any} */ _boff,
    /** @type {Buffer} */ end,
    /** @type {any} */ _eo,
    /** @type {any} */ _eoff,
    /** @type {any} */ _limit,
    /** @type {any} */ _tb,
    /** @type {any} */ _mode,
    /** @type {number} */ iter,
    /** @type {any} */ _snap,
    /** @type {boolean} */ reverse,
  ) {
    if (iter > 1) {
      return { results: [], more: false }
    }

    const keys = this._sortedKeys().filter(k => k.compare(begin) >= 0 && k.compare(end) < 0)

    if (reverse) {
      keys.reverse()
    }

    return {
      results: keys.map(k => [k, /** @type {Buffer} */(this.data.get(k.toString('hex')))]),
      more: false,
    }
  }
}

/** @returns {[Transaction, MockTn]} */
const mk = () => {
  const tn = new MockTn()

  return [new Transaction(/** @type {any} */(tn), false, root), tn]
}

describe('nested transactions', () => {
  it('pass-through when never forked', async () => {
    const [txn, tn] = mk()
    txn.set(B('a'), B('1'))
    assert.strictEqual(S(await txn.get(B('a'))), '1')
    // parent writes go straight to the native tn
    assert.strictEqual(tn.data.get(B('a').toString('hex'))?.toString(), '1')
  })

  it('child reads-your-writes; parent unaffected until merge', async () => {
    const [txn, tn] = mk()
    txn.set(B('a'), B('A'))

    const child = txn.rawCreateTransaction()
    child.set(B('a'), B('CHILD'))
    child.set(B('b'), B('B'))

    // Child sees its own writes layered over parent
    assert.strictEqual(S(await child.get(B('a'))), 'CHILD')
    assert.strictEqual(S(await child.get(B('b'))), 'B')

    // Parent unchanged; native tn does not have child writes yet
    assert.strictEqual(S(await txn.get(B('a'))), 'A')
    assert.strictEqual(tn.data.get(B('b').toString('hex')), undefined)

    await child.rawCommit()

    // After merge parent (== native tn, since root flushes directly) sees them
    assert.strictEqual(S(await txn.get(B('a'))), 'CHILD')
    assert.strictEqual(S(await txn.get(B('b'))), 'B')
  })

  it('child clear hides parent value only within the child', async () => {
    const [txn] = mk()
    txn.set(B('k'), B('V'))

    const child = txn.rawCreateTransaction()
    child.clear(B('k'))
    assert.strictEqual(await child.get(B('k')), undefined)
    assert.strictEqual(S(await txn.get(B('k'))), 'V')

    await child.rawCommit()
    assert.strictEqual(await txn.get(B('k')), undefined)
  })

  it('range read merges buffered writes/clears', async () => {
    const [txn] = mk()
    txn.set(B('a'), B('A'))
    txn.set(B('b'), B('B'))
    txn.set(B('c'), B('C'))

    const child = txn.rawCreateTransaction()
    child.set(B('b'), B('BB'))
    child.clear(B('c'))
    child.set(B('d'), B('D'))

    const got = []

    for await (const [k, v] of child.getRange(B('a'), B('z'))) {
      got.push(`${k}=${v}`)
    }

    assert.deepStrictEqual(got, ['a=A', 'b=BB', 'd=D'])
  })

  it('reverse range read', async () => {
    const [txn] = mk()
    txn.set(B('a'), B('A'))
    txn.set(B('b'), B('B'))

    const child = txn.rawCreateTransaction()
    child.set(B('c'), B('C'))

    const got = []

    for await (const [k, v] of child.getRange(B('a'), B('z'), { reverse: true })) {
      got.push(`${k}=${v}`)
    }

    assert.deepStrictEqual(got, ['c=C', 'b=B', 'a=A'])
  })

  it('getKey resolves selectors over buffered state', async () => {
    const [txn] = mk()
    txn.set(B('a'), B('A'))
    txn.set(B('c'), B('C'))

    const child = txn.rawCreateTransaction()
    child.set(B('b'), B('B')) // inserting b shifts selectors

    // firstGreaterThan('a') should now be 'b'
    const k = await child.getKey(B('a'))
    // getKey(key) == firstGreaterOrEqual(key); 'a' exists so -> 'a'
    assert.strictEqual(S(k), 'a')
  })

  it('atomic add resolves read-your-writes and merges', async () => {
    const [txn, tn] = mk()
    // seed a little-endian 8-byte integer = 5
    const five = Buffer.alloc(8)
    five.writeUInt32LE(5, 0)
    txn.set(B('n'), five)

    const child = txn.rawCreateTransaction()
    const one = Buffer.alloc(8)
    one.writeUInt32LE(1, 0)
    child.atomicOpNative(MutationType.Add, B('n'), one)

    const got = await child.get(B('n'))
    assert.strictEqual(got.readUInt32LE(0), 6) // read-your-writes resolves add

    await child.rawCommit()
    // Merge replayed the raw Add op onto the native tn (base value was not
    // locally concrete), so the native store now holds 6.
    assert.strictEqual(tn.data.get(B('n').toString('hex')).readUInt32LE(0), 6)
    assert.strictEqual((await txn.get(B('n'))).readUInt32LE(0), 6)
  })

  it('atomic op over a locally-set value folds concretely', async () => {
    const [txn, tn] = mk()

    const child = txn.rawCreateTransaction()
    const base = Buffer.alloc(8)
    base.writeUInt32LE(10, 0)
    child.set(B('m'), base)
    const two = Buffer.alloc(8)
    two.writeUInt32LE(2, 0)
    child.atomicOpNative(MutationType.Add, B('m'), two)

    assert.strictEqual((await child.get(B('m'))).readUInt32LE(0), 12)

    await child.rawCommit()
    // Because the value was set within the child, merge replays a concrete
    // set(12) rather than an atomic op.
    assert.strictEqual(tn.data.get(B('m').toString('hex')).readUInt32LE(0), 12)
  })

  it('sibling conflict: read-then-write vs concurrent write', async () => {
    const [txn] = mk()
    txn.set(B('x'), B('0'))

    const a = txn.rawCreateTransaction()
    const b = txn.rawCreateTransaction()

    await a.get(B('x')) // A reads x
    a.set(B('y'), B('1')) // A writes y

    b.set(B('x'), B('9')) // B writes x
    await b.rawCommit() // B commits first: OK

    assert.throws(() => a.rawCommit(), err => err instanceof NestedConflictError)
  })

  it('disjoint siblings both merge', async () => {
    const [txn] = mk()
    txn.set(B('a'), B('A'))
    txn.set(B('b'), B('B'))

    const c = txn.rawCreateTransaction()
    const d = txn.rawCreateTransaction()

    await c.get(B('a'))
    c.set(B('c1'), B('1'))
    await d.get(B('b'))
    d.set(B('d1'), B('1'))

    await d.rawCommit()
    assert.doesNotThrow(() => c.rawCommit())
  })

  it('snapshot read does not create a conflict', async () => {
    const [txn] = mk()
    txn.set(B('a'), B('A'))

    const e = txn.rawCreateTransaction()
    const f = txn.rawCreateTransaction()

    await e.snapshot().get(B('a')) // snapshot read: no conflict range
    f.set(B('a'), B('Q'))
    await f.rawCommit()

    assert.doesNotThrow(() => e.rawCommit())
  })

  it('nested depth: child of child', async () => {
    const [txn] = mk()
    const g = txn.rawCreateTransaction()
    const h = g.rawCreateTransaction()

    h.set(B('h'), B('1'))
    assert.strictEqual(S(await h.get(B('h'))), '1')
    await h.rawCommit()

    // g now sees h's write (buffered in g)
    assert.strictEqual(S(await g.get(B('h'))), '1')
    // txn (native) does not yet
    assert.strictEqual(await txn.get(B('h')), undefined)

    await g.rawCommit()
    assert.strictEqual(S(await txn.get(B('h'))), '1')
  })

  it('cannot commit with outstanding children', async () => {
    const [txn] = mk()
    const g = txn.rawCreateTransaction()
    g.rawCreateTransaction() // grandchild not committed/cancelled

    assert.throws(() => g.rawCommit(), /outstanding/)
  })

  it('rawCommit blocked while children outstanding', () => {
    const [txn] = mk()
    txn.rawCreateTransaction()

    assert.throws(() => txn.rawCommit(), /outstanding/)
  })

  it('doTn auto-commits on success', async () => {
    const [txn] = mk()
    txn.set(B('a'), B('A'))

    const result = await txn.doTn(async child => {
      child.set(B('b'), B('B'))

      return 'done'
    })

    assert.strictEqual(result, 'done')
    assert.strictEqual(S(await txn.get(B('b'))), 'B')
  })

  it('doTn cancels on throw', async () => {
    const [txn] = mk()

    await assert.rejects(
      txn.doTn(async child => {
        child.set(B('b'), B('B'))

        throw new Error('boom')
      }),
      /boom/,
    )

    assert.strictEqual(await txn.get(B('b')), undefined)
    // parent no longer has outstanding children
    assert.doesNotThrow(() => txn.rawCommit())
  })

  it('doTn retries on conflict', async () => {
    const [txn] = mk()
    txn.set(B('x'), B('0'))

    // Pre-arrange a sibling that will conflict on the first attempt only.
    let attempts = 0

    // Simulate: the body reads x and writes y. Between create and commit, a
    // sibling writes x once. We inject that sibling on the first attempt.
    const result = await txn.doTn(async child => {
      attempts += 1
      await child.get(B('x'))
      child.set(B('y'), B(String(attempts)))

      if (attempts === 1) {
        // A concurrent sibling commits a write to x, invalidating this child.
        const sib = txn.rawCreateTransaction()
        sib.set(B('x'), B('bumped'))
        await sib.rawCommit()
      }
    })

    assert.strictEqual(attempts, 2) // retried once
    assert.strictEqual(result, undefined)
    assert.strictEqual(S(await txn.get(B('y'))), '2')
  })

  it('nested doTn reads exactly like db.doTn', async () => {
    // The whole point of the rename: a Transaction offers the same
    // transaction-running surface as a Database.
    const [txn] = mk()
    txn.set(B('counter'), B('0'))

    // Two independent nested transactions, run one after another.
    await txn.doTn(async inner => {
      inner.set(B('counter'), B('1'))
    })
    await txn.doTransaction(async inner => {
      assert.strictEqual(S(await inner.get(B('counter'))), '1')
      inner.set(B('counter'), B('2'))
    })

    assert.strictEqual(S(await txn.get(B('counter'))), '2')
  })
})
