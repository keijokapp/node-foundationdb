import { TupleItem } from 'fdb-tuple';
import Database from "./database";
import { tuple } from './encoders';
import Transaction from "./transaction";
import { Transformer, defaultTransformer } from "./transformer";
import { TransactionOptionCode } from "./opts.g";
import { concat2, startsWith, strInc, asBuf, emptyBuffer } from "./util";
import Subspace, { root } from "./subspace";
import { inspect } from "util";
import { NativeValue } from "./native";

export class DirectoryError extends Error {
  constructor(description: string) {
    super(description)

    Object.setPrototypeOf(this, DirectoryError.prototype);
  }
}

// The directory layer provides a way to use key subspaces without needing to
// make increasingly longer key prefixes over time.

// Every application should put its data inside a directory.

// For more information see the developer guide:
// https://apple.github.io/foundationdb/developer-guide.html#directories

// Or this great write-up of how and why the HCA allocator works:
// https://activesphere.com/blog/2018/08/05/high-contention-allocator

type DbAny = Database<any, any, any, any>
type TxnAny = Transaction<any, any, any, any>
type SubspaceAny = Subspace<any, any, any, any>

type DbOrTxn<KeyIn, KeyOut, ValIn, ValOut> = Database<KeyIn, KeyOut, ValIn, ValOut> | Transaction<KeyIn, KeyOut, ValIn, ValOut>

type TupleIn = undefined | TupleItem | TupleItem[]
/** Node subspaces have tuple keys like [SUBDIRS, (bytes)] and [b'layer']. */
type NodeSubspace = Subspace<TupleIn, TupleItem[], NativeValue, Buffer>

const arrStartsWith = <T>(arr: T[], prefix: T[]): boolean => {
  if (arr.length < prefix.length) return false
  for (let i = 0; i < prefix.length; i++) {
    if (arr[i] !== prefix[i]) return false
  }
  return true
}
const arrEq = <T>(x: T[], y: T[]): boolean => {
  if (x.length !== y.length) return false
  for (let i = 0; i < y.length; i++) {
    if (x[i] !== y[i]) return false
  }
  return true
}

// Wrapper for functions which take a database or a transaction.
const doTxn = <KeyIn, KeyOut, ValIn, ValOut, T>(
  dbOrTxn: Database<KeyIn, KeyOut, ValIn, ValOut> | Transaction<KeyIn, KeyOut, ValIn, ValOut>,
  body: (tn: Transaction<KeyIn, KeyOut, ValIn, ValOut>) => Promise<T>): Promise<T> => {

  return (dbOrTxn instanceof Database) ? dbOrTxn.doTn(body) : body(dbOrTxn)
}

const counterEncoding: Transformer<bigint, bigint> = {
  pack(val) {
    const b = Buffer.allocUnsafe(8)

    b.writeBigUInt64LE(val)

    return b
  },
  unpack: (buf) => {
    return buf.readBigUInt64LE()
  },
}

const voidEncoding: Transformer<void, void> = {
  pack(val) { return emptyBuffer },
  unpack(buf) { return null }
}

type Version = [number, number, number]
// I really wish I could just use python's pack here. This is <III written out
// in long form. (And counterEncoding above is <q). I could use a module like
// https://www.npmjs.com/package/python-struct , but it feels like overkill for
// this.
const versionEncoder: Transformer<Version, Version> = {
  pack(ver) {
    const buf = Buffer.allocUnsafe(12)
    buf.writeUInt32LE(ver[0], 0)
    buf.writeUInt32LE(ver[1], 4)
    buf.writeUInt32LE(ver[2], 8)
    return buf
  },
  unpack(buf) {
    return [buf.readUInt32LE(0), buf.readUInt32LE(4), buf.readUInt32LE(8)]
  }
}


const window_size = (start: number) => (
  // From the python bindings:
  //   Larger window sizes are better for high contention, smaller sizes for
  //   keeping the keys small.  But if there are many allocations, the keys
  //   can't be too small.  So start small and scale up.  We don't want this
  //   to ever get *too* big because we have to store about window_size/2
  //   recent items.
  start < 255 ? 64
    : (start < 65535) ? 1024
    : 8192
)

const hcaLock = new WeakMap<object, Promise<void>>()

async function synchronized(tn: TxnAny, block: () => Promise<void>) {
  // Nodejs is single threaded and the FDB transaction system protects us
  // against multiple concurrent transactions allocating using the HCA.
  // Unfortunately, we still need to protect against the case where a single
  // transaction initiates multiple concurrent calls into HCA (using
  // Promise.all / race or similar).

  // We're using tn._tn because that references the underlying fdb transaction
  // object, shared between all scoped versions of the transaction.
  const ref = tn.context

  const lock = hcaLock.get(ref)

  const nextStep = lock != null
    ? lock.then(block) // Run next
    : block() // Run now

  hcaLock.set(ref, nextStep)

  await nextStep

  // We're using a WeakMap so the GC *should* take care of this, but ...
  if (hcaLock.get(ref) === nextStep) hcaLock.delete(ref)
}

