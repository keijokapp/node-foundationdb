// The transformer type is used to transparently translate keys and values
// through an encoder and decoder function.

import {
  asBuf, concat2, startsWith, strInc,
} from './util.js'

/**
 * @import { NativeValue, Transformer, UnboundStamp } from './types.js'
 */

/**
 * @template KeyIn, KeyOut
 * @param {KeyIn} prefix
 * @param {Transformer<KeyIn, KeyOut>} keyXf
 * @returns {{ begin: NativeValue, end: NativeValue }}
 */
export const defaultGetRange = (prefix, keyXf) => ({
  begin: keyXf.pack(prefix),
  end: strInc(keyXf.pack(prefix)),
})

/**
 * @template In, Out
 * @param {Buffer} prefix
 * @param {Transformer<In, Out>} inner
 * @returns {Transformer<In, Out>}
 */
export const prefixTransformer = (prefix, inner) => {
  /** @type {Transformer<In, Out>} */
  const transformer = {
    name: inner.name ? `prefixed ${inner.name}` : 'prefixTransformer',
    pack(v) {
      // If you heavily nest these it'll get pretty inefficient.
      const innerVal = inner.pack(v)

      return concat2(prefix, asBuf(innerVal))
    },
    unpack(buf) {
      if (!startsWith(buf, prefix)) {
        throw Error('Cannot unpack key outside of prefix range.')
      }

      return inner.unpack(buf.subarray(prefix.length))
    },
  }

  if (inner.packUnboundVersionstamp) {
    transformer.packUnboundVersionstamp = val => {
      const innerVal = /** @type {NonNullable<typeof inner.packUnboundVersionstamp>} */(inner.packUnboundVersionstamp)(val) /** @type {UnboundStamp} */

      /** @type {UnboundStamp} */
      const unboundStamp = {
        data: concat2(prefix, innerVal.data),
        stampPos: prefix.length + innerVal.stampPos,
      }

      if (innerVal.codePos != null) {
        unboundStamp.codePos = prefix.length + innerVal.codePos
      }

      return unboundStamp
    }
  }

  if (inner.bakeVersionstamp) {
    transformer.bakeVersionstamp = inner.bakeVersionstamp.bind(inner)
  }

  if (inner.range) {
    transformer.range = innerPrefix => {
      const innerRange = /** @type {NonNullable<typeof inner.range>} */(inner.range)(innerPrefix)

      return {
        begin: concat2(prefix, asBuf(innerRange.begin)),
        end: concat2(prefix, asBuf(innerRange.end)),
      }
    }
  }

  return transformer
}
