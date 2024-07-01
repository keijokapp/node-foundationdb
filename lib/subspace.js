// A subspace is a wrapper around a prefix and key and value transformers. This
// is nearly equivalent to subspaces in the other bindings - the difference is
// it also includes kv transformers, so a subspace here will also automatically
// encode and decode keys and values.

import { prefixTransformer, defaultTransformer, defaultGetRange } from './transformer.js'
import {
  asBuf, concat2, emptyBuffer, startsWith, strInc
} from './util.js'

/**
 * @import { NativeValue, Transformer, UnboundStamp } from './types'
 */

/**
 * @template KI, KO, VI, VO
 * @typedef {{
 *   getSubspace(): Subspace<KI, KO, VI, VO>
 * }} GetSubspace
 */

/**
 * @param {Buffer} p1
 * @param {string | Buffer} [p2]
 * @returns {Buffer}
 */
const concatPrefix = (p1, p2) => (
  // eslint-disable-next-line no-nested-ternary
  p2 == null
    ? p1
    : p1.length === 0
      ? asBuf(p2)
      : concat2(p1, asBuf(p2))
)

/**
 * Template parameters refer to the types of the allowed key and values you pass
 * in to the database (eg in a set(keyin, valin) call) and the types of keys and
 * values returned. KeyIn == KeyOut and ValIn == ValOut in almost all cases.
 *
 * @template [KeyIn=NativeValue]
 * @template [KeyOut=Buffer]
 * @template [ValIn=NativeValue]
 * @template [ValOut=Buffer]
 */
export default class Subspace {
  /**
   * @param {string | Buffer} [rawPrefix]
   * @param {Transformer<KeyIn, KeyOut>} [keyXf]
   * @param {Transformer<ValIn, ValOut>} [valueXf]
   */
  constructor(rawPrefix, keyXf, valueXf) {
    /** @type {Buffer} */
    this.prefix = rawPrefix?.length ? asBuf(rawPrefix) : emptyBuffer

    // Ugh typing this is a mess. Usually this will be fine since if you say new
    // Subspace() you'll get the default values for KI/KO/VI/VO.
    /** @type {Transformer<KeyIn, KeyOut>} */
    this.keyXf = keyXf ?? /** @type {Transformer<any, any>} */(defaultTransformer)
    /** @type {Transformer<ValIn, ValOut>} */
    this.valueXf = valueXf ?? /** @type {Transformer<any, any>} */(defaultTransformer)

    /** @type {Transformer<KeyIn, KeyOut>} */
    this._bakedKeyXf = this.prefix.length ? prefixTransformer(this.prefix, this.keyXf) : this.keyXf
  }

