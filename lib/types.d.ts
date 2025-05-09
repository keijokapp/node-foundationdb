import type { StreamingMode } from './opts.g.js'
import type Subspace from './subspace.js'

export interface DirectoryLayerOpts {
  /** The prefix for directory metadata nodes. Defaults to '\xfe' */
  nodePrefix?: undefined | NativeValue
  // We really actually want a NodeSubspace here, but we'll set the kv encoding
  // ourselves to make the API simpler.
  nodeSubspace?: undefined | Subspace<any, any, any, any>

  /** The prefix for content. Defaults to ''. */
  contentPrefix?: undefined | NativeValue // Defaults to '', the root.
  contentSubspace?: undefined | Subspace<any, any, any, any>

  allowManualPrefixes?: undefined | boolean // default false
}

export type KVList<Key, Value> = {
  results: [Key, Value][] // [key, value] pair.
  more: boolean
}

export interface KeySelector<Key> {
  key: Key
  orEqual: boolean
  offset: number
  _isKeySelector: true
}

export type NativeValue = string | Buffer

export interface RangeOptions extends RangeOptionsBatch {
  targetBytes?: undefined | number
}

export interface RangeOptionsBatch {
  // defaults to Iterator for batch mode, WantAll for getRangeAll.
  streamingMode?: undefined | StreamingMode
  limit?: undefined | number
  reverse?: undefined | boolean
}

export type Transformer<In, Out> = {
  name?: undefined | string // For debugging.

  // The tuple type supports embedding versionstamps, but the versionstamp
  // isn't known until the transaction has been committed.

  // TODO: I need a name for this fancy structure.
  pack(val: In): NativeValue
  unpack(buf: Buffer): Out

  // These are hooks for the tuple type to support unset versionstamps
  packUnboundVersionstamp?(val: In): UnboundStamp
  bakeVersionstamp?(val: In, versionstamp: Buffer, code: Buffer | undefined): void

  /// Range which includes all "children" of this item, or whatever that means
  /// for the type. Added primarily to make it easier to get a range with some
  /// tuple prefix.
  range?(prefix: In): { begin: NativeValue, end: NativeValue }
}

// Versionstamp that isn't yet bound to an actual version. If codePos is set,
// the database will also fill in an incrementing 2 byte code at that position
// relative to other versionstamped key / values inside the transaction.
export type UnboundStamp = { data: Buffer, stampPos: number, codePos?: number }

export type Version = Buffer

export interface Watch {
  cancel(): void
  // Resolves to true if the watch resolved normally. false if the watch it was aborted.
  promise: Promise<boolean>
}

export interface WatchWithValue<Value> extends Watch {
  value: Value | undefined
}

export type WatchOptions = {
  throwAllErrors?: undefined | boolean
}
