// @ts-check

import * as apiVersion from './apiVersion.js'
import Database from './database.js'
import {DirectoryLayer} from './directory.js'
export * as encoders from './encoders.js'
import fdb from './native.js'
import {eachOption} from './opts.js'
import {networkOptionData} from './opts.g.js'
import {root} from './subspace.js'
import {strInc} from './util.js'

/**
 * @typedef {import('./opts.g.js').NetworkOptions} NetworkOptions
 * @typedef {import('./opts.g.js').DatabaseOptions} DatabaseOptions
 * @typedef {import('./opts.g.js').TransactionOptions} TransactionOptions
 * @typedef {import('fdb-tuple').TupleItem} TupleItem
 */

// Must be called before fdb is initialized. Eg setAPIVersion(510).
export {set as setAPIVersion} from './apiVersion.js'

let initCalled = false

// This is called implicitly when the first cluster / db is opened.
const init = () => {
  if (apiVersion.get() == null) {
    throw Error('You must specify an API version to connect to FoundationDB. Eg: fdb.setAPIVersion(510);')
  }

  if (initCalled) return
  initCalled = true

  fdb.startNetwork()

  process.on('exit', () => fdb.stopNetwork())
}

// Destroy the network thread. This is not needed under normal circumstances;
// but can be used to de-init FDB.
export const stopNetworkSync = fdb.stopNetwork

export {default as FDBError} from './error.js'
export {default as keySelector} from './keySelector.js'

// These are exported to give consumers access to the type. Databases must
// always be constructed using open or via a cluster object.
export {default as Database} from './database.js'
export {default as Transaction} from './transaction.js'
export {default as Subspace, root} from './subspace.js'
export {Directory, DirectoryLayer, DirectoryError} from './directory.js'

export {
  NetworkOptionCode,
  DatabaseOptionCode,
  TransactionOptionCode,
  StreamingMode,
  MutationType,
  ConflictRangeType,
  ErrorPredicate,
} from './opts.g.js'

export const util = {strInc}

export {tuple} from './encoders.js'

export const directory = new DirectoryLayer() // Convenient root directory

// Can only be called before open()
/**
 * @param {NetworkOptions} netOpts
 */
export function configNetwork(netOpts) {
  if (initCalled) throw Error('configNetwork must be called before FDB connections are opened')
  eachOption(networkOptionData, netOpts, (code, val) => fdb.setNetworkOption(code, val))
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

  const db = new Database(fdb.createDatabase(clusterFile), root)
  if (dbOpts) db.setNativeOptions(dbOpts)
  return db
}