// Exported for testing.
export class HighContentionAllocator {
  counters: Subspace<TupleIn, TupleItem[], bigint, bigint>
  recent: Subspace<TupleIn, TupleItem[], void, void>

  constructor(subspace: SubspaceAny) {
    this.counters = subspace.withKeyEncoding(tuple).at(0).withValueEncoding(counterEncoding)
    this.recent = subspace.withKeyEncoding(tuple).at(1).withValueEncoding(voidEncoding)
  }

  async allocate(_tn: TxnAny): Promise<Buffer> {
    // Counters stores the number of allocations in each window.
    const counters = _tn.at(this.counters)
    // Recent marks all allocations inside the current window.
    const recent = _tn.at(this.recent)

    // This logic is a direct port of the equivalent code in the ruby bindings.
    while (true) {
      let [[start], count] = (await counters.snapshot().getRangeAllStartsWith(undefined, {limit: 1, reverse: true}))[0] as [[number], bigint]
        ?? [[0],0n]

      let window_advanced = false
      let window

      // 1. Consider growing the window if the count has changed the window size.
      while (true) {
        // TODO: I think we can narrow this synchronized block to the
        // window_advanced logic, but I'm not game to change it before we have
        // tests that can spot the bug. Maybe the binding tester can assess this
        // change.
        await synchronized(_tn, async () => {
          // This logic makes more sense at the bottom of the enclosing while
          // block, but its here so we don't need to do two synchronized blocks.
          if (window_advanced) {
            counters.clearRange([], start)
            recent.setOption(TransactionOptionCode.NextWriteNoWriteConflictRange)
            recent.clearRange([], start)
          }

          counters.add(start, 1n)
          count = (await counters.snapshot().get(start))!
          // console.log('incremented count to', count)
        })

        window = window_size(start)
        // Almost all the time, the window is a reasonable size and we break here.
        if (count * 2n < window) break

        // But if we've run out of room in the window (fill >= 50%), discard the
        // window and increment the window start by the window size.
        start += window
        window_advanced = true
      }

      // 2. Look for a candidate name we can allocate
      while (true) {
        let candidate = start + Math.floor(Math.random() * window)

        let latest_counter: any[]
        let candidate_in_use: boolean

        // Again, not sure if this synchronized block is needed.
        await synchronized(_tn, async () => {
          latest_counter = (await counters.snapshot().getRangeAllStartsWith(undefined, {limit: 1, reverse: true})).map(([k]) => k)
          candidate_in_use = await recent.exists(candidate)

          // Take ownership of the candidate key, but there's no need to retry
          // the whole txn if another allocation call has claimed it.
          recent.setOption(TransactionOptionCode.NextWriteNoWriteConflictRange)
          recent.set(candidate)
        })

        // If the window size changes concurrently while we're allocating, restart the whole process.
        if (latest_counter!.length > 0 && latest_counter![0] > start) break

        if (candidate_in_use! === false) {
          // Hooray! The candidate key isn't used by anyone else. Tag and bag! Marking it as a write conflict key stops
          recent.addWriteConflictKey(candidate)
          return tuple.pack(candidate)
        }
      }
    }
  }
}

const DEFAULT_NODE_PREFIX = Buffer.from([0xfe])
const HCA_PREFIX = Buffer.from('hca', 'ascii')
const VERSION_KEY = Buffer.from('version', 'ascii')
const LAYER_KEY = Buffer.from('layer', 'ascii')
const PARTITION_BUF = Buffer.from('partition', 'ascii') // I hate this.
const SUBDIRS_KEY = 0 // Why is this 0 when version / layers are byte strings? I have no idea. History, I assume.

const EXPECTED_VERSION: Version = [1, 0, 0]

type PathIn = string | string[] | null | undefined
type Path = string[]

// Clean up whatever junk the user gives us. I ordinarily wouldn't do this but
// its consistent with the python and ruby bindings.
const normalize_path = (path: PathIn): Path => {
  return path == null
    ? []
    : Array.isArray(path)
      ? path
      : [path]
}

