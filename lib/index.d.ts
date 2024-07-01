import Database from './database.js'
import { DirectoryLayer } from './directory.js'
import { DatabaseOptions, NetworkOptions } from './opts.g.js'
import { NativeValue } from './types'
import { strInc } from './util.js'

export function configNetwork(netOpts: NetworkOptions): void

export function open(clusterFile?: string, dbOpts?: DatabaseOptions): Database<NativeValue, Buffer, NativeValue, Buffer>

export const stopNetworkSync: () => void

export namespace util {
  export { strInc }
}

export { TupleItem } from 'fdb-tuple'

export { set as setAPIVersion } from './apiVersion.js'

export { default as Database } from './database.js'

export { Directory, DirectoryLayer, DirectoryError } from './directory.js'
export const directory: DirectoryLayer

export * as encoders from './encoders.js'
export { tuple } from './encoders.js'

export { default as FDBError } from './error.js'

export { default as keySelector } from './keySelector.js'

export * from './opts.g.js'

export { default as Subspace, root } from './subspace.js'

export { default as Transaction } from './transaction.js'

// eslint-disable-next-line import/extensions
export * from './types'
