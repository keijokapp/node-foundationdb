// @ts-check

import nativeMod, * as fdb from './native.js'
import Database from './database.js'
import {eachOption} from './opts.js'
import {networkOptionData} from './opts.g.js'
import {root} from './subspace.js'
// import {DirectoryLayer} from './directory'

import * as apiVersion from './apiVersion.js'

/**
 * @typedef {import('./opts.g.js').NetworkOptions} NetworkOptions
 * @typedef {import('./opts.g.js').DatabaseOptions} DatabaseOptions
 * @typedef {import('./opts.g.js').TransactionOptions} TransactionOptions
 * @typedef {import('fdb-tuple').TupleItem} TupleItem
 */

// Must be called before fdb is initialized. Eg setAPIVersion(510).
export {set as setAPIVersion} from './apiVersion.js'

// 'napi'
export const modType = fdb.type

let initCalled = false

// This is called implicitly when the first cluster / db is opened.
const init = () => {
  if (apiVersion.get() == null) {
    throw Error('You must specify an API version to connect to FoundationDB. Eg: fdb.setAPIVersion(510);')
  }

  if (initCalled) return
  initCalled = true

  nativeMod.startNetwork()

  process.on('exit', () => nativeMod.stopNetwork())
}

// Destroy the network thread. This is not needed under normal circumstances;
// but can be used to de-init FDB.
export const stopNetworkSync = nativeMod.stopNetwork

export {default as FDBError} from './error.js'
export {default as keySelector} from './keySelector.js'

// These are exported to give consumers access to the type. Databases must
// always be constructed using open or via a cluster object.
export {default as Database} from './database.js'
export {default as Transaction} from './transaction.js'
export {default as Subspace, root} from './subspace.js'
// export {Directory, DirectoryLayer, DirectoryError} from './directory'

export {
  NetworkOptionCode,
  DatabaseOptionCode,
  TransactionOptionCode,
  StreamingMode,
  MutationType,
  ConflictRangeType,
  ErrorPredicate,
} from './opts.g.js'

import {id, strInc} from './util.js'
export const util = {strInc}

import * as tuple from 'fdb-tuple'
export {tuple}

// This must come after tuple is defined, above.
// export const directory = new DirectoryLayer() // Convenient root directory

export const encoders = {
  int32BE: /** @type {import('./transformer.js').Transformer<number, number>} */({
    pack(num) {
      const b = Buffer.allocUnsafe(4)
      b.writeInt32BE(num)
      return b
    },
    unpack(buf) { return buf.readInt32BE() }
  }),

  json: /** @type {import('./transformer.js').Transformer<any, any>} */({
    pack(obj) { return JSON.stringify(obj) },
    unpack(buf) { return JSON.parse(buf.toString('utf8')) }
  }),

  string: /** @type {import('./transformer.js').Transformer<string, string>} */({
    pack(str) { return Buffer.from(str, 'utf8') },
    unpack(buf) { return buf.toString('utf8') }
  }),

  buf: /** @type {import('./transformer.js').Transformer<Buffer, Buffer>} */({
    pack: id,
    unpack: id
  }),

  // TODO: Move this into a separate library
  tuple: /** @type {import('./transformer.js').Transformer<TupleItem[], TupleItem[]>} */(tuple),
}

/**
 * Can only be called before open() or openSync().
 *
 * @param {import('./opts.g.js').NetworkOptions} netOpts
 */
export function configNetwork(netOpts) {
  if (initCalled) throw Error('configNetwork must be called before FDB connections are opened')
  eachOption(networkOptionData, netOpts, (code, val) => nativeMod.setNetworkOption(code, val))
}

/**
 * Opens a database and returns it.
 *
 * Note any network configuration must happen before the database is opened.
 *
 * @param {string} [clusterFile]
 * @param {import('./opts.g.js').DatabaseOptions}  [dbOpts]
 */
export function open(clusterFile, dbOpts) {
  init()

  const db = new Database(nativeMod.createDatabase(clusterFile), root)
  if (dbOpts) db.setNativeOptions(dbOpts)
  return db
}
