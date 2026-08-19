/* eslint-disable no-bitwise */
// Pure client-side implementations of FoundationDB atomic mutation semantics.
//
// These are needed so a forked transaction can resolve read-your-writes for
// buffered atomic ops *before* the ops are actually applied by the database on
// merge/commit. The byte-level rules here mirror the descriptions in
// opts.g.js (MutationType) and the FDB documentation.
//
// Versionstamp mutations (SetVersionstampedKey/Value) are intentionally NOT
// resolved here: the versionstamp is unknown until commit, so buffering their
// read-your-writes value is undefined until versionstamp support lands. They
// are replayed verbatim on merge.

import { MutationType } from './opts.g.js'

const empty = Buffer.allocUnsafe(0)

/**
 * Extend `buf` to `len` bytes with trailing zero bytes, or truncate to `len`.
 *
 * @param {Buffer} buf
 * @param {number} len
 * @returns {Buffer}
 */
const fit = (buf, len) => {
  if (buf.length === len) {
    return buf
  }

  const out = Buffer.alloc(len)
  buf.copy(out, 0, 0, Math.min(buf.length, len))

  return out
}

/**
 * Little-endian add of two equal-length byte buffers, wrapping (mod 2^(8*len)).
 *
 * @param {Buffer} a existing value, already fit to operand length
 * @param {Buffer} b operand
 * @returns {Buffer}
 */
const leAdd = (a, b) => {
  const out = Buffer.allocUnsafe(b.length)
  let carry = 0

  for (let i = 0; i < b.length; i++) {
    const sum = a[i] + b[i] + carry
    out[i] = sum & 0xff
    carry = sum >>> 8
  }

  return out
}

/**
 * Little-endian unsigned comparison of two equal-length buffers.
 *
 * @param {Buffer} a
 * @param {Buffer} b
 * @returns {number}
 */
const leCmp = (a, b) => {
  for (let i = a.length - 1; i >= 0; i--) {
    if (a[i] !== b[i]) {
      return a[i] < b[i] ? -1 : 1
    }
  }

  return 0
}

/**
 * Apply a single atomic op to a base value, returning the new value.
 *
 * @param {MutationType} opType
 * @param {Buffer | undefined} existing current value (undefined = absent)
 * @param {Buffer} operand
 * @returns {Buffer | undefined} new value (undefined means the key is cleared)
 */
export function applyAtomic(opType, existing, operand) {
  switch (opType) {
    case MutationType.Add: {
      const base = fit(existing ?? empty, operand.length)

      return leAdd(base, operand)
    }

    // Note: And/Or/Xor are deprecated numeric aliases of BitAnd/BitOr/BitXor,
    // so a single case each covers both.
    case MutationType.BitAnd: {
      // If existing is absent it is treated as zero bytes extended to the
      // operand length, so AND yields zeros. Existing shorter is zero-extended;
      // longer is truncated to the operand length.
      const base = existing === undefined ? Buffer.alloc(operand.length) : fit(existing, operand.length)
      const out = Buffer.allocUnsafe(operand.length)

      for (let i = 0; i < operand.length; i++) {
        out[i] = base[i] & operand[i]
      }

      return out
    }

    case MutationType.BitOr: {
      const base = fit(existing ?? empty, operand.length)
      const out = Buffer.allocUnsafe(operand.length)

      for (let i = 0; i < operand.length; i++) {
        out[i] = base[i] | operand[i]
      }

      return out
    }

    case MutationType.BitXor: {
      const base = fit(existing ?? empty, operand.length)
      const out = Buffer.allocUnsafe(operand.length)

      for (let i = 0; i < operand.length; i++) {
        out[i] = base[i] ^ operand[i]
      }

      return out
    }

    case MutationType.AppendIfFits: {
      if (existing === undefined) {
        return Buffer.from(operand)
      }

      return Buffer.concat([existing, operand], existing.length + operand.length)
    }

    case MutationType.Max: {
      const base = fit(existing ?? empty, operand.length)

      return leCmp(base, operand) >= 0 ? base : Buffer.from(operand)
    }

    case MutationType.Min: {
      if (existing === undefined) {
        return Buffer.from(operand)
      }

      const base = fit(existing, operand.length)

      return leCmp(base, operand) <= 0 ? base : Buffer.from(operand)
    }

    case MutationType.ByteMax: {
      if (existing === undefined) {
        return Buffer.from(operand)
      }

      return existing.compare(operand) >= 0 ? existing : Buffer.from(operand)
    }

    case MutationType.ByteMin: {
      if (existing === undefined) {
        return Buffer.from(operand)
      }

      return existing.compare(operand) <= 0 ? existing : Buffer.from(operand)
    }

    case MutationType.CompareAndClear: {
      if (existing !== undefined && existing.equals(operand)) {
        return undefined
      }

      return existing
    }

    default:
      throw new Error(`Atomic op ${opType} cannot be resolved client-side (unsupported in nested transactions yet)`)
  }
}

/**
 * Apply a chain of atomic ops in order to a base value.
 *
 * @param {{ opType: MutationType, operand: Buffer }[]} ops
 * @param {Buffer | undefined} base
 * @returns {Buffer | undefined}
 */
export function applyAtomicChain(ops, base) {
  let acc = base

  for (const { opType, operand } of ops) {
    acc = applyAtomic(opType, acc, operand)
  }

  return acc
}