// Ugh why is this called 'node'?? The word 'node' is used throughout this file
// interchangably to mean a 'Node' (instance of this node class) or a node in
// the directory graph, represented by a subspace element representing directory
// metadata inside the node_root subspace. Its super confusing.
//
// This class is also *awful*. It has 3 states:
// - The target doesn't exist - in which case subspace is null
// - The target exists but metadata (the layer) hasn't been loaded. subspace
//   exists but layer is null
// - The target exists and metadata has been loaded.
class Node {
  // Frankly, I don't think this deserves a class all of its own, but this whole
  // file is complex enough, so I'm going to stick to a pretty straight
  // reimplementation of the python / ruby code here.
  subspace: NodeSubspace | undefined
  path: Path
  target_path: Path
  // The layer should be defined as a string, but the binding tester insists on
  // testing this with binary buffers which are invalid inside a string, so
  // we'll use buffers internally and expose an API accepting either. Sigh.
  layer: Buffer | undefined // Filled in lazily. Careful - this will most often be empty.

  constructor(subspace: NodeSubspace | undefined, path: Path, targetPath: Path) {
    this.subspace = subspace
    this.path = path
    this.target_path = targetPath
  }

  exists(): boolean {
    return this.subspace != null
  }

  async prefetchMetadata(txn: TxnAny) {
    if (this.exists() && this.layer == null) await this.getLayer(txn)
    return this
  }

  async getLayer(txn?: TxnAny): Promise<Buffer> {
    if (this.layer == null) {
      // txn && console.log('key', txn!.at(this.subspace!).packKey(LAYER_KEY))
      // if (txn) console.log('xxx', (await txn.at(this.subspace!).get(LAYER_KEY)), this.path, this.target_path)

      // There's a semi-bug in the upstream code where layer won't be specified
      // on the root of the directory structure (thats the only directory which
      // has an implicit layer).
      //
      // What should the implicit layer be? The other bindings leave it as '',
      // even though its kinda a directory partition, so it probably should be
      // 'partition'.
      if (txn) this.layer = (await txn.at(this.subspace!).get(LAYER_KEY)) ?? emptyBuffer
      else throw new DirectoryError('Layer has not been read')
    }

    return this.layer
  }

  isInPartition(includeEmptySubpath: boolean = false) {
    return this.exists()
      && this.layer != null
      && this.layer.equals(PARTITION_BUF)
      && (includeEmptySubpath || this.target_path.length > this.path.length)
  }

  getPartitionSubpath() {
    return this.target_path.slice(this.path.length)
  }

  async getContents<KeyIn, KeyOut, ValIn, ValOut>(directoryLayer: DirectoryLayer, keyXf: Transformer<KeyIn, KeyOut>, valueXf: Transformer<ValIn, ValOut>, txn?: TxnAny) {
    return this.subspace != null
      ? directoryLayer._contentsOfNode(this.subspace, this.path, await this.getLayer(txn), keyXf, valueXf)
      : undefined;
  }

  getContentsSync<KeyIn, KeyOut, ValIn, ValOut>(directoryLayer: DirectoryLayer, keyXf: Transformer<any, any> = defaultTransformer, valueXf: Transformer<any, any> = defaultTransformer) {
    if (this.layer == null) throw new DirectoryError('Node metadata has not been fetched.')

    return this.subspace != null
      ? directoryLayer._contentsOfNode(this.subspace, this.path, this.layer, keyXf, valueXf)
      : undefined
  }
}


// A directory is either a 'normal' directory or a directory partition.
// Partitions contain a separate directory layer inline into which the children
// are allocated.
// More on partitions: https://apple.github.io/foundationdb/developer-guide.html#directory-partitions
export class Directory<KeyIn = NativeValue, KeyOut = Buffer, ValIn = NativeValue, ValOut = Buffer> {
  /** The full path of the directory from the root */
  _path: Path

  _directoryLayer: DirectoryLayer
  _layer: Buffer | undefined
  content: Subspace<KeyIn, KeyOut, ValIn, ValOut>

  // If the directory is a partition, it also has a reference to the parent subspace.
  _parentDirectoryLayer?: DirectoryLayer

  constructor(parentDirectoryLayer: DirectoryLayer, path: Path, contentSubspace: Subspace<KeyIn, KeyOut, ValIn, ValOut>, isPartition: boolean, layer?: NativeValue) {
    this._path = path
    this.content = contentSubspace

    if (isPartition) {
      if (layer != null) throw new DirectoryError('Directory partitions cannot specify a layer.')

      // In partitions, the passed directory layer is the parent directory
      // layer. We create our own internally inside the partition.
      const directoryLayer = new DirectoryLayer({
        nodeSubspace: contentSubspace.atRaw(DEFAULT_NODE_PREFIX).withKeyEncoding(tuple).withValueEncoding(defaultTransformer),
        contentSubspace: contentSubspace,
      })
      directoryLayer._path = path

      this._layer = PARTITION_BUF

      this._directoryLayer = directoryLayer
      this._parentDirectoryLayer = parentDirectoryLayer
    } else {
      this._layer = layer != null ? asBuf(layer) : undefined
      this._directoryLayer = parentDirectoryLayer
      // this._parentDirectoryLayer is left as undefined for normal directories.
    }
  }

