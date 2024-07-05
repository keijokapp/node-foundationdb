// @ts-check

// The transformer type is used to transparently translate keys and values
// through an encoder and decoder function.

import { asBuf, concat2, id, strInc, startsWith } from './util.js'

/**
 * @template In, Out
 * @typedef {{
 *   name?: undefined | string // For debugging.
 *   pack(val: In): Buffer | string
 *   unpack(buf: Buffer): Out
 *   packUnboundVersionstamp?(val: In): import('./versionstamp.js').UnboundStamp
 *   bakeVersionstamp?(val: In, versionstamp: Buffer, code: Buffer | undefined): void
 *   range?(prefix: In): { begin: Buffer | string, end: Buffer | string }
 * }} Transformer
 */

/** @type {import('./transformer.js').Transformer<Buffer | string, Buffer>} */
export const defaultTransformer = {
  pack: id,
  unpack: id
}

/**
 * @template KeyIn, KeyOut
 * @param {KeyIn} prefix
 * @param {import('./transformer.js').Transformer<KeyIn, KeyOut>} keyXf
 * @returns {{begin: Buffer | string, end: Buffer | string}}
 */
export const defaultGetRange = (prefix, keyXf) => ({
  begin: keyXf.pack(prefix),
  end: strInc(keyXf.pack(prefix)),
})

/**
 * @template In, Out
 * @param {Buffer} prefix
 * @param {import('./transformer.js').Transformer<In, Out>} inner
 * @returns {import('./transformer.js').Transformer<In, Out>}
 */
export const prefixTransformer = (prefix, inner) => {
  /** @type {import('./transformer.js').Transformer<In, Out>} */
  const transformer = {
    name: inner.name ? 'prefixed ' + inner.name : 'prefixTransformer',

    pack(v) {
      // If you heavily nest these it'll get pretty inefficient.
      const innerVal = inner.pack(v)
      return concat2(prefix, asBuf(innerVal))
    },
    unpack(buf) {
      if (!startsWith(buf, prefix)) throw Error('Cannot unpack key outside of prefix range.')
      return inner.unpack(buf.subarray(prefix.length))
    },
  }

  if (inner.packUnboundVersionstamp) transformer.packUnboundVersionstamp = (val) => {
    const innerVal = /** @type {NonNullable<typeof inner.packUnboundVersionstamp>} */(inner.packUnboundVersionstamp)(val)

    /** @type {import('./versionstamp.js').UnboundStamp} */
    const unboundStamp = {
      data: concat2(prefix, innerVal.data),
      stampPos: prefix.length + innerVal.stampPos
    };

    if (innerVal.codePos != null) {
      unboundStamp.codePos = prefix.length + innerVal.codePos;
    }

    return unboundStamp;
  }

  if (inner.bakeVersionstamp) transformer.bakeVersionstamp = inner.bakeVersionstamp.bind(inner)

  if (inner.range) transformer.range = innerPrefix => {
    const innerRange = /** @type {NonNullable<typeof inner.range>} */(inner.range)(innerPrefix)
    return {
      begin: concat2(prefix, asBuf(innerRange.begin)),
      end: concat2(prefix, asBuf(innerRange.end)),
    }
  }

  return transformer
}
