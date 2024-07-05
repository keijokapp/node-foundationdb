// @ts-check

import * as apiVersion from './apiVersion.js'
import { emptyBuffer } from './util.js'

/**
 * @typedef {{data: Buffer, stampPos: number, codePos?: number}} UnboundStamp
 */

/**
 * @param {number} dataLen
 * @param {boolean} isKey
 * @returns {number}
 */
const packedBufLen = (dataLen, isKey) => {
  const use4ByteOffset = /** @type {number} */(apiVersion.get()) >= 520
  return dataLen + (use4ByteOffset ? 4 : (isKey ? 2 : 0))
}

/**
 * If preallocated is set, the buffer already has space for the offset at the end.
 * pos is the position in data. It does not take into account the prefix length.
 * @param {Buffer} data
 * @param {number} pos
 * @param {boolean} isKey
 * @param {boolean} preallocated
 * @returns {Buffer}
 */
const packVersionstampRaw = (data, pos, isKey, preallocated) => {
  const use4ByteOffset = /** @type {number} */(apiVersion.get()) >= 520

  // Before API version 520 it was a bit of a mess:
  // - Keys had a 2 byte offset appended to the end
  // - Values did not support an offset at all. Versionstamps in a value must be the first 10 bytes of that value.
  if (!isKey && !use4ByteOffset && pos > 0) {
    throw Error('API version <520 do not support versionstamps in a value at a non-zero offset')
  }

  const result = preallocated ? data : Buffer.allocUnsafe(packedBufLen(data.length, isKey))
  if (!preallocated) data.copy(result)

  if (use4ByteOffset) result.writeUInt32LE(pos, result.length - 4)
  else if (isKey) result.writeUInt16LE(pos, result.length - 2)

  return result
}

/**
 * Exported for binding tester. TODO: Consider moving this into its own file and exporting it generally.
 * @param {UnboundStamp} unboundStamp
 * @param {boolean} isKey
 * @returns {Buffer}
 */
export const packVersionstamp = ({data, stampPos}, isKey) => (
  packVersionstampRaw(data, stampPos, isKey, false)
)

/**
 * @param {Buffer} prefix
 * @param {UnboundStamp} unboundStamp
 * @param {boolean} isKey
 * @returns {Buffer}
 */
export const packPrefixedVersionstamp = (prefix, {data, stampPos}, isKey) => {
  const buf = Buffer.allocUnsafe(packedBufLen(prefix.length + data.length, isKey))
  prefix.copy(buf)
  data.copy(buf, prefix.length)

  return packVersionstampRaw(buf, prefix.length + stampPos, isKey, true)
}

/**
 * @param {Buffer} [prefix]
 * @param {Buffer} [suffix]
 * @param {boolean} isKey
 * @returns {Buffer}
 */
export const packVersionstampPrefixSuffix = (prefix = emptyBuffer, suffix = emptyBuffer, isKey) => {
  const buf = Buffer.allocUnsafe(packedBufLen(prefix.length + 10 + suffix.length, isKey))
  prefix.copy(buf)
  suffix.copy(buf, prefix.length + 10)

  return packVersionstampRaw(buf, prefix.length, isKey, true)
}