  /**
   * @overload
   * @param {KeyIn} [prefix]
   * @param {undefined} [keyXf]
   * @param {undefined} [valueXf]
   * @returns {Subspace<KeyIn, KeyOut, ValIn, ValOut>}
   */
  /**
   * @template CKI, CKO
   * @overload
   * @param {KeyIn | undefined} prefix
   * @param {Transformer<CKI, CKO>} keyXf
   * @param {undefined} [valueXf]
   * @returns {Subspace<CKI, CKO, ValIn, ValOut>}
   */
  /**
   * @template CVI, CVO
   * @overload
   * @param {KeyIn | undefined} prefix
   * @param {undefined} keyXf
   * @param {Transformer<CVI, CVO>} valueXf
   * @returns {Subspace<KeyIn, KeyOut, CVI, CVO>}
   */
  /**
   * @template CKI, CKO, CVI, CVO
   * @overload
   * @param {KeyIn | undefined} prefix
   * @param {Transformer<CKI, CKO>} keyXf
   * @param {Transformer<CVI, CVO>} valueXf
   * @returns {Subspace<CKI, CKO, CVI, CVO>}
   */
  /**
   * @template CKI, CKO
   * @overload
   * @param {KeyIn | undefined} prefix
   * @param {Transformer<CKI, CKO>} [keyXf]
   * @param {undefined} [valueXf]
   * @returns {(
   *   | Subspace<KeyIn, KeyOut, ValIn, ValOut>
   *   | Subspace<CKI, CKO, ValIn, ValOut>
   * )}
   */
  /**
   * @template CVI, CVO
   * @overload
   * @param {KeyIn | undefined} prefix
   * @param {undefined} keyXf
   * @param {Transformer<CVI, CVO>} [valueXf]
   * @returns {(
   *   | Subspace<KeyIn, KeyOut, ValIn, ValOut>
   *   | Subspace<KeyIn, KeyOut, CVI, CVO>
   * )}
   */
  /**
   * @template CKI, CKO, CVI, CVO
   * @overload
   * @param {KeyIn | undefined} prefix
   * @param {Transformer<CKI, CKO> | undefined} keyXf
   * @param {Transformer<CVI, CVO>} valueXf
   * @returns {(
   *   | Subspace<KeyIn, KeyOut, CVI, CVO>
   *   | Subspace<CKI, CKO, CVI, CVO>
   * )}
   */
  /**
   * @template CKI, CKO, CVI, CVO
   * @overload
   * @param {KeyIn | undefined} prefix
   * @param {Transformer<CKI, CKO>} keyXf
   * @param {Transformer<CVI, CVO>} [valueXf]
   * @returns {(
   *   | Subspace<CKI, CKO, ValIn, ValOut>
   *   | Subspace<CKI, CKO, CVI, CVO>
   * )}
   */
  /**
   * @template CKI, CKO, CVI, CVO
   * @overload
   * @param {KeyIn} [prefix]
   * @param {Transformer<CKI, CKO>} [keyXf]
   * @param {Transformer<CVI, CVO>} [valueXf]
   * @returns {(
   *   | Subspace<KeyIn, KeyOut, ValIn, ValOut>
   *   | Subspace<CKI, CKO, ValIn, ValOut>
   *   | Subspace<KeyIn, KeyOut, CVI, CVO>
   *   | Subspace<CKI, CKO, CVI, CVO>
   * )}
   */
  /**
   * Create a shallow reference to the Subspace at a specified subspace
   *
   * @param {KeyIn} [prefix]
   * @param {Transformer<unknown, unknown>} [keyXf]
   * @param {Transformer<unknown, unknown>} [valueXf]
   * @returns {Subspace<any, any, any, any>}
   */
  at(prefix, keyXf = this.keyXf, valueXf = this.valueXf) {
    const packedPrefix = prefix !== undefined ? this.keyXf.pack(prefix) : undefined

    return new Subspace(concatPrefix(this.prefix, packedPrefix), keyXf, valueXf)
  }

  /**
   * At a child prefix thats specified without reference to the key transformer
   *
   * @param {Buffer} prefix
   * @returns {Subspace<KeyIn, KeyOut, ValIn, ValOut>}
   */
  atRaw(prefix) {
    return new Subspace(concatPrefix(this.prefix, prefix), this.keyXf, this.valueXf)
  }

  /**
   * @overload
   * @param {undefined} [keyXf]
   * @returns {Subspace<NativeValue, Buffer, ValIn, ValOut>}
   */
  /**
   * @template CKI, CKO
   * @overload
   * @param {Transformer<CKI, CKO>} keyXf
   * @returns {Subspace<CKI, CKO, ValIn, ValOut>}
   */
  /**
   * @template CKI, CKO
   * @overload
   * @param {Transformer<CKI, CKO>} [keyXf]
   * @returns {(
   *   | Subspace<NativeValue, Buffer, ValIn, ValOut>
   *   | Subspace<CKI, CKO, ValIn, ValOut>
   * )}
   */
  /**
   * @param {Transformer<unknown, unknown>} [keyXf]
   * @returns {Subspace<any, any, any, any>}
   */
  withKeyEncoding(keyXf) {
    return new Subspace(this.prefix, keyXf, this.valueXf)
  }

