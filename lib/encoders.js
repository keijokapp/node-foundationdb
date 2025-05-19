import * as tupleEncoder from 'fdb-tuple'
import { emptyBuffer, id } from './util.js'

/**
 * @import { TupleItem } from 'fdb-tuple';
 * @import { NativeValue, Transformer } from './types.js';
 */

/** @type {Transformer<number, number>} */
export const int32LE = {
  pack(num) {
    const b = Buffer.allocUnsafe(4)
    b.writeInt32LE(num)

    return b
  },
  unpack(buf) {
    return buf.readInt32LE()
  },
}

/** @type {Transformer<number, number>} */
export const int32BE = {
  pack(num) {
    const b = Buffer.allocUnsafe(4)
    b.writeInt32BE(num)

    return b
  },
  unpack(buf) {
    return buf.readInt32BE()
  },
}

/** @type {Transformer<number, number>} */
export const uint32LE = {
  pack(num) {
    const b = Buffer.allocUnsafe(4)
    b.writeUInt32LE(num)

    return b
  },
  unpack(buf) {
    return buf.readUInt32LE()
  },
}

/** @type {Transformer<number, number>} */
export const uint32BE = {
  pack(num) {
    const b = Buffer.allocUnsafe(4)
    b.writeUInt32BE(num)

    return b
  },
  unpack(buf) {
    return buf.readUInt32BE()
  },
}

/** @type {Transformer<bigint, bigint>} */
export const bigint64LE = {
  pack(val) {
    const b = Buffer.allocUnsafe(8)

    b.writeBigInt64LE(val)

    return b
  },
  unpack(buf) {
    return buf.readBigInt64LE()
  },
}

/** @type {Transformer<bigint, bigint>} */
export const bigint64BE = {
  pack(val) {
    const b = Buffer.allocUnsafe(8)

    b.writeBigInt64BE(val)

    return b
  },
  unpack(buf) {
    return buf.readBigInt64BE()
  },
}

/** @type {Transformer<bigint, bigint>} */
export const biguint64LE = {
  pack(val) {
    const b = Buffer.allocUnsafe(8)

    b.writeBigUInt64LE(val)

    return b
  },
  unpack(buf) {
    return buf.readBigUInt64LE()
  },
}

/** @type {Transformer<bigint, bigint>} */
export const biguint64BE = {
  pack(val) {
    const b = Buffer.allocUnsafe(8)

    b.writeBigUInt64BE(val)

    return b
  },
  unpack(buf) {
    return buf.readBigUInt64BE()
  },
}

/** @type {Transformer<bigint, bigint>} */
export const biguintLE = {
  pack(val) {
    if (val === 0n) {
      return emptyBuffer
    }

    if (val < 0) {
      const error = /** @type {Error & { code: string }} */(new RangeError(`The value of "value" is out of range. It must be >= 0n. Received ${val}`))

      error.code = 'ERR_OUT_OF_RANGE'

      throw error
    }

    return Buffer.from(val.toString(16), 'hex')
  },
  unpack(buf) {
    if (buf.length === 0) {
      return 0n
    }

    return BigInt(`0x${buf.toString('hex')}`)
  },
}

/** @type {Transformer<any, any>} */
export const json = {
  pack(obj) {
    return JSON.stringify(obj)
  },
  unpack(buf) {
    return JSON.parse(buf.toString())
  },
}

/** @type {Transformer<NativeValue, Buffer>} */
export const identity = {
  pack: id,
  unpack: id,
}

/** @type {Transformer<string, string>} */
export const string = {
  pack: id,
  unpack(buf) {
    return buf.toString()
  },
}

/** @type {Transformer<Buffer, Buffer>} */
export const buf = identity

/** @type {Omit<typeof tupleEncoder, 'bakeVersionstamp'> & NonNullable<Transformer<TupleItem | TupleItem[], TupleItem[]>['bakeVersionstamp']>} */
export const tuple = /** @type {any} */(tupleEncoder)
