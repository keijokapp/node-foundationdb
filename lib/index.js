import * as apiVersion from './apiVersion.js'
import Database from './database.js'
import { DirectoryLayer } from './directory.js'
import fdb from './native.js'
import { eachOption } from './opts.js'
import { networkOptionData } from './opts.g.js'
import { root } from './subspace.js'
import { strInc } from './util.js'

// Must be called before fdb is initialized. Eg setAPIVersion(510).
export { set as setAPIVersion } from './apiVersion.js'
export { default as FDBError } from './error.js'
export { default as Database } from './database.js'
export { Directory, DirectoryError } from './directory.js'
export { DirectoryLayer } // https://github.com/microsoft/TypeScript/issues/61718
export * as encoders from './encoders.js'
export { tuple } from './encoders.js'
export { default as keySelector } from './keySelector.js'
export {
  ConflictRangeType,
  DatabaseOptionCode,
  ErrorPredicate,
  MutationType,
  NetworkOptionCode,
  StreamingMode,
  TransactionOptionCode,
} from './opts.g.js'
export { default as Subspace, root } from './subspace.js'
export { default as Transaction } from './transaction.js'
export { NestedConflictError } from './nested.js'

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

/**
 * Can only be called before open()
 *
 * @param {import('./opts.g.js').NetworkOptions} netOpts
 */
export function configNetwork(netOpts) {
  if (initCalled) {
    throw Error('configNetwork must be called before FDB connections are opened')
  }

  eachOption(networkOptionData, netOpts, (code, val) => fdb.setNetworkOption(code, val))
}

/**
 * Opens a database and returns it.
 *
 * Note any network configuration must happen before the database is opened.
 *
 * @param {string} [clusterFile]
 * @param {import('./opts.g.js').DatabaseOptions} [dbOpts]
 */
export function open(clusterFile, dbOpts) {
  init()

  const db = new Database(fdb.createDatabase(clusterFile), root)

  if (dbOpts) {
    db.setNativeOptions(dbOpts)
  }

  return db
}
