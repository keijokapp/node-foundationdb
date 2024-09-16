import type { TupleItem } from 'fdb-tuple'
import * as tupleEncoder from 'fdb-tuple'
import type { Transformer } from './transformer'
import { id } from './util'

export const int32LE: Transformer<number, number> = {
  pack(num) {
    const b = Buffer.allocUnsafe(4)
    b.writeInt32LE(num)

    return b
  },
  unpack(buf) {
    return buf.readInt32LE()
  }
}

export const int32BE: Transformer<number, number> = {
  pack(num) {
    const b = Buffer.allocUnsafe(4)
    b.writeInt32BE(num)

    return b
  },
  unpack(buf) {
    return buf.readInt32BE()
  }
}

export const uint32LE: Transformer<number, number> = {
  pack(num) {
    const b = Buffer.allocUnsafe(4)
    b.writeUInt32LE(num)

    return b
  },
  unpack(buf) {
    return buf.readUInt32LE()
  }
}

export const uint32BE: Transformer<number, number> = {
  pack(num) {
    const b = Buffer.allocUnsafe(4)
    b.writeUInt32BE(num)

    return b
  },
  unpack(buf) {
    return buf.readUInt32BE()
  }
}

export const bigint64LE: Transformer<bigint, bigint> = {
  pack(val) {
    const b = Buffer.allocUnsafe(8)

    b.writeBigInt64LE(val)

    return b
  },
  unpack(buf) {
    return buf.readBigInt64LE()
  }
}

export const bigint64BE: Transformer<bigint, bigint> = {
  pack(val) {
    const b = Buffer.allocUnsafe(8)

    b.writeBigInt64BE(val)

    return b
  },
  unpack(buf) {
    return buf.readBigInt64BE()
  }
}

export const biguint64LE: Transformer<bigint, bigint> = {
  pack(val) {
    const b = Buffer.allocUnsafe(8)

    b.writeBigUInt64LE(val)

    return b
  },
  unpack(buf) {
    return buf.readBigUInt64LE()
  }
}

export const biguint64BE: Transformer<bigint, bigint> = {
  pack(val) {
    const b = Buffer.allocUnsafe(8)

    b.writeBigUInt64BE(val)

    return b
  },
  unpack(buf) {
    return buf.readBigUInt64BE()
  }
}

export const biguintLE: Transformer<bigint, bigint> = {
  pack(val) {
    if (val < 0) {
      const error = new RangeError(`The value of "value" is out of range. It must be >= 0n. Received ${val}`) as Error & { code: string }

      error.code = 'ERR_OUT_OF_RANGE'

      throw error
    }

    return Buffer.from(val.toString(16), 'hex')
  },
  unpack(buf) {
    return BigInt(`0x${buf.toString('hex')}`)
  }
}

export const json: Transformer<any, any> = {
  pack(obj) {
    return JSON.stringify(obj)
  },
  unpack(buf) {
    return JSON.parse(buf.toString())
  }
}

export const string: Transformer<string, string> = {
  pack(str) {
    return Buffer.from(str)
  },
  unpack(buf) {
    return buf.toString()
  }
}

export const buf: Transformer<Buffer, Buffer> = {
  pack: id,
  unpack: id
}

export const tuple = tupleEncoder as any as Omit<typeof tupleEncoder, 'bakeVersionstamp'> & NonNullable<Transformer<TupleItem | TupleItem[], TupleItem[]>['bakeVersionstamp']>