  getSubspace() {
    // Soooo I'm not entirely sure this is the right behaviour. The partition
    // itself should be read-only - that is, you shouldn't be inserting your own
    // children inside the directory partition. That said, one of the uses of a
    // directory partition is in being able to do a single range query to fetch
    // all children - and by refusing to return a subspace here we're making it
    // hard to run those queries.
    //
    // Refusing getSubspace() calls on directory partitions is the safe option
    // here from an API standpoint. I'll consider relaxing this constraint if
    // people complain about it.
    if (this.isPartition()) throw new DirectoryError('Cannot use a directory partition as a subspace.')
    else return this.content
  }

  // TODO: Add withKeyEncoding / withValueEncoding here.

  createOrOpen(txnOrDb: TxnAny | DbAny, path: PathIn, layer?: 'partition' | NativeValue) { // partition specified for autocomplete.
    return this._directoryLayer.createOrOpen(txnOrDb, this._partitionSubpath(path), layer)
  }

  open(txnOrDb: TxnAny | DbAny, path: PathIn, layer?: 'partition' | NativeValue) {
    return this._directoryLayer.open(txnOrDb, this._partitionSubpath(path), layer)
  }

  create(txnOrDb: TxnAny | DbAny, path: PathIn, layer?: 'partition' | NativeValue, prefix?: Buffer) {
    return this._directoryLayer.create(txnOrDb, this._partitionSubpath(path), layer, prefix)
  }

  async *list(txn: TxnAny, path: PathIn = []) {
    yield *this._directoryLayer.list(txn, this._partitionSubpath(path))
  }

  listAll(txnOrDb: TxnAny | DbAny, path: PathIn = []): Promise<Buffer[]> {
    return this._directoryLayer.listAll(txnOrDb, this._partitionSubpath(path))
  }

  move(txnOrDb: TxnAny | DbAny, oldPath: PathIn, newPath: PathIn) {
    return this._directoryLayer.move(txnOrDb, this._partitionSubpath(oldPath), this._partitionSubpath(newPath))
  }

  moveTo(txnOrDb: TxnAny | DbAny, _newAbsolutePath: PathIn) {
    const directoryLayer = this.getLayerForPath([])
    const newAbsolutePath = normalize_path(_newAbsolutePath)
    const partition_len = directoryLayer._path.length
    const partition_path = newAbsolutePath.slice(0, partition_len)
    if (!arrEq(partition_path, directoryLayer._path)) throw new DirectoryError('Cannot move between partitions.')

    return directoryLayer.move(txnOrDb, this._path.slice(partition_len), newAbsolutePath.slice(partition_len))
  }

  remove(txnOrDb: TxnAny | DbAny, path?: PathIn) {
    const layer = this.getLayerForPath(path)
    return layer.remove(txnOrDb, this._partitionSubpath(path, layer))
  }

  async removeIfExists(txnOrDb: TxnAny | DbAny, path?: PathIn) {
    const layer = this.getLayerForPath(path)
    return layer.removeIfExists(txnOrDb, this._partitionSubpath(path, layer))
  }

  exists(txnOrDb: TxnAny | DbAny, path?: PathIn): Promise<boolean> {
    const layer = this.getLayerForPath(path)
    return layer.exists(txnOrDb, this._partitionSubpath(path, layer))
  }


  getLayer() {
    // will be 'partition' for partitions.
    return this._layer?.toString()
  }

  getLayerRaw() {
    return this._layer
  }

  getPath() {
    return this._path
  }

  isPartition() {
    return this._parentDirectoryLayer != null
  }

  private _partitionSubpath(path: PathIn, directoryLayer: DirectoryLayer = this._directoryLayer) {
    return this._path.slice(directoryLayer._path.length).concat(normalize_path(path))
  }

  private getLayerForPath(path: PathIn): DirectoryLayer {
    return this.isPartition()
      ? normalize_path(path).length === 0
        ? this._parentDirectoryLayer!
        : this._directoryLayer
      : this._directoryLayer
  }
}

interface DirectoryLayerOpts {
  /** The prefix for directory metadata nodes. Defaults to '\xfe' */
  nodePrefix?: undefined | string | Buffer
  // We really actually want a NodeSubspace here, but we'll set the kv encoding
  // ourselves to make the API simpler.
  nodeSubspace?: undefined | SubspaceAny

  /** The prefix for content. Defaults to ''. */
  contentPrefix?: undefined | string | Buffer // Defaults to '', the root.
  contentSubspace?: undefined | SubspaceAny

  allowManualPrefixes?: undefined | boolean // default false
}

