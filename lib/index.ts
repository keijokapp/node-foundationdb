// Stuff that hasn't been ported over:

// const Transactional = require('./retryDecorator')
// const tuple = require('./tuple')
// const buffer = require('./bufferConversion')
// const locality = require('./locality')
// const directory = require('./directory')
// const Subspace = require('./subspace')

import apiVersion from './apiVersion'
import FDBError from './error'
import nativeMod, * as fdb from './native'
import Database, {DbOptions} from './database'
import keySelector, {KeySelector} from './keySelector'
import * as util from './util'
import {StreamingMode} from './opts.g'

let initCalled = false
const init = () => {
  if (initCalled) return
  initCalled = true

  nativeMod.apiVersion(apiVersion)
  nativeMod.startNetwork()

  process.on('exit', () => nativeMod.stopNetwork())
}

const wrapCluster = (cluster: fdb.NativeCluster) => ({
  openDatabase(dbName: 'DB', opts: DbOptions) {
    return cluster.openDatabase(dbName).then(db => new Database(db, opts))
  },
  openDatabaseSync(dbName: 'DB', opts: DbOptions) {
    return new Database(cluster.openDatabaseSync(dbName), opts)
  },
})

const createCluster = (clusterFile?: string) => {
  init()
  return nativeMod.createCluster(clusterFile).then(c => wrapCluster(c))
}
const createClusterSync = (clusterFile?: string) => {
  init()
  return wrapCluster(nativeMod.createClusterSync(clusterFile))
}

export = {
  FDBError,
  keySelector,
  StreamingMode,

  // transactional: Transactional,
  // tuple,
  // locality,
  // directory,
  // DirectoryLayer,
  // Subspace,

  // This must be called before
  configNetwork(netOpts: any) {
    if (initCalled) throw Error('configNetwork must be called before FDB connections are opened')
    util.eachOption('NetworkOption', netOpts, (code, val) => nativeMod.setNetworkOption(code, val))
  },

  // Note if you need to you must configure your network before creating a cluster.
  createCluster,
  createClusterSync,

  openSync(clusterFile?: string, dbOpts?: DbOptions) {
    // TODO: Caching disabled for now. Is this the right call? I think so.
    // You should structure your app so it doesn't need to depend on a cache here.
    return createClusterSync(clusterFile).openDatabaseSync('DB', dbOpts)
  },

  // TODO: Should I expose a method here for stopping the network for clean shutdown?
  // I feel like I should.. but I'm not sure when its useful. Will the network thread
  // keep the process running?
}