  /**
   * @overload
   * @param {undefined} [keyXf]
   * @returns {Subspace<KeyIn, KeyOut, NativeValue, Buffer>}
   */
  /**
   * @template CVI, CVO
   * @overload
   * @param {Transformer<CVI, CVO>} valueXf
   * @returns {Subspace<KeyIn, KeyOut, CVI, CVO>}
   */
  /**
   * @template CVI, CVO
   * @overload
   * @param {Transformer<CVI, CVO>} [valueXf]
   * @returns {(
   *   | Subspace<KeyIn, KeyOut, NativeValue, Buffer>
   *   | Subspace<KeyIn, KeyOut, CVI, CVO>
   * )}
   */
  /**
   * @param {Transformer<unknown, unknown>} [valueXf]
   * @returns {Subspace<any, any, any, any>}
   */
  withValueEncoding(valueXf) {
    return new Subspace(this.prefix, this.keyXf, valueXf)
  }

  // GetSubspace implementation
  getSubspace() { return this }

  /**
   * @param {KeyIn} key
   * @returns {NativeValue}
   */
  packKey(key) {
    return this._bakedKeyXf.pack(key)
  }

  /**
   * @param {Buffer} key
   * @returns {KeyOut}
   */
  unpackKey(key) {
    return this._bakedKeyXf.unpack(key)
  }

  /**
   * @param {KeyIn} key
   * @returns {UnboundStamp}
   */
  packKeyUnboundVersionstamp(key) {
    if (!this._bakedKeyXf.packUnboundVersionstamp) {
      throw TypeError('Value encoding does not support unbound versionstamps. Use setVersionstampPrefixedValue instead')
    }

    return this._bakedKeyXf.packUnboundVersionstamp(key)
  }

  /**
   * @param {ValIn} val
   * @returns {NativeValue}
   */
  packValue(val) {
    return this.valueXf.pack(val)
  }

  /**
   * @param {Buffer} val
   * @returns {ValOut}
   */
  unpackValue(val) {
    return this.valueXf.unpack(val)
  }

  /**
   * @param {ValIn} value
   * @returns {UnboundStamp}
   */
  packValueUnboundVersionstamp(value) {
    if (!this.valueXf.packUnboundVersionstamp) {
      throw TypeError('Value encoding does not support unbound versionstamps. Use setVersionstampPrefixedValue instead')
    }

    return this.valueXf.packUnboundVersionstamp(value)
  }

  /**
   * Encodes a range specified by `start`/`end` pair using configured key encoder.
   *
   * @param {KeyIn} [start] Start of the key range. If undefined, the start of the subspace is assumed.
   * @param {KeyIn} [end] End of the key range. If undefined, the end of the subspace is assumed.
   * @returns {{ begin: NativeValue, end: NativeValue }} Encoded range as a `{ begin, end }` record.
   */
  packRange(start, end) {
    return {
      begin: start !== undefined ? this._bakedKeyXf.pack(start) : this.prefix,
      end: end !== undefined ? this._bakedKeyXf.pack(end) : strInc(this.prefix)
    }
  }

  /**
   * Encodes a range specified by the prefix using configured key encoder.
   *
   * @param {KeyIn} prefix Start of the key key range. If undefined, the start of the subspace is assumed.
   * @returns {{ begin: NativeValue, end: NativeValue }} Encoded range as a `{ begin, end }` record.
   */
  packRangeStartsWith(prefix) {
    const encodePrefix = this._bakedKeyXf.range ?? defaultGetRange

    return encodePrefix(prefix, this._bakedKeyXf)
  }

  /**
   * @param {NativeValue} key
   * @returns {boolean}
   */
  contains(key) {
    // TODO: This is a little dangerous - we should check if the key exists between this.keyXf.range().
    return startsWith(asBuf(key), this.prefix)
  }
}

export const root = new Subspace(undefined, defaultTransformer, defaultTransformer)

/**
 * @param {any} obj
 * @returns {obj is GetSubspace<any, any, any, any>}
 */
export const isGetSubspace = obj => obj != null && typeof obj === 'object' && 'getSubspace' in obj
