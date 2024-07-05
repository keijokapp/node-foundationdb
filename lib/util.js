// @ts-check

/**
 * @template T
 * @param {T} x
 * @returns {T}
 */
export const id = (x) => x

/**
 * String increment. Find the next string (well, buffer) after this buffer.
 * @param {string | Buffer} val
 * @returns {Buffer}
 */
export const strInc = (val) => {
  const buf = asBuf(val)

  let lastNonFFByte
  for(lastNonFFByte = buf.length-1; lastNonFFByte >= 0; --lastNonFFByte) {
    if(buf[lastNonFFByte] != 0xFF) break;
  }

  if(lastNonFFByte < 0) {
    throw new Error(`invalid argument '${val}': prefix must have at least one byte not equal to 0xFF`)
  }

  const result = Buffer.allocUnsafe(lastNonFFByte + 1)
  buf.copy(result)
  ++result[lastNonFFByte]

  return result;
}

const byteZero = Buffer.alloc(1)

/**
 * This appends \x00 to a key to get the next key.
 * @param {string | Buffer} val
 * @returns {Buffer}
 */
export const strNext = (val) => {
  const buf = asBuf(val)
  return Buffer.concat([buf, byteZero], buf.length + 1)
}

/**
 * @param {Buffer | string} val
 * @returns {Buffer}
 */
export const asBuf = (val) => (
  typeof val === 'string' ? Buffer.from(val) : val
)

/**
 * Marginally faster than Buffer.concat
 * @param {Buffer} a
 * @param {Buffer} b
 * @returns {Buffer}
 */
export const concat2 = (a, b) => {
  const result = Buffer.allocUnsafe(a.length + b.length)
  a.copy(result)
  b.copy(result, a.length)
  return result
}

/**
 * Marginally faster than Buffer.concat
 * @param {Buffer} a
 * @param {Buffer} prefix
 * @returns {boolean}
 */
export const startsWith = (a, prefix) => (
  prefix.length <= a.length && prefix.compare(a, 0, prefix.length) === 0
)

export const emptyBuffer = Buffer.allocUnsafe(0)
