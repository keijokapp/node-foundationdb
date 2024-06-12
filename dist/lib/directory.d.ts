/// <reference types="node" />
import Transaction from "./transaction";
import { Database, tuple, TupleItem } from ".";
import { Transformer } from "./transformer";
import Subspace from "./subspace";
import { NativeValue } from "./native";
export declare class DirectoryError extends Error {
    constructor(description: string);
}
type DbAny = Database<any, any, any, any>;
type TxnAny = Transaction<any, any, any, any>;
type SubspaceAny = Subspace<any, any, any, any>;
type DbOrTxn<KeyIn, KeyOut, ValIn, ValOut> = Database<KeyIn, KeyOut, ValIn, ValOut> | Transaction<KeyIn, KeyOut, ValIn, ValOut>;
type TupleIn = undefined | TupleItem | TupleItem[];
/** Node subspaces have tuple keys like [SUBDIRS, (bytes)] and [b'layer']. */
type NodeSubspace = Subspace<TupleIn, TupleItem[], NativeValue, Buffer>;
export declare class HighContentionAllocator {
    counters: Subspace<TupleIn, TupleItem[], bigint, bigint>;
    recent: Subspace<TupleIn, TupleItem[], void, void>;
    constructor(subspace: SubspaceAny);
    _debugGetInternalState(dbOrTxn: DbAny | TxnAny): Promise<{
        counters: {
            start: tuple.TupleItem;
            count: bigint;
        };
        recent: tuple.TupleItem[];
    }>;
    allocate(_tn: TxnAny): Promise<Buffer>;
}
type PathIn = string | string[] | null | undefined;
type Path = string[];
export declare class Directory<KeyIn = NativeValue, KeyOut = Buffer, ValIn = NativeValue, ValOut = Buffer> {
    /** The full path of the directory from the root */
    _path: Path;
    _directoryLayer: DirectoryLayer;
    _layer: Buffer | null;
    content: Subspace<KeyIn, KeyOut, ValIn, ValOut>;
    _parentDirectoryLayer?: DirectoryLayer;
    constructor(parentDirectoryLayer: DirectoryLayer, path: Path, contentSubspace: Subspace<KeyIn, KeyOut, ValIn, ValOut>, isPartition: boolean, layer?: NativeValue);
    getSubspace(): Subspace<KeyIn, KeyOut, ValIn, ValOut>;
    createOrOpen(txnOrDb: TxnAny | DbAny, path: PathIn, layer?: 'partition' | NativeValue): Promise<Directory<any, any, any, any>>;
    open(txnOrDb: TxnAny | DbAny, path: PathIn, layer?: 'partition' | NativeValue): Promise<Directory<any, any, any, any>>;
    create(txnOrDb: TxnAny | DbAny, path: PathIn, layer?: 'partition' | NativeValue, prefix?: Buffer): Promise<Directory<any, any, any, any>>;
    list(txn: TxnAny, path?: PathIn): AsyncGenerator<Buffer, void, void>;
    listAll(txnOrDb: TxnAny | DbAny, path?: PathIn): Promise<Buffer[]>;
    move(txnOrDb: TxnAny | DbAny, oldPath: PathIn, newPath: PathIn): Promise<Directory<any, any, any, any>>;
    moveTo(txnOrDb: TxnAny | DbAny, _newAbsolutePath: PathIn): Promise<Directory<any, any, any, any>>;
    remove(txnOrDb: TxnAny | DbAny, path?: PathIn): Promise<boolean>;
    removeIfExists(txnOrDb: TxnAny | DbAny, path?: PathIn): Promise<boolean>;
    exists(txnOrDb: TxnAny | DbAny, path?: PathIn): Promise<boolean>;
    getLayer(): string | null;
    getLayerRaw(): Buffer | null;
    getPath(): Path;
    isPartition(): boolean;
    private _partitionSubpath;
    private getLayerForPath;
}
interface DirectoryLayerOpts {
    /** The prefix for directory metadata nodes. Defaults to '\xfe' */
    nodePrefix?: undefined | string | Buffer;
    nodeSubspace?: undefined | SubspaceAny;
    /** The prefix for content. Defaults to ''. */
    contentPrefix?: undefined | string | Buffer;
    contentSubspace?: undefined | SubspaceAny;
    allowManualPrefixes?: undefined | boolean;
}
export declare class DirectoryLayer {
    _nodeSubspace: NodeSubspace;
    _contentSubspace: Subspace<TupleIn, TupleItem[], any, any>;
    _allowManualPrefixes: boolean;
    _rootNode: NodeSubspace;
    _allocator: HighContentionAllocator;
    _path: Path;
    constructor(opts?: DirectoryLayerOpts);
    getPath(): Path;
    /**
     * Opens the directory with the given path.
     *
     * If the directory does not exist, it is created (creating parent directories
     * if necessary).
     *
     * If layer is specified, it is checked against the layer of an existing
     * directory or set as the layer of a new directory.
     */
    createOrOpen<KeyIn, KeyOut, ValIn, ValOut>(txnOrDb: DbOrTxn<KeyIn, KeyOut, ValIn, ValOut>, path: PathIn, layer?: 'partition' | NativeValue): Promise<Directory<KeyIn, KeyOut, ValIn, ValOut>>;
    private _createOrOpenInternal;
    /**
     * Opens the directory with the given path.
     *
     * An error is raised if the directory does not exist, or if a layer is
     * specified and a different layer was specified when the directory was
     * created.
     */
    open<KeyIn, KeyOut, ValIn, ValOut>(txnOrDb: DbOrTxn<KeyIn, KeyOut, ValIn, ValOut>, path: PathIn, layer?: 'partition' | NativeValue): Promise<Directory<KeyIn, KeyOut, ValIn, ValOut>>;
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
    create<KeyIn, KeyOut, ValIn, ValOut>(txnOrDb: DbOrTxn<KeyIn, KeyOut, ValIn, ValOut>, path: PathIn, layer?: 'partition' | NativeValue, prefix?: Buffer): Promise<Directory<KeyIn, KeyOut, ValIn, ValOut>>;
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
    move<KeyIn, KeyOut, ValIn, ValOut>(txnOrDb: DbOrTxn<KeyIn, KeyOut, ValIn, ValOut>, _oldPath: PathIn, _newPath: PathIn): Promise<Directory<KeyIn, KeyOut, ValIn, ValOut>>;
    /**
     * Removes the directory, its contents, and all subdirectories. Throws an
     * exception if the directory does not exist.
     *
     * Warning: Clients that have already opened the directory might still insert
     * data into its contents after it is removed.
     */
    remove(txnOrDb: TxnAny | DbAny, path: PathIn): Promise<boolean>;
    /**
     * Removes the directory, its contents, and all subdirectories, if it exists.
     * Returns true if the directory existed and false otherwise.
     *
     * Warning: Clients that have already opened the directory might still insert
     * data into its contents after it is removed.
     */
    removeIfExists(txnOrDb: TxnAny | DbAny, path: PathIn): Promise<boolean>;
    private _removeInternal;
    /**
     * Streams the names of the specified directory's subdirectories via a
     * generator.
     */
    list(txn: TxnAny, _path: PathIn): AsyncGenerator<Buffer, void, void>;
    /**
     * Returns the names of the specified directory's subdirectories as a list of
     * strings.
     */
    listAll(txnOrDb: TxnAny | DbAny, _path?: PathIn): Promise<Buffer[]>;
    /**
     * Returns whether or not the specified directory exists.
     */
    exists(txnOrDb: TxnAny | DbAny, _path?: PathIn): Promise<boolean>;
    private _nodeContainingKey;
    private _nodeWithPrefix;
    private getPrefixForNode;
    private contentSubspaceForNodeWithXF;
    private contentSubspaceForNode;
    private find;
    private findWithMeta;
    _contentsOfNode<KeyIn, KeyOut, ValIn, ValOut>(nodeSubspace: NodeSubspace, path: Path, layer: NativeValue | undefined, keyXf: Transformer<KeyIn, KeyOut>, valueXf: Transformer<ValIn, ValOut>): Directory<KeyIn, KeyOut, ValIn, ValOut>;
    private _checkVersion;
    private _subdirNamesAndNodes;
    private _subdirNamesAndNodesAll;
    private _removeFromParent;
    private _removeRecursive;
    private _isPrefixFree;
}
export {};
