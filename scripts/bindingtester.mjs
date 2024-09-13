#!/usr/bin/env -S node

// @ts-check

// This file implements the foundationdb binding API tester fuzzer backend
// described here:
//
// https://github.com/apple/foundationdb/blob/master/bindings/bindingtester/spec/bindingApiTester.md

// This script should not be invoked directly. Instead checkout foundationdb
// and invoke the binding tester from there, pointing it at this script.

// To run this script:
//
// 1. Checkout and build foundationdb (with a version matching the installed version).
// 2. cp (build directory)/bindings/python/fdb/fdboptions.py bindings/python/fdb/
// 3. Add this line to bindings/bindingtester/known_testers.py:
//
// 'node': Tester('node', '/home/seph/src/node-foundationdb/scripts/bindingtester.mjs', 53, 500, 720, types=ALL_TYPES),
//
// 4. Use the run_tester_loop.sh script to run the bindings tester. You will need to comment out the other bindings
//    and add 'node'.

import assert from 'node:assert'
import path from 'node:path'
import url from 'node:url'
import { register } from 'node:module'
import nodeUtil from 'node:util'
import chalk from 'chalk'
import tsNode from 'ts-node'

register('ts-node/esm', import.meta.url)
tsNode.register({ cwd: path.resolve(url.fileURLToPath(import.meta.url), '..') })

/**
 * @import { Database, Transaction, Subspace, Directory, DirectoryLayer, TupleItem, StreamingMode } from '../lib/index.ts'
 */
/**
 * @typedef {{instrId: number, data: any}} StackItem
 */

// NodeJS and TypeScript have different semantics for ESM interop. This has to be a
// workaround until all modules are converted to ESM or TypeScript gets their shit together.
const [
  {
    Database,
    Directory,
    DirectoryError,
    DirectoryLayer,
    FDBError,
    MutationType,
    Subspace,
    TransactionOptionCode,
    keySelector,
    tuple,
    util,
    ...fdb
  },
  { concat2, emptyBuffer, startsWith },
  { packPrefixedVersionstamp }
] = await Promise.all([
  import('../lib/index.ts').then(/** @param {any} module @returns {import('../lib/index.ts')} */module => module.default),
  import('../lib/util.ts').then(/** @param {any} module @returns {import('../lib/util.ts')} */module => module.default),
  import('../lib/versionstamp.ts').then(/** @param {any} module @returns {import('../lib/versionstamp.ts')} */module => module.default)
])

const verbose = true

/**
 * The string keys are all buffers, encoded as hex.
 * This is shared between all threads.
 * @type {Record<string, Transaction>}
 */
const transactions = {}

//
/**
 * 'RESULT_NOT_PRESENT' -> 'ResultNotPresent'
 * @param {string} str
 * @returns {string}
 */
const toUpperCamelCase = str => str.toLowerCase().replace(/(^\w|_\w)/g, x => x[x.length - 1].toUpperCase())

/** @type {import('../lib/transformer.ts').Transformer<TupleItem | TupleItem[], TupleItem[]>} */
const tupleStrict = {
  ...tuple,
  name: 'tuple strict',
  unpack(val) {
    return tuple.unpack(val, true)
  }
}

const colors = [chalk.blueBright, chalk.red, chalk.cyan, chalk.greenBright, chalk.grey]

/**
 * @param {Database} db
 * @param {Buffer} initialName
 * @returns {{ run(instrBuf: Buffer, log?: import('node:fs').WriteStream): Promise<void> }}
 */
