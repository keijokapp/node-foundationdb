import { platform } from 'os'
import * as path from 'path'
import FDBError from './error'
import { MutationType, StreamingMode } from './opts.g'

export type NativeValue = string | Buffer

export type KVList = {
  results: [Buffer, Buffer][], // [key, value] pair.
  more: boolean,
}

export type Watch = {
  cancel(): void
  // Resolves to true if the watch resolved normally. false if the watch it was aborted.
  promise: Promise<boolean>
}

export type Version = Buffer

export interface NativeTransaction {
  setOption(code: number, param: string | number | Buffer | null): void

  commit(): Promise<void>
  reset(): void
  cancel(): void
  onError(code: number): Promise<void>

  getApproximateSize(): Promise<number>

  get(key: NativeValue, isSnapshot: boolean): Promise<Buffer | undefined>
  // getKey always returns a value - but it will return the empty buffer or a
  // buffer starting in '\xff' if there's no other keys to find.
  getKey(key: NativeValue, orEqual: boolean, offset: number, isSnapshot: boolean): Promise<Buffer>
  set(key: NativeValue, val: NativeValue): void
  clear(key: NativeValue): void

  atomicOp(opType: MutationType, key: NativeValue, operand: NativeValue): void

  getRange(
    start: NativeValue, beginOrEq: boolean, beginOffset: number,
    end: NativeValue, endOrEq: boolean, endOffset: number,
    limit: number, target_bytes: number,
    mode: StreamingMode, iter: number, isSnapshot: boolean, reverse: boolean
  ): Promise<KVList>

  clearRange(start: NativeValue, end: NativeValue): void

  getEstimatedRangeSizeBytes(start: NativeValue, end: NativeValue): Promise<number>
  getRangeSplitPoints(start: NativeValue, end: NativeValue, chunkSize: number): Promise<Buffer[]>

  watch(key: NativeValue, ignoreStandardErrs: boolean): Watch

  addReadConflictRange(start: NativeValue, end: NativeValue): void
  addWriteConflictRange(start: NativeValue, end: NativeValue): void

  setReadVersion(v: Version): void
  getReadVersion(): Promise<Version>
  getCommittedVersion(): Version

  getVersionstamp(): Promise<Buffer>

  getAddressesForKey(key: NativeValue): string[]
}

export interface NativeDatabase {
  createTransaction(): NativeTransaction // invalid after the database has closed
  setOption(code: number, param: string | number | Buffer | null): void
  close(): void
}

export enum ErrorPredicate {
  Retryable = 50000,
  MaybeCommitted = 50001,
  RetryableNotCommitted = 50002
}

export interface NativeModule {
  setAPIVersion(v: number): void
  setAPIVersionImpl(v: number, h: number): void

  startNetwork(): void
  stopNetwork(): void

  createDatabase(clusterFile?: string): NativeDatabase

  setNetworkOption(code: number, param: string | number | Buffer | null): void

  errorPredicate(test: ErrorPredicate, code: number): boolean
}

// Will load a compiled build if present or a prebuild.
// If no build if found it will throw an exception
const rootDir = __dirname.endsWith(`dist${path.sep}lib`) // gross.
  ? path.resolve(`${__dirname}/../..`)
  : path.resolve(`${__dirname}/..`)

let mod

try {
  // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports
  mod = require('node-gyp-build')(rootDir)
} catch (e) {
  /* eslint-disable no-console */
  console.error('Could not load native module. Make sure the foundationdb client is installed and')
  console.error('(on windows) in your PATH. https://www.foundationdb.org/download/')

  // This is way more involved than it needs to be, but error messages are important.
  if (platform() === 'darwin') {
    const ldLibraryPath = process.env.DYLD_LIBRARY_PATH ?? ''

    if (!ldLibraryPath.includes('/usr/local/lib')) {
      const configFile = process.env.SHELL === '/bin/zsh' ? '.zshrc' : '.bash_profile'

      console.error()
      console.error('MacOS note: You also need to set DYLD_LIBRARY_PATH="/usr/local/lib" due to notarization. Run:\n')
      console.error(`  echo 'export DYLD_LIBRARY_PATH="/usr/local/lib"' >> ~/${configFile}`)
      console.error(`  source ~/${configFile}`)
      console.error('\nThen retry. See https://github.com/josephg/node-foundationdb/issues/42 for details.\n\n')
    }
  }
  /* eslint-enable no-console */

  throw e
}

mod.FDBError = FDBError

export default mod as NativeModule
