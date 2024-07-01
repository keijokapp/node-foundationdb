import nativeMod, * as fdb from './native'
import Database from './database'
import {eachOption} from './opts'
import {NetworkOptions, networkOptionData, DatabaseOptions} from './opts.g'
import {Transformer} from './transformer'
import {root} from './subspace'
import {DirectoryLayer} from './directory'

import * as apiVersion from './apiVersion'

// Must be called before fdb is initialized. Eg setAPIVersion(510).
export {set as setAPIVersion} from './apiVersion'

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

export {default as FDBError} from './error'
export {default as keySelector, KeySelector} from './keySelector'

// These are exported to give consumers access to the type. Databases must
// always be constructed using open or via a cluster object.
export {default as Database} from './database'
export {default as Transaction, Watch} from './transaction'
export {default as Subspace, root} from './subspace'
export {Directory, DirectoryLayer, DirectoryError} from './directory'

export {
  NetworkOptions,
  NetworkOptionCode,
  DatabaseOptions,
  DatabaseOptionCode,
  TransactionOptions,
  TransactionOptionCode,
  StreamingMode,
  MutationType,
  ConflictRangeType,
  ErrorPredicate,
} from './opts.g'

import {id, strInc} from './util'
export const util = {strInc}

import * as tuple from 'fdb-tuple'
import {TupleItem} from 'fdb-tuple'

export {TupleItem, tuple}

// This must come after tuple is defined, above.
export const directory = new DirectoryLayer() // Convenient root directory

export const encoders = {
  int32BE: {
    pack(num) {
      const b = Buffer.allocUnsafe(4)
      b.writeInt32BE(num)
      return b
    },
    unpack(buf) { return buf.readInt32BE() }
  } as Transformer<number, number>,

  json: {
    pack(obj) { return JSON.stringify(obj) },
    unpack(buf) { return JSON.parse(buf.toString()) }
  } as Transformer<any, any>,

  string: {
    pack(str) { return Buffer.from(str) },
    unpack(buf) { return buf.toString() }
  } as Transformer<string, string>,

  buf: {
    pack: id,
    unpack: id
  } as Transformer<Buffer, Buffer>,

  tuple: tuple as Transformer<TupleItem[], TupleItem[]>,
}

// Can only be called before open()
export function configNetwork(netOpts: NetworkOptions) {
  if (initCalled) throw Error('configNetwork must be called before FDB connections are opened')
  eachOption(networkOptionData, netOpts, (code, val) => nativeMod.setNetworkOption(code, val))
}

/**
 * Opens a database and returns it.
 *
 * Note any network configuration must happen before the database is opened.
 */
export function open(clusterFile?: string, dbOpts?: DatabaseOptions) {
  init()

  const db = new Database(nativeMod.createDatabase(clusterFile), root)
  if (dbOpts) db.setNativeOptions(dbOpts)
  return db
}
