export const id = <T>(x: T) => x

// String increment. Find the next string (well, buffer) after this buffer.
export const strInc = (val: string | Buffer): Buffer => {
  const buf = asBuf(val)

  let lastNonFFByte

  for (lastNonFFByte = buf.length - 1; lastNonFFByte >= 0; --lastNonFFByte) {
    if (buf[lastNonFFByte] !== 0xFF) {
      break
    }
  }

  if (lastNonFFByte < 0) {
    throw new Error(`invalid argument '${val}': prefix must have at least one byte not equal to 0xFF`)
  }

  const result = Buffer.allocUnsafe(lastNonFFByte + 1)
  buf.copy(result)
  ++result[lastNonFFByte]

  return result
}

const byteZero = Buffer.alloc(1)

// This appends \x00 to a key to get the next key.
export const strNext = (val: string | Buffer): Buffer => {
  const buf = asBuf(val)

  return Buffer.concat([buf, byteZero], buf.length + 1)
}

export const asBuf = (val: Buffer | string): Buffer => (
  typeof val === 'string' ? Buffer.from(val) : val
)

// Marginally faster than Buffer.concat
export const concat2 = (a: Buffer, b: Buffer) => {
  const result = Buffer.allocUnsafe(a.length + b.length)
  a.copy(result)
  b.copy(result, a.length)

  return result
}

export const startsWith = (a: Buffer, prefix: Buffer) => prefix.length <= a.length && prefix.compare(a, 0, prefix.length) === 0

export const emptyBuffer = Buffer.allocUnsafe(0)
