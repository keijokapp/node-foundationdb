// The transformer type is used to transparently translate keys and values
// through an encoder and decoder function.

import type { Transformer, UnboundStamp } from './types'
import {
  asBuf, concat2, id, startsWith, strInc
} from './util'

export const defaultTransformer: Transformer<Buffer | string, Buffer> = {
  pack: id,
  unpack: id
}

export const defaultGetRange = <KeyIn, KeyOut>(prefix: KeyIn, keyXf: Transformer<KeyIn, KeyOut>): { begin: Buffer | string, end: Buffer | string } => ({
  begin: keyXf.pack(prefix),
  end: strInc(keyXf.pack(prefix))
})

export const prefixTransformer = <In, Out>(prefix: Buffer, inner: Transformer<In, Out>): Transformer<In, Out> => {
  const transformer: Transformer<In, Out> = {
    name: inner.name ? `prefixed ${inner.name}` : 'prefixTransformer',

    pack(v: In): Buffer | string {
      // If you heavily nest these it'll get pretty inefficient.
      const innerVal = inner.pack(v)

      return concat2(prefix, asBuf(innerVal))
    },
    unpack(buf: Buffer) {
      if (!startsWith(buf, prefix)) {
        throw Error('Cannot unpack key outside of prefix range.')
      }

      return inner.unpack(buf.subarray(prefix.length))
    }
  }

  if (inner.packUnboundVersionstamp) {
    transformer.packUnboundVersionstamp = (val: In): UnboundStamp => {
      const innerVal = inner.packUnboundVersionstamp!(val)

      const unboundStamp: UnboundStamp = {
        data: concat2(prefix, innerVal.data),
        stampPos: prefix.length + innerVal.stampPos
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
      const innerRange = inner.range!(innerPrefix)

      return {
        begin: concat2(prefix, asBuf(innerRange.begin)),
        end: concat2(prefix, asBuf(innerRange.end))
      }
    }
  }

  return transformer
}