export class DirectoryLayer {
  _nodeSubspace: NodeSubspace
  _contentSubspace: Subspace<TupleIn, TupleItem[], any, any>
  _allowManualPrefixes: boolean

  _rootNode: NodeSubspace

  _allocator: HighContentionAllocator

  _path: Path

  constructor(opts: DirectoryLayerOpts = {}) {
    // By default, metadata for the nodes & allocator lives at the 0xfe prefix.
    // The root of the database has the values themselves, using the allocation
    // number as the prefix. Note that 0xfe (the default node prefix) is intentionally
    // an invalid tuple.

    this._nodeSubspace = opts.nodeSubspace != null
      ? opts.nodeSubspace.withKeyEncoding(tuple)
      : new Subspace(opts.nodePrefix ?? DEFAULT_NODE_PREFIX, tuple, defaultTransformer)

    this._contentSubspace = opts.contentSubspace != null
      ? opts.contentSubspace.withKeyEncoding(tuple)
      : new Subspace(opts.contentPrefix ?? emptyBuffer, tuple, defaultTransformer)

    this._allowManualPrefixes = opts.allowManualPrefixes ?? false

    this._rootNode = this._nodeSubspace.at(this._nodeSubspace.prefix)
    this._allocator = new HighContentionAllocator(this._rootNode.at(HCA_PREFIX))

    // When the directory layer is actually a partition, this is overwritten.
    this._path = []
  }

  getPath() { return this._path }

  /**
   * Opens the directory with the given path.
   *
   * If the directory does not exist, it is created (creating parent directories
   * if necessary).
   *
   * If layer is specified, it is checked against the layer of an existing
   * directory or set as the layer of a new directory.
   */
  createOrOpen<KeyIn, KeyOut, ValIn, ValOut>(txnOrDb: DbOrTxn<KeyIn, KeyOut, ValIn, ValOut>, path: PathIn, layer?: 'partition' | NativeValue): Promise<Directory<KeyIn, KeyOut, ValIn, ValOut>> {
    return this._createOrOpenInternal(txnOrDb, path, layer)
  }

  private async _createOrOpenInternal<KeyIn, KeyOut, ValIn, ValOut>(txnOrDb: TxnAny | DbAny, _path: PathIn, layer: NativeValue = emptyBuffer, reqPrefix?: Buffer, allowCreate: boolean = true, allowOpen: boolean = true): Promise<Directory<KeyIn, KeyOut, ValIn, ValOut>> {
    const path = normalize_path(_path)
    // For layers, an empty string is treated the same as a missing layer property.
    const layerBuf = asBuf(layer)
    const {keyXf, valueXf} = txnOrDb.subspace

    if (reqPrefix != null && !this._allowManualPrefixes) {
      if (path.length === 0) throw new DirectoryError('Cannot specify a prefix unless manual prefixes are enabled.')
      else throw new DirectoryError('Cannot specify a prefix in a partition.')
    }

    if (path.length === 0) throw new DirectoryError('The root directory cannot be opened.')

    return doTxn(txnOrDb, async txn => {
      await this._checkVersion(txn, false)

      const existing_node = await this.findWithMeta(txn, path)
      if (existing_node.exists()) {
        // The directory exists. Open it!
        if (existing_node.isInPartition()) {
          const subpath = existing_node.getPartitionSubpath()
          // This is pretty ugly. We're only using the existing node's directory layer. Better to
          // just create that child directory layer directly or something.
          return await existing_node.getContentsSync(this)!._directoryLayer._createOrOpenInternal(
            txn, subpath, layer, reqPrefix, allowCreate, allowOpen
          )
        } else {
          if (!allowOpen) throw new DirectoryError('The directory already exists.')
          if (layerBuf.length && !existing_node.layer!.equals(layerBuf)) throw new DirectoryError('The directory was created with an incompatible layer.')

          return existing_node.getContentsSync(this, keyXf, valueXf)!
        }

      } else {
        // The directory does not exist. Create it!
        if (!allowCreate) throw new DirectoryError('The directory does not exist.')
        await this._checkVersion(txn, true)

        // We need to preserve the passed in prefix argument so if the prefix is null and we
        // generate a txn conflict, we generate a new prefix in the next retry attempt.
        let actualPrefix
        if (reqPrefix == null) {
          actualPrefix = concat2(this._contentSubspace.prefix, await this._allocator.allocate(txn))
          if ((await txn.at(root).getRangeAllStartsWith(actualPrefix, {limit: 1})).length > 0) {
            throw new DirectoryError('The database has keys stored at the prefix chosen by the automatic prefix allocator: ' + inspect(actualPrefix))
          }

          if (!await this._isPrefixFree(txn.snapshot(), actualPrefix)) {
            throw new DirectoryError('The directory layer has manually allocated prefixes that conflict with the automatic prefix allocator.')
          }
        } else {
          if (!await this._isPrefixFree(txn, reqPrefix)) {
            throw new DirectoryError('The given prefix is already in use.')
          }
          actualPrefix = reqPrefix
        }

        const parentNode = path.length > 1
          ? this._nodeWithPrefix((await this._createOrOpenInternal(txn, path.slice(0, -1))).content.prefix)
          : this._rootNode

        if (parentNode == null) throw new DirectoryError('The parent directory does not exist.')

        const node = this._nodeWithPrefix(actualPrefix)
        // Write metadata
        txn.at(parentNode).set([SUBDIRS_KEY, path[path.length - 1]], actualPrefix)
        txn.at(node).set(LAYER_KEY, layerBuf)

        return this._contentsOfNode(node, path, layerBuf, keyXf, valueXf)
      }
    })
  }

