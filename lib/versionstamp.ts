import * as apiVersion from './apiVersion'
import { emptyBuffer } from './util'

// Versionstamp that isn't yet bound to an actual version. If codePos is set,
// the database will also fill in an incrementing 2 byte code at that position
// relative to other versionstamped key / values inside the transaction.
export type UnboundStamp = { data: Buffer, stampPos: number, codePos?: number }

const packedBufLen = (dataLen: number, isKey: boolean): number => {
  const use4ByteOffset = apiVersion.get()! >= 520

  // eslint-disable-next-line no-nested-ternary
  return dataLen + (use4ByteOffset ? 4 : isKey ? 2 : 0)
}

// If preallocated is set, the buffer already has space for the offset at the end.
// pos is the position in data. It does not take into account the prefix length.
const packVersionstampRaw = (data: Buffer, pos: number, isKey: boolean, preallocated: boolean): Buffer => {
  const use4ByteOffset = apiVersion.get()! >= 520

  // Before API version 520 it was a bit of a mess:
  // - Keys had a 2 byte offset appended to the end
  // - Values did not support an offset at all. Versionstamps in a value must be the first 10 bytes of that value.
  if (!isKey && !use4ByteOffset && pos > 0) {
    throw Error('API version <520 do not support versionstamps in a value at a non-zero offset')
  }

  const result = preallocated ? data : Buffer.allocUnsafe(packedBufLen(data.length, isKey))

  if (!preallocated) {
    data.copy(result)
  }

  if (use4ByteOffset) {
    result.writeUInt32LE(pos, result.length - 4)
  } else if (isKey) {
    result.writeUInt16LE(pos, result.length - 2)
  }

  return result
}

// Exported for binding tester. TODO: Consider moving this into its own file and exporting it generally.
export const packVersionstamp = ({ data, stampPos }: UnboundStamp, isKey: boolean): Buffer => packVersionstampRaw(data, stampPos, isKey, false)

export const packPrefixedVersionstamp = (prefix: Buffer, { data, stampPos }: UnboundStamp, isKey: boolean): Buffer => {
  const buf = Buffer.allocUnsafe(packedBufLen(prefix.length + data.length, isKey))
  prefix.copy(buf)
  data.copy(buf, prefix.length)

  return packVersionstampRaw(buf, prefix.length + stampPos, isKey, true)
}

export const packVersionstampPrefixSuffix = (prefix: Buffer = emptyBuffer, suffix: Buffer = emptyBuffer, isKey: boolean): Buffer => {
  const buf = Buffer.allocUnsafe(packedBufLen(prefix.length + 10 + suffix.length, isKey))
  prefix.copy(buf)
  suffix.copy(buf, prefix.length + 10)

  return packVersionstampRaw(buf, prefix.length, isKey, true)
}
