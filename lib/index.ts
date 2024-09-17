import * as apiVersion from './apiVersion'
import Database from './database'
import { DirectoryLayer } from './directory'
import fdb from './native'
import { eachOption } from './opts'
import { NetworkOptions, networkOptionData, DatabaseOptions } from './opts.g'
import { root } from './subspace'
import { strInc } from './util'

export { TupleItem } from 'fdb-tuple'
// Must be called before fdb is initialized. Eg setAPIVersion(510).
export { set as setAPIVersion } from './apiVersion'
export { default as FDBError } from './error'
export { default as Database } from './database'
export { Directory, DirectoryLayer, DirectoryError } from './directory'
export * as encoders from './encoders'
export { tuple } from './encoders'
export { default as keySelector, KeySelector } from './keySelector'
export {
  ConflictRangeType,
  DatabaseOptionCode,
  DatabaseOptions,
  ErrorPredicate,
  MutationType,
  NetworkOptionCode,
  NetworkOptions,
  StreamingMode,
  TransactionOptionCode,
  TransactionOptions
} from './opts.g'
export { default as Subspace, root } from './subspace'
export { default as Transaction, Watch } from './transaction'

let initCalled = false

// This is called implicitly when the first cluster / db is opened.
const init = () => {
  if (apiVersion.get() == null) {
    throw Error('You must specify an API version to connect to FoundationDB. Eg: fdb.setAPIVersion(510);')
  }

  if (!initCalled) {
    initCalled = true

    fdb.startNetwork()

    process.on('exit', () => fdb.stopNetwork())
  }
}

// Destroy the network thread. This is not needed under normal circumstances;
// but can be used to de-init FDB.
export const stopNetworkSync = fdb.stopNetwork

export const util = { strInc }

export const directory = new DirectoryLayer() // Convenient root directory

// Can only be called before open()
export function configNetwork(netOpts: NetworkOptions) {
  if (initCalled) {
    throw Error('configNetwork must be called before FDB connections are opened')
  }

  eachOption(networkOptionData, netOpts, (code, val) => fdb.setNetworkOption(code, val))
}

/**
 * Opens a database and returns it.
 *
 * Note any network configuration must happen before the database is opened.
 */
export function open(clusterFile?: string, dbOpts?: DatabaseOptions) {
  init()

  const db = new Database(fdb.createDatabase(clusterFile), root)

  if (dbOpts) {
    db.setNativeOptions(dbOpts)
  }

  return db
}