  /**
   * Opens the directory with the given path.
   *
   * An error is raised if the directory does not exist, or if a layer is
   * specified and a different layer was specified when the directory was
   * created.
   */
  open<KeyIn, KeyOut, ValIn, ValOut>(txnOrDb: DbOrTxn<KeyIn, KeyOut, ValIn, ValOut>, path: PathIn, layer: 'partition' | NativeValue = emptyBuffer): Promise<Directory<KeyIn, KeyOut, ValIn, ValOut>> {
    return this._createOrOpenInternal(txnOrDb, path, layer, undefined, false, true)
  }

  /**
   * Creates a directory with the given path (creating parent directories if
   * necessary).
   *
   * An error is raised if the given directory already exists.
   *
   * If prefix is specified, the directory is created with the given physical
   * prefix; otherwise a prefix is allocated automatically.
   *
   * If layer is specified, it is recorded with the directory and will be
   * checked by future calls to open.
   */
  create<KeyIn, KeyOut, ValIn, ValOut>(txnOrDb: DbOrTxn<KeyIn, KeyOut, ValIn, ValOut>, path: PathIn, layer: 'partition' | NativeValue = emptyBuffer, prefix?: Buffer): Promise<Directory<KeyIn, KeyOut, ValIn, ValOut>> {
    return this._createOrOpenInternal(txnOrDb, path, layer, prefix, true, false)
  }

  /**
   * Moves the directory found at `old_path` to `new_path`.
   *
   * There is no effect on the physical prefix of the given directory, or on
   * clients that already have the directory open.
   *
   * An error is raised if the old directory does not exist, a directory already
   * exists at `new_path`, or the parent directory of `new_path` does not exist.
   *
   * This funtion returns the new directory. The old directory should no longer
   * be used.
   */
  move<KeyIn, KeyOut, ValIn, ValOut>(txnOrDb: DbOrTxn<KeyIn, KeyOut, ValIn, ValOut>, _oldPath: PathIn, _newPath: PathIn): Promise<Directory<KeyIn, KeyOut, ValIn, ValOut>> {
    const oldPath = normalize_path(_oldPath)
    const newPath = normalize_path(_newPath)

    return doTxn(txnOrDb, async txn => {
      // Ideally this call should only write the version information to the
      // database after performing the other checks, to make sure the input here
      // is valid. But that would be inconsistent with the other bindings, and
      // it matters because that inconsistency causes the binding tester to
      // fail: https://github.com/apple/foundationdb/issues/2925
      await this._checkVersion(txn, true)

      if (arrStartsWith(newPath, oldPath)) {
        throw new DirectoryError('The destination directory cannot be a subdirectory of the source directory.')
      }
      const oldNode = await this.findWithMeta(txn, oldPath)
      const newNode = await this.findWithMeta(txn, newPath)

      if (!oldNode.exists()) throw new DirectoryError('The source directory does not exist.')

      if (oldNode.isInPartition() || newNode.isInPartition()) {
        // This is allowed if and only if we're moving between two paths within the same partition.
        if (!oldNode.isInPartition() || !newNode.isInPartition() || !arrEq(oldNode.path, newNode.path)) {
          throw new DirectoryError('Cannot move between partitions.')
        }

        // Delegate to the partition.
        return newNode.getContentsSync(this)!.move(txn, oldNode.getPartitionSubpath(), newNode.getPartitionSubpath())
      }

      if (newNode.exists()) throw new DirectoryError('The destination directory already exists. Remove it first.')

      const parentNode = await this.find(txn, newPath.slice(0, -1))
      if (!parentNode.exists()) throw new DirectoryError('The parent of the destination directory does not exist. Create it first.')

      // Ok actually move.
      const oldPrefix = this.getPrefixForNode(oldNode.subspace!)
      txn.at(parentNode.subspace!).set([SUBDIRS_KEY, newPath[newPath.length - 1]], oldPrefix)
      await this._removeFromParent(txn, oldPath)

      // We return a Directory here. Its kind of arbitrary - but I'll use the KV transformers from
      // the transaction for the new directory. Not perfect, but should be fine
      const {keyXf, valueXf} = txnOrDb.subspace
      return this._contentsOfNode(oldNode.subspace!, newPath, oldNode.layer!, keyXf, valueXf)
    })
  }

