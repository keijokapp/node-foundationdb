/// <reference types="node" />
import FDBError from './error';
import { MutationType, StreamingMode } from './opts.g';
export type NativeValue = string | Buffer;
export type Callback<T> = (err: FDBError | null, results?: T) => void;
export type KVList = {
    results: [Buffer, Buffer][];
    more: boolean;
};
export type Watch = {
    cancel(): void;
    promise: Promise<boolean>;
};
export type Version = Buffer;
export interface NativeTransaction {
    setOption(code: number, param: string | number | Buffer | null): void;
    commit(): Promise<void>;
    commit(cb: Callback<void>): void;
    reset(): void;
    cancel(): void;
    onError(code: number, cb: Callback<void>): void;
    onError(code: number): Promise<void>;
    getApproximateSize(): Promise<number>;
    get(key: NativeValue, isSnapshot: boolean): Promise<Buffer | undefined>;
    get(key: NativeValue, isSnapshot: boolean, cb: Callback<Buffer | undefined>): void;
    getKey(key: NativeValue, orEqual: boolean, offset: number, isSnapshot: boolean): Promise<Buffer>;
    getKey(key: NativeValue, orEqual: boolean, offset: number, isSnapshot: boolean, cb: Callback<Buffer>): void;
    set(key: NativeValue, val: NativeValue): void;
    clear(key: NativeValue): void;
    atomicOp(opType: MutationType, key: NativeValue, operand: NativeValue): void;
    getRange(start: NativeValue, beginOrEq: boolean, beginOffset: number, end: NativeValue, endOrEq: boolean, endOffset: number, limit: number, target_bytes: number, mode: StreamingMode, iter: number, isSnapshot: boolean, reverse: boolean): Promise<KVList>;
    getRange(start: NativeValue, beginOrEq: boolean, beginOffset: number, end: NativeValue, endOrEq: boolean, endOffset: number, limit: number, target_bytes: number, mode: StreamingMode, iter: number, isSnapshot: boolean, reverse: boolean, cb: Callback<KVList>): void;
    clearRange(start: NativeValue, end: NativeValue): void;
    getEstimatedRangeSizeBytes(start: NativeValue, end: NativeValue): Promise<number>;
    getRangeSplitPoints(start: NativeValue, end: NativeValue, chunkSize: number): Promise<Buffer[]>;
    watch(key: NativeValue, ignoreStandardErrs: boolean): Watch;
    addReadConflictRange(start: NativeValue, end: NativeValue): void;
    addWriteConflictRange(start: NativeValue, end: NativeValue): void;
    setReadVersion(v: Version): void;
    getReadVersion(): Promise<Version>;
    getReadVersion(cb: Callback<Version>): void;
    getCommittedVersion(): Version;
    getVersionstamp(): Promise<Buffer>;
    getVersionstamp(cb: Callback<Buffer>): void;
    getAddressesForKey(key: NativeValue): string[];
}
export interface NativeDatabase {
    createTransaction(): NativeTransaction;
    setOption(code: number, param: string | number | Buffer | null): void;
    close(): void;
}
export declare enum ErrorPredicate {
    Retryable = 50000,
    MaybeCommitted = 50001,
    RetryableNotCommitted = 50002
}
export interface NativeModule {
    setAPIVersion(v: number): void;
    setAPIVersionImpl(v: number, h: number): void;
    startNetwork(): void;
    stopNetwork(): void;
    createDatabase(clusterFile?: string): NativeDatabase;
    setNetworkOption(code: number, param: string | number | Buffer | null): void;
    errorPredicate(test: ErrorPredicate, code: number): boolean;
}
export declare const type = "napi";
declare const _default: NativeModule;
export default _default;
