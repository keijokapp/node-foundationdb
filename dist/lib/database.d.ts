/// <reference types="node" />
import * as fdb from './native';
import Transaction, { RangeOptions, Watch } from './transaction';
import { Transformer } from './transformer';
import { NativeValue } from './native';
import { KeySelector } from './keySelector';
import Subspace, { GetSubspace } from './subspace';
import { DatabaseOptions, TransactionOptions, MutationType } from './opts.g';
export type WatchWithValue<Value> = Watch & {
    value: Value | undefined;
};
export default class Database<KeyIn = NativeValue, KeyOut = Buffer, ValIn = NativeValue, ValOut = Buffer> {
    _db: fdb.NativeDatabase;
    subspace: Subspace<KeyIn, KeyOut, ValIn, ValOut>;
    constructor(db: fdb.NativeDatabase, subspace: Subspace<KeyIn, KeyOut, ValIn, ValOut>);
    /**
     * Switch to a new mode of handling ranges.
     *
     * @see Subspace.noDefaultPrefix
     */
    noDefaultPrefix(): Database<KeyIn, KeyOut, ValIn, ValOut>;
    setNativeOptions(opts: DatabaseOptions): void;
    close(): void;
    getRoot(): Database;
    getSubspace(): Subspace<KeyIn, KeyOut, ValIn, ValOut>;
    getPrefix(): Buffer;
    /** Create a shallow reference to the database at a specified subspace */
    at<CKI, CKO, CVI, CVO>(hasSubspace: GetSubspace<CKI, CKO, CVI, CVO>): Database<CKI, CKO, CVI, CVO>;
    at(prefix?: KeyIn | null, keyXf?: undefined, valueXf?: undefined): Database<KeyIn, KeyOut, ValIn, ValOut>;
    at<CKI, CKO>(prefix: KeyIn | null | undefined, keyXf: Transformer<CKI, CKO>, valueXf?: undefined): Database<CKI, CKO, ValIn, ValOut>;
    at<CVI, CVO>(prefix: KeyIn | null | undefined, keyXf: undefined, valueXf: Transformer<CVI, CVO>): Database<KeyIn, KeyOut, CVI, CVO>;
    at<CKI, CKO, CVI, CVO>(prefix: KeyIn | null | undefined, keyXf: Transformer<CKI, CKO>, valueXf: Transformer<CVI, CVO>): Database<CKI, CKO, CVI, CVO>;
    at<CKI, CKO>(prefix: KeyIn | null | undefined, keyXf?: Transformer<CKI, CKO>, valueXf?: undefined): Database<KeyIn, KeyOut, ValIn, ValOut> | Database<CKI, CKO, ValIn, ValOut>;
    at<CVI, CVO>(prefix: KeyIn | null | undefined, keyXf: undefined, valueXf?: Transformer<CVI, CVO>): Database<KeyIn, KeyOut, ValIn, ValOut> | Database<KeyIn, KeyOut, CVI, CVO>;
    at<CKI, CKO, CVI, CVO>(prefix: KeyIn | null | undefined, keyXf: Transformer<CKI, CKO> | undefined, valueXf: Transformer<CVI, CVO>): Database<KeyIn, KeyOut, CVI, CVO> | Database<CKI, CKO, CVI, CVO>;
    at<CKI, CKO, CVI, CVO>(prefix: KeyIn | null | undefined, keyXf: Transformer<CKI, CKO>, valueXf?: Transformer<CVI, CVO>): Database<CKI, CKO, ValIn, ValOut> | Database<CKI, CKO, CVI, CVO>;
    at<CKI, CKO, CVI, CVO>(prefix?: KeyIn | null, keyXf?: Transformer<CKI, CKO>, valueXf?: Transformer<CVI, CVO>): Database<KeyIn, KeyOut, ValIn, ValOut> | Database<CKI, CKO, ValIn, ValOut> | Database<KeyIn, KeyOut, CVI, CVO> | Database<CKI, CKO, CVI, CVO>;
    withKeyEncoding(keyXf?: undefined): Database<NativeValue, Buffer, ValIn, ValOut>;
    withKeyEncoding<CKI, CKO>(keyXf: Transformer<CKI, CKO>): Database<CKI, CKO, ValIn, ValOut>;
    withKeyEncoding<CKI, CKO>(keyXf?: Transformer<CKI, CKO>): Database<NativeValue, Buffer, ValIn, ValOut> | Database<CKI, CKO, ValIn, ValOut>;
    withValueEncoding(valueXf?: undefined): Database<KeyIn, KeyOut, NativeValue, Buffer>;
    withValueEncoding<CVI, CVO>(valueXf: Transformer<CVI, CVO>): Database<KeyIn, KeyOut, CVI, CVO>;
    withValueEncoding<CVI, CVO>(valueXf?: Transformer<CVI, CVO>): Database<KeyIn, KeyOut, NativeValue, Buffer> | Database<KeyIn, KeyOut, CVI, CVO>;
    doTn<T>(body: (tn: Transaction<KeyIn, KeyOut, ValIn, ValOut>) => Promise<T>, opts?: TransactionOptions): Promise<T>;
    doTransaction<T>(body: (tn: Transaction<KeyIn, KeyOut, ValIn, ValOut>) => Promise<T>, opts?: TransactionOptions): Promise<T>;
    doOneshot(body: (tn: Transaction<KeyIn, KeyOut, ValIn, ValOut>) => void, opts?: TransactionOptions): Promise<void>;
    rawCreateTransaction(opts?: TransactionOptions): Transaction<KeyIn, KeyOut, ValIn, ValOut>;
    get(key: KeyIn): Promise<ValOut | undefined>;
    getKey(selector: KeyIn | KeySelector<KeyIn>): Promise<KeyOut | undefined>;
    getVersionstampPrefixedValue(key: KeyIn): Promise<{
        stamp: Buffer;
        value?: ValOut;
    } | null>;
    set(key: KeyIn, value: ValIn): Promise<void>;
    clear(key: KeyIn): Promise<void>;
    clearRange(start?: KeyIn, end?: KeyIn): Promise<void>;
    clearRangeStartsWith(prefix: KeyIn): Promise<void>;
    getAndWatch(key: KeyIn): Promise<WatchWithValue<ValOut>>;
    setAndWatch(key: KeyIn, value: ValIn): Promise<Watch>;
    clearAndWatch(key: KeyIn): Promise<Watch>;
    getRangeAll(start?: KeyIn | KeySelector<undefined | KeyIn>, end?: KeyIn | KeySelector<undefined | KeyIn>, opts?: RangeOptions): Promise<[KeyOut, ValOut][]>;
    getRangeAllStartsWith(prefix: KeyIn | KeySelector<KeyIn>, opts?: RangeOptions): Promise<[KeyOut, ValOut][]>;
    getEstimatedRangeSizeBytes(start?: KeyIn, end?: KeyIn): Promise<number>;
    getRangeSplitPoints(start: KeyIn | undefined, end: KeyIn | undefined, chunkSize: number): Promise<KeyOut[]>;
    atomicOpNative(op: MutationType, key: NativeValue, oper: NativeValue): Promise<void>;
    atomicOp(op: MutationType, key: KeyIn, oper: ValIn): Promise<void>;
    atomicOpKB(op: MutationType, key: KeyIn, oper: Buffer): Promise<void>;
    add(key: KeyIn, oper: ValIn): Promise<void>;
    max(key: KeyIn, oper: ValIn): Promise<void>;
    min(key: KeyIn, oper: ValIn): Promise<void>;
    bitAnd(key: KeyIn, oper: ValIn): Promise<void>;
    bitOr(key: KeyIn, oper: ValIn): Promise<void>;
    bitXor(key: KeyIn, oper: ValIn): Promise<void>;
    bitAndBuf(key: KeyIn, oper: Buffer): Promise<void>;
    bitOrBuf(key: KeyIn, oper: Buffer): Promise<void>;
    bitXorBuf(key: KeyIn, oper: Buffer): Promise<void>;
    byteMin(key: KeyIn, oper: ValIn): Promise<void>;
    byteMax(key: KeyIn, oper: ValIn): Promise<void>;
    setVersionstampedKey(key: KeyIn, value: ValIn, bakeAfterCommit?: boolean): Promise<void>;
    setVersionstampSuffixedKey(key: KeyIn, value: ValIn, suffix?: Buffer): Promise<void>;
    setVersionstampedValue(key: KeyIn, value: ValIn, bakeAfterCommit?: boolean): Promise<void>;
    setVersionstampPrefixedValue(key: KeyIn, value?: ValIn, prefix?: Buffer): Promise<void>;
}