  /**
   * Removes the directory, its contents, and all subdirectories. Throws an
   * exception if the directory does not exist.
   *
   * Warning: Clients that have already opened the directory might still insert
   * data into its contents after it is removed.
   */
  remove(txnOrDb: TxnAny | DbAny, path: PathIn) {
    return this._removeInternal(txnOrDb, path, true)
  }

  /**
   * Removes the directory, its contents, and all subdirectories, if it exists.
   * Returns true if the directory existed and false otherwise.
   *
   * Warning: Clients that have already opened the directory might still insert
   * data into its contents after it is removed.
   */
  removeIfExists(txnOrDb: TxnAny | DbAny, path: PathIn) {
    return this._removeInternal(txnOrDb, path, false)
  }

  private _removeInternal(txnOrDb: TxnAny | DbAny, _path: PathIn, failOnNonexistent: boolean): Promise<boolean> {
    const path = normalize_path(_path)

    return doTxn(txnOrDb, async txn => {
      await this._checkVersion(txn, true)

      if (path.length === 0) throw new DirectoryError('The root directory cannot be removed.')

      const node = await this.findWithMeta(txn, path)

      if (!node.exists()) {
        if (failOnNonexistent) throw new DirectoryError('The directory does not exist.')
        else return false
      }

      if (node.isInPartition()) {
        return await node.getContentsSync(this)!
          ._directoryLayer
          ._removeInternal(txn, node.getPartitionSubpath(), failOnNonexistent)
      }

      await this._removeRecursive(txn, node.subspace!)
      await this._removeFromParent(txn, path)
      return true
    })
  }

  /**
   * Streams the names of the specified directory's subdirectories via a
   * generator.
   */
  async *list(txn: TxnAny, _path: PathIn): AsyncGenerator<Buffer, void, void> {
    await this._checkVersion(txn, false)

    const path = normalize_path(_path)
    const node = await this.findWithMeta(txn, path)
    if (!node.exists()) throw new DirectoryError('The directory does not exist.')

    if (node.isInPartition(true)) {
      yield* node.getContentsSync(this)!
        .list(txn, node.getPartitionSubpath())
    } else {
      for await (const [name] of this._subdirNamesAndNodes(txn, node.subspace!)) {
        yield name
      }
    }
  }

  /**
   * Returns the names of the specified directory's subdirectories as a list of
   * strings.
   */
  listAll(txnOrDb: TxnAny | DbAny, _path: PathIn = []): Promise<Buffer[]> {
    return doTxn(txnOrDb, async txn => {
      const results = []
      for await (const path of this.list(txn, _path)) results.push(path)
      return results
    })
  }

  /**
   * Returns whether or not the specified directory exists.
   */
  async exists(txnOrDb: TxnAny | DbAny, _path: PathIn = []): Promise<boolean> {
    return doTxn(txnOrDb, async txn => {
      await this._checkVersion(txn, false)

      const path = normalize_path(_path)
      const node = await this.findWithMeta(txn, path)

      if (!node.exists()) return false
      else if (node.isInPartition()) return node.getContentsSync(this)!.exists(txn, node.getPartitionSubpath())
      else return true
    })
  }


  private async _nodeContainingKey(txn: TxnAny, key: Buffer) {
    // This is a straight port of the equivalent function in the ruby / python
    // bindings.

    // Check if the key is actually *in* the node subspace
    if (startsWith(key, this._nodeSubspace.prefix)) return this._rootNode

    // .. check for any nodes in nodeSubspace which have the same name as key.
    // Note the null here is used because null is encoded as Buffer<00>, which
    // preserves the behaviour from the other bindings.
    const [prev] = await txn.at(this._nodeSubspace).getRangeAll(null, [key, null], {reverse: true, limit: 1})
    if (prev) {
      const [k] = prev
      const prev_prefix = k[0] as Buffer
      if (startsWith(key, prev_prefix)) return this._nodeWithPrefix(prev_prefix)
    }
  }

  private _nodeWithPrefix(prefix: Buffer): NodeSubspace {
    return this._nodeSubspace.at(prefix)
  }

  private getPrefixForNode(node: NodeSubspace) {
    // This is some black magic. We have a reference to the node's subspace, but
    // what we really want is the prefix. So we want to do the inverse to
    // this._nodeSubspace.at(...).
    return this._nodeSubspace._bakedKeyXf.unpack(node.prefix)[0] as Buffer
  }