const makeMachine = (db, initialName) => {
  /** @type {StackItem[]} */
  const stack = []
  let tnName = initialName
  let instrId = 0
  let lastVersion = Buffer.alloc(8) // null / empty last version.

  const threadColor = /** @type {import('chalk').Chalk} */(colors.pop())
  colors.unshift(threadColor)

  // Directory stuff
  /** @type {Array<Subspace<any, any, any, any> | Directory<any, any, any, any> | DirectoryLayer | undefined>} */
  const dirList = [fdb.directory]
  let dirIdx = 0
  let dirErrIdx = 0

  const tnNameKey = () => tnName.toString('hex')

  /** @param {Error} e */
  const catchFdbErr = e => {
    if (e instanceof FDBError) {
      // This encoding is silly. Also note that these errors are normal & part of the test.
      if (verbose) {
        console.log(chalk.red('output error'), instrId, e)
      }

      return tuple.pack([Buffer.from('ERROR'), Buffer.from(e.code.toString())])
    }

    throw e
  }

  const unwrapNull = val => val === undefined ? Buffer.from('RESULT_NOT_PRESENT') : val
  const wrapP = p => p instanceof Promise ? p.then(unwrapNull, catchFdbErr) : unwrapNull(p)

  const popValue = async () => {
    assert(stack.length, 'popValue when stack is empty')

    if (verbose) {
      console.log(chalk.green('pop value'), stack[stack.length - 1].instrId, 'value:', stack[stack.length - 1].data)
    }

    return /** @type {StackItem} */(stack.pop()).data
  }

  /**
   * @template T
   * @param {(item: unknown) => boolean} pred
   * @param {string} typeLabel
   * @returns {Promise<T>}
   */
  const chk = async (pred, typeLabel) => {
    const { instrId } = stack[stack.length - 1]
    const val = await popValue()
    assert(pred(val), `${threadColor('Unexpected type')} of ${nodeUtil.inspect(val, false, undefined, true)} inserted at ${instrId} - espected ${typeLabel}`)

    return /** @type {T} */val
  }

  /** @returns {Promise<string>} */
  const popStr = () => chk(val => typeof val === 'string', 'string')
  /** @returns {Promise<boolean>} */
  const popBool = () => chk(val => val === 0 || val === 1, 'bool').then(x => !!x)
  /** @returns {Promise<number | bigint>} */
  const popInt = () => chk(val => Number.isInteger(val) || typeof val === 'bigint', 'int')
  /** @returns {Promise<number>} */
  const popSmallInt = () => chk(val => Number.isInteger(val), 'int')
  /** @returns {Promise<Buffer>} */
  const popBuffer = () => chk(Buffer.isBuffer, 'buf')
  /** @returns {Promise<string | Buffer>} */
  const popStrBuf = () => chk(val => typeof val === 'string' || Buffer.isBuffer(val), 'buf|str')
  /** @returns {Promise<Buffer | null>} */
  const popNullableBuf = () => chk(val => val == null || Buffer.isBuffer(val), 'buf|null')

  const popSelector = async () => {
    const key = await popBuffer()
    const orEqual = await popBool()
    const offset = await popInt()

    return keySelector(key, orEqual, Number(offset))
  }

  const popNValues = async () => {
    const n = await popInt()
    const result = []

    for (let i = 0; i < n; i++) {
      result.push(await popValue())
    }

    return result
  }

  /** @param {any} data */
  const pushValue = data => {
    if (verbose) {
      console.log(chalk.green('push value'), instrId, 'value:', data)
    }

    stack.push({ instrId, data })
  }

  /** @param {unknown[]} data */
  const pushArrItems = data => {
    for (let i = 0; i < data.length; i++) {
      pushValue(data[i])
    }
  }

  /** @param {TupleItem} data */
  const pushTupleItem = data => {
    pushValue(data)

    if (verbose) {
      console.log(chalk.green('(encodes to)'), tuple.pack(data))
    }
  }

  /** @param {string} data */
  const pushLiteral = data => {
    if (verbose) {
      console.log(chalk.green('(literal:'), data, chalk.green(')'))
    }

    pushValue(Buffer.from(data, 'ascii'))
  }

  /** @param {Promise<unknown> | unknown} data */
  const maybePush = data => {
    if (data) {
      pushValue(wrapP(data))
    }
  }

  /**
   * @param {Buffer} buf
   * @param {Buffer} prefix
   * @returns {boolean}
   */
  const bufBeginsWith = (buf, prefix) => prefix.length <= buf.length && buf.compare(prefix, 0, prefix.length, 0, prefix.length) === 0

  // Directory helpers
  /** @returns {Directory} */
  const getCurrentDirectory = () => {
    const val = dirList[dirIdx]
    assert(val instanceof Directory)

    return val
  }

  /** @returns {Subspace} */
  const getCurrentSubspace = () => {
    const val = dirList[dirIdx]
    assert(val instanceof Directory || val instanceof Subspace)

    return val.getSubspace()
  }

  /** @returns {Directory | DirectoryLayer} */
  const getCurrentDirectoryOrLayer = () => {
    const val = dirList[dirIdx]
    assert(val instanceof Directory || val instanceof DirectoryLayer)

    return val
  }

  /**
   * @type {Record<string, (operand: Database | Transaction, ...args: TupleItem[]) => unknown>}
   */
  const operations = {
    // Stack operations
    PUSH(_, data) {
      pushValue(data)
    },
    POP() {
      stack.pop()
    },
    DUP() {
      stack.push(stack[stack.length - 1])
    },
    EMPTY_STACK() {
      stack.length = 0
    },
    async SWAP() {
      // TODO: Should this wait for the promises in question to resolve?
      const depth = Number(await popInt())
      assert(depth < stack.length)
      const a = stack[stack.length - depth - 1]
      const b = stack[stack.length - 1]

      stack[stack.length - depth - 1] = b
      stack[stack.length - 1] = a
    },
    async SUB() {
      const a = await popInt()
      const b = await popInt()
      pushValue(BigInt(a) - BigInt(b))
    },
    async CONCAT() {
      const a = await popStrBuf() // both strings or both bytes.
      const b = await popStrBuf()
      assert(typeof a === typeof b, 'concat type mismatch')

      if (typeof a === 'string') {
        pushValue(a + b)
      } else {
        pushValue(Buffer.concat([a, /** @type {Buffer} */(b)]))
      }
    },
    async LOG_STACK() {
      const prefix = await popBuffer()
      let i = 0

      while (i < stack.length) {
        // eslint-disable-next-line no-loop-func
        await db.doTransaction(async tn => {
          for (let k = 0; k < 100 && i < stack.length; k++) {
            const { instrId, data } = stack[i]

            let packedData = tuple.pack([await wrapP(data)])

            if (packedData.length > 40000) {
              packedData = packedData.slice(0, 40000)
            }

            // TODO: Would be way better here to use a tuple transaction.
            tn.set(Buffer.concat([prefix, tuple.pack([i, instrId])]), packedData)
            i++
          }
        })
      }

      stack.length = 0
    },

    // Transactions
    NEW_TRANSACTION() {
      // We're setting the trannsaction identifier so if you turn on tracing at
      // the bottom of the file, we'll be able to track individual transactions.
      // This is helpful for debugging write conflicts, and things like that.
      /** @type {import('../lib/opts.g.ts').TransactionOptions} */
      const opts = {
        debug_transaction_identifier: `${instrId}`,
        log_transaction: true
      }

      transactions[tnNameKey()] = db.rawCreateTransaction(instrId > 430 ? undefined : opts)
      /** @type {any} */transactions[tnNameKey()]._instrId = instrId
    },
    async USE_TRANSACTION() {
      tnName = await popBuffer()

      if (verbose) {
        console.log('using tn', tnName)
      }

      if (transactions[tnNameKey()] == null) {
        transactions[tnNameKey()] = db.rawCreateTransaction()
      }
    },
    async ON_ERROR(oper) {
      const code = Number(await popInt())
      pushValue(wrapP(/** @type {Transaction} */(oper).rawOnError(code)))
    },

    async GET(oper) {
      const key = await popBuffer()
      pushValue(wrapP(oper.get(key)))
    },
    async GET_KEY(oper) {
      const keySel = await popSelector()
      const prefix = await popBuffer()

      const result = await oper.getKey(keySel) ?? emptyBuffer

      if (result.equals(Buffer.from('RESULT_NOT_PRESENT'))) {
        return result
      }

      if (bufBeginsWith(result, prefix)) {
        // result starts with prefix.
        pushValue(result)
      } else if (result.compare(prefix) < 0) {
        // RESULT < PREFIX
        pushValue(prefix)
      } else {
        // RESULT > PREFIX
        pushValue(util.strInc(prefix))
      }
    },
    async GET_RANGE(oper) {
      const beginKey = await popBuffer()
      const endKey = await popBuffer()
      const limit = Number(await popInt())
      const reverse = await popBool()
      const streamingMode = /** @type {StreamingMode} */(await popInt())

      const results = await oper.getRangeAll(
        keySelector.from(beginKey),
        keySelector.from(endKey),
        { streamingMode, limit, reverse }
      )

      pushTupleItem(tuple.pack(Array.prototype.concat.apply([], results)))
    },
    async GET_RANGE_STARTS_WITH(oper) {
      const prefix = await popBuffer()
      const limit = Number(await popInt())
      const reverse = await popBool()
      const streamingMode = /** @type {StreamingMode} */(await popInt())
      const results = await oper.getRangeAllStartsWith(prefix, { streamingMode, limit, reverse })
      pushValue(tuple.pack(Array.prototype.concat.apply([], results)))
    },
    async GET_RANGE_SELECTOR(oper) {
      const beginSel = await popSelector()
      const endSel = await popSelector()
      const limit = Number(await popInt())
      const reverse = await popBool()
      const streamingMode = /** @type {StreamingMode} */(await popInt())
      const prefix = await popBuffer()

      const results = (await oper.getRangeAll(beginSel, endSel, { streamingMode, limit, reverse }))
        .filter(([k]) => bufBeginsWith(k, prefix))

      pushValue(tuple.pack(Array.prototype.concat.apply([], results)))
    },
    async GET_ESTIMATED_RANGE_SIZE(oper) {
      const beginKey = await popBuffer()
      const endKey = await popBuffer()
      await oper.getEstimatedRangeSizeBytes(beginKey, endKey) // Result ignored.
      pushLiteral('GOT_ESTIMATED_RANGE_SIZE')
    },
    async GET_RANGE_SPLIT_POINTS(oper) {
      const beginKey = await popBuffer()
      const endKey = await popBuffer()
      const chunkSize = await popInt()

      await oper.getRangeSplitPoints(beginKey, endKey, Number(chunkSize))

      // For some reason, the results are ignored.
      pushLiteral('GOT_RANGE_SPLIT_POINTS')
    },
    async GET_READ_VERSION(oper) {
      try {
        lastVersion = await /** @type {Transaction} */(oper).getReadVersion()
        pushLiteral('GOT_READ_VERSION')
      } catch (e) {
        pushValue(catchFdbErr(e))
      }
    },
    async GET_VERSIONSTAMP(oper) {
      pushValue(wrapP(/** @type {Transaction} */(oper).getVersionstamp().promise))
    },

    // Transaction set operations
    async SET(oper) {
      const key = await popStrBuf()
      const val = await popStrBuf()

      if (verbose) {
        console.log('SET', key, val)
      }

      maybePush(oper.set(key, val))
    },
    SET_READ_VERSION(oper) {
      /** @type {Transaction} */(oper).setReadVersion(lastVersion)
    },
    async CLEAR(oper) {
      maybePush(oper.clear(await popStrBuf()))
    },
    async CLEAR_RANGE(oper) {
      maybePush(oper.clearRange(await popStrBuf(), await popStrBuf()))
    },
    async CLEAR_RANGE_STARTS_WITH(oper) {
      maybePush(oper.clearRangeStartsWith(await popStrBuf()))
    },
    async ATOMIC_OP(oper) {
      const codeStr = toUpperCamelCase(await popStr())
      const code = MutationType[codeStr]
      assert(code, `Could not find atomic codestr ${codeStr}`)
      maybePush(oper.atomicOp(code, await popStrBuf(), await popStrBuf()))
    },
    async READ_CONFLICT_RANGE(oper) {
      /** @type {Transaction} */(oper).addReadConflictRange(await popStrBuf(), await popStrBuf())
      pushLiteral('SET_CONFLICT_RANGE')
    },
    async WRITE_CONFLICT_RANGE(oper) {
      /** @type {Transaction} */(oper).addWriteConflictRange(await popStrBuf(), await popStrBuf())
      pushLiteral('SET_CONFLICT_RANGE')
    },
    async READ_CONFLICT_KEY(oper) {
      /** @type {Transaction} */(oper).addReadConflictKey(await popStrBuf())
      pushLiteral('SET_CONFLICT_KEY')
    },
    async WRITE_CONFLICT_KEY(oper) {
      /** @type {Transaction} */(oper).addWriteConflictKey(await popStrBuf())
      pushLiteral('SET_CONFLICT_KEY')
    },
    DISABLE_WRITE_CONFLICT(oper) {
      /** @type {Transaction} */(oper).setOption(TransactionOptionCode.NextWriteNoWriteConflictRange)
    },
    COMMIT(oper) {
      pushValue(wrapP(/** @type {Transaction} */(oper).rawCommit()))
    },
    RESET(oper) {
      /** @type {Transaction} */(oper).rawReset()
    },
    CANCEL(oper) {
      /** @type {Transaction} */(oper).rawCancel()
    },
    GET_COMMITTED_VERSION(oper) {
      lastVersion = /** @type {Transaction} */(oper).getCommittedVersion()
      pushLiteral('GOT_COMMITTED_VERSION')
    },
    async GET_APPROXIMATE_SIZE(oper) {
      await /** @type {Transaction} */(oper).getApproximateSize()
      pushLiteral('GOT_APPROXIMATE_SIZE')
    },
    async WAIT_FUTURE() {
      await stack[stack.length - 1].data
    },

    // Tuple operations
    async TUPLE_PACK() {
      pushValue(tuple.pack(await popNValues()))
    },
    async TUPLE_PACK_WITH_VERSIONSTAMP() {
      const prefix = await popBuffer()

      try {
        const value = tuple.packUnboundVersionstamp(await popNValues())
        pushLiteral('OK')
        const pack = packPrefixedVersionstamp(prefix, value, true)
        pushValue(pack)
      } catch (e) {
        // TODO: Add userspace error codes to these.
        if (e.message === 'No incomplete versionstamp included in tuple pack with versionstamp') {
          pushLiteral('ERROR: NONE')
        } else if (e.message === 'Tuples may only contain 1 unset versionstamp') {
          pushLiteral('ERROR: MULTIPLE')
        } else {
          throw e
        }
      }
    },
    async TUPLE_UNPACK() {
      const packed = await popBuffer()

      for (const item of tuple.unpack(packed, true)) {
        pushValue(tuple.pack([item]))
      }
    },
    async TUPLE_RANGE() {
      const { begin, end } = tuple.range(await popNValues())
      pushValue(begin)
      pushValue(end)
    },
    async TUPLE_SORT() {
      // Look I'll be honest. I could put a compare function into the tuple
      // type, but it doesn't do anything you can't trivially do yourself.
      const items = (await popNValues())
        .map(buf => tuple.unpack(buf, true))
        .sort((a, b) => tuple.pack(a).compare(tuple.pack(b)))

      for (const item of items) {
        pushValue(tuple.pack(item))
      }
    },
    async ENCODE_FLOAT() {
      const buf = await popBuffer()

      // Note the byte representation of nan isn't stable, so even though we can
      // use DataView to read the "right" nan value here and avoid
      // canonicalization, we still can't use it because v8 might change the
      // representation of the passed nan value under the hood. More:
      // https://github.com/nodejs/node/issues/32697
      const value = buf.readFloatBE(0)

      pushTupleItem(isNaN(value) ? { type: 'float', value, rawEncoding: buf } : { type: 'float', value })
    },
    async ENCODE_DOUBLE() {
      const buf = await popBuffer()
      const value = buf.readDoubleBE(0)

      if (verbose) {
        console.log('bt encode_double', buf, value, buf.byteOffset)
      }

      pushTupleItem(isNaN(value) ? { type: 'double', value, rawEncoding: buf } : { type: 'double', value })
    },
    async DECODE_FLOAT() {
      // These are both super gross. Not sure what to do about that.
      const val = await popValue()
      assert(typeof val === 'object' && val.type === 'float')

      const dv = new DataView(new ArrayBuffer(4))
      dv.setFloat32(0, val.value, false)
      pushValue(Buffer.from(dv.buffer))
    },
    async DECODE_DOUBLE() {
      const val = await popValue()
      assert(val.type === 'double', `val is ${nodeUtil.inspect(val)}`)

      const dv = new DataView(new ArrayBuffer(8))
      dv.setFloat64(0, val.value, false)
      pushValue(Buffer.from(dv.buffer))
    },

    // Thread Operations
    async START_THREAD() {
      const prefix = await popBuffer()
      runFromPrefix(db, prefix)
    },
    async WAIT_EMPTY() {
      const prefix = await popBuffer()
      await db.doTransaction(async tn => {
        const nextKey = await tn.getKey(keySelector.firstGreaterOrEqual(prefix))

        if (nextKey && bufBeginsWith(nextKey, prefix)) {
          throw new FDBError('wait_empty', 1020)
        }
      }).catch(catchFdbErr)
      pushLiteral('WAITED_FOR_EMPTY')
    },

    // TODO: Invoke mocha here
    UNIT_TESTS() {},

    // **** Directory stuff ****
    async DIRECTORY_CREATE_SUBSPACE() {
      const path = await popNValues()
      const rawPrefix = await popStrBuf()

      if (verbose) {
        console.log('path', path, 'rawprefix', rawPrefix)
      }

      const subspace = new Subspace(rawPrefix).withKeyEncoding(tupleStrict).at(path)

      dirList.push(subspace)
    },

    async DIRECTORY_CREATE_LAYER() {
      const index1 = await popSmallInt()
      const index2 = await popSmallInt()
      const allowManualPrefixes = await popBool()

      const nodeSubspace = /** @type {Subspace | undefined} */(dirList[index1])
      const contentSubspace = /** @type {Subspace | undefined} */(dirList[index2])

      if (verbose) {
        console.log('dcl', index1, index2, allowManualPrefixes)
      }

      dirList.push(
        nodeSubspace != null && contentSubspace != null
          ? new DirectoryLayer({
            nodeSubspace,
            contentSubspace,
            allowManualPrefixes
          })
          : undefined
      )
    },

    async DIRECTORY_CREATE_OR_OPEN(oper) {
      const path = await popNValues()
      const layer = await popNullableBuf()

      const dir = await getCurrentDirectoryOrLayer().createOrOpen(oper, path, layer ?? undefined)
      dirList.push(dir)
    },
    async DIRECTORY_CREATE(oper) {
      const path = await popNValues()
      const layer = await popNullableBuf()
      const prefix = await popValue() ?? undefined

      if (verbose) {
        console.log('path', path, layer, prefix)
      }

      const dir = await getCurrentDirectoryOrLayer().create(oper, path, layer ?? undefined, prefix)
      dirList.push(dir)
    },
    async DIRECTORY_OPEN(oper) {
      const path = await popNValues()
      const layer = await popNullableBuf()

      const parent = getCurrentDirectoryOrLayer()
      const dir = await parent.open(oper, path, layer ?? undefined)

      if (verbose) {
        console.log('push new directory', dir.getPath(), 'at index', dirList.length, 'p', parent.getPath(), parent.constructor.name, path)
      }

      dirList.push(dir)
    },

    async DIRECTORY_CHANGE() {
      dirIdx = await popSmallInt()

      if (dirList[dirIdx] == null) {
        dirIdx = dirErrIdx
      }

      const result = dirList[dirIdx]

      if (verbose) {
        console.log('Changed directory index to', dirIdx, result == null ? 'null' : result.constructor.name)
      }
    },
    async DIRECTORY_SET_ERROR_INDEX() {
      dirErrIdx = await popSmallInt()

      if (verbose) {
        console.log('Changed directory error index to', dirErrIdx)
      }
    },

    async DIRECTORY_MOVE(oper) {
      const oldPath = await popNValues()
      const newPath = await popNValues()

      if (verbose) {
        console.log('move', oldPath, newPath)
      }

      dirList.push(await getCurrentDirectoryOrLayer().move(oper, oldPath, newPath))
    },
    async DIRECTORY_MOVE_TO(oper) {
      const dir = await getCurrentDirectoryOrLayer()
      const newAbsPath = await popNValues()

      // There's no moveTo method to call in DirectoryLayer - but this is what it would do if there were.
      if (dir instanceof DirectoryLayer) {
        throw new DirectoryError('The root directory cannot be moved.')
      }

      dirList.push(await getCurrentDirectory().moveTo(oper, newAbsPath))
    },
    async DIRECTORY_REMOVE(oper) {
      const count = await popSmallInt() // either 0 or 1
      const path = count === 1
        ? await popNValues()
        : undefined
      await getCurrentDirectoryOrLayer().remove(oper, path)
    },
    async DIRECTORY_REMOVE_IF_EXISTS(oper) {
      const count = await popSmallInt() // either 0 or 1
      const path = count === 1
        ? await popNValues()
        : undefined
      await getCurrentDirectoryOrLayer().removeIfExists(oper, path)
    },
    async DIRECTORY_LIST(oper) {
      const count = await popSmallInt() // either 0 or 1
      const path = count === 1
        ? await popNValues()
        : undefined
      const children = tuple.pack(await getCurrentDirectoryOrLayer().listAll(oper, path))
      pushValue(children)
    },
    async DIRECTORY_EXISTS(oper) {
      const count = await popSmallInt() // either 0 or 1
      const path = count === 0
        ? undefined
        : await popNValues()
      pushValue(await getCurrentDirectoryOrLayer().exists(oper, path) ? 1 : 0)
    },
    async DIRECTORY_PACK_KEY() {
      const keyTuple = await popNValues()
      pushValue(getCurrentSubspace().withKeyEncoding(tupleStrict).packKey(keyTuple))
    },
    async DIRECTORY_UNPACK_KEY() {
      const key = await popBuffer()
      const tup = getCurrentSubspace().withKeyEncoding(tupleStrict).unpackKey(key)

      if (verbose) {
        console.log('unpack key', key, tup)
      }

      pushArrItems(tup)
    },
    async DIRECTORY_RANGE() {
      const keyTuple = await popNValues()
      const { begin, end } = getCurrentSubspace().withKeyEncoding(tupleStrict).packRangeStartsWith(keyTuple)
      pushValue(begin); pushValue(end)
    },
    async DIRECTORY_CONTAINS() {
      const key = await popStrBuf()
      pushValue(getCurrentSubspace().contains(key) ? 1 : 0)
    },
    async DIRECTORY_OPEN_SUBSPACE() {
      const childPrefix = await popNValues()
      dirList.push(getCurrentSubspace().withKeyEncoding(tupleStrict).at(childPrefix))
    },

    async DIRECTORY_LOG_SUBSPACE(oper) {
      const prefix = await popBuffer()
      await oper.set(concat2(prefix, tuple.pack(dirIdx)), getCurrentSubspace().prefix)
    },
    async DIRECTORY_LOG_DIRECTORY(oper) {
      const dir = await getCurrentDirectoryOrLayer()

      const prefix = await popBuffer()
      const logSubspace = new Subspace(prefix)
        .withKeyEncoding(tupleStrict)
        .withValueEncoding(tupleStrict)
        .at(dirIdx)

      const exists = await dir.exists(oper)

      if (verbose) {
        console.log('type', dir.constructor.name)
      }

      const children = exists ? await dir.listAll(oper) : []
      const layer = dir instanceof Directory ? dir.getLayerRaw() : emptyBuffer

      const scopedOper = oper instanceof Database ? oper.at(logSubspace) : oper.at(logSubspace)
      await scopedOper.set('path', dir.getPath())
      await scopedOper.set('layer', layer ?? null)
      await scopedOper.set('exists', exists ? 1 : 0)
      await scopedOper.set('children', children)

      if (verbose) {
        console.log('path', dir.getPath(), 'layer', layer, 'exists', exists, 'children', children)
      }
    },

    async DIRECTORY_STRIP_PREFIX() {
      const byteArray = await popBuffer()

      if (verbose) {
        console.log('strip prefix', dirList[dirIdx])
      }

      const { prefix } = getCurrentSubspace()

      if (!startsWith(byteArray, prefix)) {
        throw Error('String does not start with raw prefix')
      } else {
        pushValue(byteArray.slice(prefix.length))
      }
    }
  }

  return {
    async run(instrBuf, log) {
      const instruction = tuple.unpack(instrBuf, true)
      let opcode = /** @type {string} */(instruction[0])
      const oper = instruction.slice(1)

      if (verbose) {
        if (oper.length) {
          console.log(chalk.magenta(opcode), instrId, threadColor(initialName.toString('ascii')), oper, instrBuf.toString('hex'))
        } else {
          console.log(chalk.magenta(opcode), instrId, threadColor(initialName.toString('ascii')))
        }
      }

      if (log) {
        log.write(`${opcode} ${instrId} ${stack.length}\n`)
      }

      /** @type {Transaction | Database} */
      let operand = transactions[tnNameKey()]

      if (opcode.endsWith('_SNAPSHOT')) {
        opcode = opcode.slice(0, -'_SNAPSHOT'.length)
        operand = operand.snapshot()
      } else if (opcode.endsWith('_DATABASE')) {
        opcode = opcode.slice(0, -'_DATABASE'.length)
        operand = db
      }

      try {
        if (operations[opcode] == null) {
          throw Error(`Unsupported opcode ${opcode}`)
        }

        await operations[opcode](operand, ...oper)
      } catch (e) {
        if (verbose) {
          console.log('Exception:', e.message)
        }

        if (opcode.startsWith('DIRECTORY_')) {
          // For some reason we absorb all errors here rather than just
          // directory errors. This is probably a bug in the fuzzer, but eh. See
          // seed 3079719521.

          // if (!(e instanceof DirectoryError)) throw e

          if ([
            'DIRECTORY_CREATE_SUBSPACE',
            'DIRECTORY_CREATE_LAYER',
            'DIRECTORY_CREATE_OR_OPEN',
            'DIRECTORY_CREATE',
            'DIRECTORY_OPEN',
            'DIRECTORY_MOVE',
            'DIRECTORY_MOVE_TO',
            'DIRECTORY_OPEN_SUBSPACE'
          ].includes(opcode)) {
            dirList.push(undefined)
          }

          pushLiteral('DIRECTORY_ERROR')
        } else {
          const err = catchFdbErr(e)
          pushValue(err)
        }
      }

      if (verbose) {
        console.log(chalk.yellow('STATE'), instrId, threadColor(initialName.toString('ascii')), tnName.toString('ascii'), lastVersion)
        console.log(`stack length ${stack.length}:`)

        if (stack.length >= 1) {
          console.log('  Stack top:', stack[stack.length - 1].instrId, stack[stack.length - 1].data)
        }

        if (stack.length >= 2) {
          console.log('  stack t-1:', stack[stack.length - 2].instrId, stack[stack.length - 2].data)
        }
      }

      instrId++
    }
  }
}

