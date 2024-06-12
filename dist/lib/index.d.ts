/// <reference types="node" />
import * as fdb from './native';
import Database from './database';
import { NetworkOptions, DatabaseOptions } from './opts.g';
import { Transformer } from './transformer';
import { DirectoryLayer } from './directory';
export { set as setAPIVersion } from './apiVersion';
export declare const modType = "napi";
export declare const stopNetworkSync: () => void;
export { default as FDBError } from './error';
export { default as keySelector, KeySelector } from './keySelector';
export { default as Database } from './database';
export { default as Transaction, Watch } from './transaction';
export { default as Subspace, root } from './subspace';
export { Directory, DirectoryLayer, DirectoryError } from './directory';
export { NetworkOptions, NetworkOptionCode, DatabaseOptions, DatabaseOptionCode, TransactionOptions, TransactionOptionCode, StreamingMode, MutationType, ConflictRangeType, ErrorPredicate, } from './opts.g';
export declare const util: {
    strInc: (val: string | Buffer) => Buffer;
};
import * as tuple from 'fdb-tuple';
import { TupleItem } from 'fdb-tuple';
export { TupleItem, tuple };
export declare const directory: DirectoryLayer;
export declare const encoders: {
    int32BE: Transformer<number, number>;
    json: Transformer<any, any>;
    string: Transformer<string, string>;
    buf: Transformer<Buffer, Buffer>;
    tuple: Transformer<tuple.TupleItem[], tuple.TupleItem[]>;
};
export declare function configNetwork(netOpts: NetworkOptions): void;
/**
 * Opens a database and returns it.
 *
 * Note any network configuration must happen before the database is opened.
 */
export declare function open(clusterFile?: string, dbOpts?: DatabaseOptions): Database<fdb.NativeValue, Buffer, fdb.NativeValue, Buffer>;
/** @deprecated This method will be removed in a future version. Call fdb.open() directly - it is syncronous too. */
export declare const openSync: typeof open;
/** @deprecated FDB clusters have been removed from the API. Call open() directly to connect. */
export declare const createCluster: (clusterFile?: string) => Promise<{
    openDatabase(dbName?: 'DB', opts?: DatabaseOptions): Promise<Database<fdb.NativeValue, Buffer, fdb.NativeValue, Buffer>>;
    openDatabaseSync(dbName?: 'DB', opts?: DatabaseOptions): Database<fdb.NativeValue, Buffer, fdb.NativeValue, Buffer>;
    close(): void;
}>;
/** @deprecated FDB clusters have been removed from the API. Call open() directly to connect. */
export declare const createClusterSync: (clusterFile?: string) => {
    openDatabase(dbName?: 'DB', opts?: DatabaseOptions): Promise<Database<fdb.NativeValue, Buffer, fdb.NativeValue, Buffer>>;
    openDatabaseSync(dbName?: 'DB', opts?: DatabaseOptions): Database<fdb.NativeValue, Buffer, fdb.NativeValue, Buffer>;
    close(): void;
};
