import nativeMod, * as fdb from './native'
import Database from './database'
import {eachOption} from './opts'
import {NetworkOptions, networkOptionData, DatabaseOptions} from './opts.g'
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

import {strInc} from './util'
export const util = {strInc}

export {TupleItem} from 'fdb-tuple'

export * as encoders from './encoders'
export {tuple} from './encoders'

export const directory = new DirectoryLayer() // Convenient root directory

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