/** @type {Set<Promise<void>>} */
const threads = new Set()
let instructionsRun = 0

/**
 * @param {Database} db
 * @param {Buffer} prefix
 * @param {import('fs').WriteStream} [log]
 * @returns {Promise<void>}
 */
const run = async (db, prefix, log) => {
  const machine = makeMachine(db, prefix)

  const { begin, end } = tuple.range([prefix])
  const instructions = await db.getRangeAll(begin, end)

  if (verbose) {
    console.log(`Executing ${instructions.length} instructions from ${prefix.toString()}`)
  }

  for (const [, value] of instructions) {
    await machine.run(value, log)
    // TODO: consider inserting tiny sleeps to increase concurrency.
  }

  instructionsRun += instructions.length
}

/**
 * @param {Database} db
 * @param {Buffer} prefix
 * @param {import('fs').WriteStream} [log]
 * @returns {Promise<void>}
 */
async function runFromPrefix(db, prefix, log) {
  const thread = run(db, prefix, log)

  threads.add(thread)
  await thread
  threads.delete(thread)
}

process.on('unhandledRejection', /** @param {any} err */err => {
  console.log(chalk.redBright('✖'), 'Unhandled error in binding tester:\n', err.message, 'code', err.code, err.stack)

  throw err
})

const prefixStr = process.argv[2]
const requestedAPIVersion = +process.argv[3]
const clusterFile = process.argv[4]

// const log = fs.createWriteStream('nodetester.log')
const log = undefined

fdb.setAPIVersion(requestedAPIVersion)
fdb.configNetwork({
  // trace_enable: 'trace',
  trace_log_group: 'debug'
  // trace_format: 'json',
  // external_client_library: '~/3rdparty/foundationdb/lib/libfdb_c.dylib-debug',
})
const db = fdb.open(clusterFile)

runFromPrefix(db, Buffer.from(prefixStr, 'ascii'), log)

// Wait until all 'threads' are finished.
while (threads.size) {
  await Promise.all(Array.from(threads))
}

console.log(`${chalk.greenBright('✔')} Node binding tester complete. ${instructionsRun} commands executed`)