  private contentSubspaceForNodeWithXF<KeyIn, KeyOut, ValIn, ValOut>(node: NodeSubspace, keyXf: Transformer<KeyIn, KeyOut>, valueXf: Transformer<ValIn, ValOut>) {
    return new Subspace(this.getPrefixForNode(node), keyXf, valueXf)
  }

  private contentSubspaceForNode(node: NodeSubspace) {
    return this.contentSubspaceForNodeWithXF(node, defaultTransformer, defaultTransformer)
  }

  private async find(txn: TxnAny, path: Path) {
    let node = new Node(this._rootNode, [], path)

    for (let i = 0; i < path.length; i++) {
      const ref = await txn.at(node.subspace!).get([SUBDIRS_KEY, path[i]])
      node = new Node(ref != null ? this._nodeSubspace.at(ref) : undefined, path.slice(0, i+1), path)

      if (ref == null || (await node.getLayer(txn)).equals(PARTITION_BUF)) break
    }

    return node
  }

  private async findWithMeta(txn: TxnAny, target_path: Path) {
    const node = await this.find(txn, target_path)
    await node.prefetchMetadata(txn)
    return node
  }

  _contentsOfNode<KeyIn, KeyOut, ValIn, ValOut>(nodeSubspace: NodeSubspace, path: Path, layer: NativeValue = emptyBuffer, keyXf: Transformer<KeyIn, KeyOut>, valueXf: Transformer<ValIn, ValOut>): Directory<KeyIn, KeyOut, ValIn, ValOut> {
    // This is some black magic. We have a reference to the node's subspace, but
    // what we really want is the prefix. So we want to do the inverse to
    // this._nodeSubspace.at(...).
    const contentSubspace = this.contentSubspaceForNodeWithXF(nodeSubspace, keyXf, valueXf)

    const layerBuf = asBuf(layer)
    if (layerBuf.equals(PARTITION_BUF)) {
      return new Directory(this, this._path.concat(path), contentSubspace, true)
    } else {
      // We concat the path because even though the child might not be a partition, we might be.
      return new Directory(this, this._path.concat(path), contentSubspace, false, layerBuf)
    }
  }

  private async _checkVersion(_tn: TxnAny, writeAccess: boolean) {
    const tn = _tn.at(this._rootNode)
    const actualRaw = await tn.get(VERSION_KEY)

    if (actualRaw == null) {
      if (writeAccess) tn.set(VERSION_KEY, versionEncoder.pack(EXPECTED_VERSION))
    } else {
      // Check the version matches the version of this directory implementation.
      const actualVersion = versionEncoder.unpack(actualRaw)

      if (actualVersion[0] > EXPECTED_VERSION[0]) {
        throw new DirectoryError(`Cannot load directory with version ${actualVersion.join('.')} using directory layer ${EXPECTED_VERSION.join('.')}`)
      } else if (actualVersion[1] > EXPECTED_VERSION[1] && writeAccess) {
        throw new DirectoryError(`Directory with version ${actualVersion.join('.')} is read-only when opened using directory layer ${EXPECTED_VERSION.join('.')}`)
      }
    }
  }

  private async* _subdirNamesAndNodes(txn: TxnAny, node: NodeSubspace) {
    for await (const [key, prefix] of txn.at(node).getRangeStartsWith(SUBDIRS_KEY)) {
      yield [key[1], this._nodeWithPrefix(prefix)] as [Buffer, NodeSubspace]
    }
  }

  private async _removeFromParent(txn: TxnAny, path: Path) {
    const parent = await this.find(txn, path.slice(0, -1))
    txn.at(parent.subspace!).clear([SUBDIRS_KEY, path[path.length - 1]])
  }

  private async _removeRecursive(txn: TxnAny, node: NodeSubspace) {
    for await (const [, subnode] of this._subdirNamesAndNodes(txn, node)) {
      await this._removeRecursive(txn, subnode)
    }

    // Clear content
    txn.at(this.contentSubspaceForNode(node)).clearRangeStartsWith(emptyBuffer)

    // Clear metadata
    txn.at(node).clearRangeStartsWith(undefined)
  }

  private async _isPrefixFree(txn: TxnAny, prefix: Buffer) {
    // Returns true if the given prefix does not "intersect" any currently
    // allocated prefix (including the root node). This means that it neither
    // contains any other prefix nor is contained by any other prefix.
    return prefix.length > 0
      && await this._nodeContainingKey(txn, prefix) == null
      && (await txn.at(this._nodeSubspace).getRangeAll(prefix, strInc(prefix), {limit: 1})).length === 0
  }
}
