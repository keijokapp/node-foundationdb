/// <reference types="node" />
import { Transformer } from "./transformer";
import { NativeValue } from "./native";
import { UnboundStamp } from './versionstamp.js';
export default class Subspace<KeyIn = NativeValue, KeyOut = Buffer, ValIn = NativeValue, ValOut = Buffer> {
    prefix: Buffer;
    keyXf: Transformer<KeyIn, KeyOut>;
    valueXf: Transformer<ValIn, ValOut>;
    _bakedKeyXf: Transformer<KeyIn, KeyOut>;
    _noDefaultPrefix: boolean;
    constructor(rawPrefix: string | Buffer | null, keyXf?: Transformer<KeyIn, KeyOut>, valueXf?: Transformer<ValIn, ValOut>, noDefaultPrefix?: boolean);
    /**
     * Switch to a new mode of handling ranges. By default, the range operations (`getRange` family
     * and `clearRange`) treat calls with missing end key as operations on prefix ranges. That means
     * that a call like `tn.at('a').getRange('x')` acts on prefix `ax`, ie key range `[ax, ay)`. In
     * the new mode, the missing end key defaults to a subspace end (inclusive), ie that call would
     * act on a range `[ax, b)`. This enabled specifying key ranges not possible before.
     *
     * To specifiy range as a prefix, use `StartsWith` version of those methods (eg
     * `getRangeAllStartsWith`).
     *
     * @see Subspace.packRange
     */
    noDefaultPrefix(): Subspace<KeyIn, KeyOut, ValIn, ValOut>;
    at(prefix?: KeyIn | null, keyXf?: undefined, valueXf?: undefined): Subspace<KeyIn, KeyOut, ValIn, ValOut>;
    at<CKI, CKO>(prefix: KeyIn | null | undefined, keyXf: Transformer<CKI, CKO>, valueXf?: undefined): Subspace<CKI, CKO, ValIn, ValOut>;
    at<CVI, CVO>(prefix: KeyIn | null | undefined, keyXf: undefined, valueXf: Transformer<CVI, CVO>): Subspace<KeyIn, KeyOut, CVI, CVO>;
    at<CKI, CKO, CVI, CVO>(prefix: KeyIn | null | undefined, keyXf: Transformer<CKI, CKO>, valueXf: Transformer<CVI, CVO>): Subspace<CKI, CKO, CVI, CVO>;
    at<CKI, CKO>(prefix: KeyIn | null | undefined, keyXf?: Transformer<CKI, CKO>, valueXf?: undefined): Subspace<KeyIn, KeyOut, ValIn, ValOut> | Subspace<CKI, CKO, ValIn, ValOut>;
    at<CVI, CVO>(prefix: KeyIn | null | undefined, keyXf: undefined, valueXf?: Transformer<CVI, CVO>): Subspace<KeyIn, KeyOut, ValIn, ValOut> | Subspace<KeyIn, KeyOut, CVI, CVO>;
    at<CKI, CKO, CVI, CVO>(prefix: KeyIn | null | undefined, keyXf: Transformer<CKI, CKO> | undefined, valueXf: Transformer<CVI, CVO>): Subspace<KeyIn, KeyOut, CVI, CVO> | Subspace<CKI, CKO, CVI, CVO>;
    at<CKI, CKO, CVI, CVO>(prefix: KeyIn | null | undefined, keyXf: Transformer<CKI, CKO>, valueXf?: Transformer<CVI, CVO>): Subspace<CKI, CKO, ValIn, ValOut> | Subspace<CKI, CKO, CVI, CVO>;
    at<CKI, CKO, CVI, CVO>(prefix?: KeyIn | null, keyXf?: Transformer<CKI, CKO>, valueXf?: Transformer<CVI, CVO>): Subspace<KeyIn, KeyOut, ValIn, ValOut> | Subspace<CKI, CKO, ValIn, ValOut> | Subspace<KeyIn, KeyOut, CVI, CVO> | Subspace<CKI, CKO, CVI, CVO>;
    /** At a child prefix thats specified without reference to the key transformer */
    atRaw(prefix: Buffer): Subspace<KeyIn, KeyOut, ValIn, ValOut>;
    withKeyEncoding(keyXf?: undefined): Subspace<NativeValue, Buffer, ValIn, ValOut>;
    withKeyEncoding<CKI, CKO>(keyXf: Transformer<CKI, CKO>): Subspace<CKI, CKO, ValIn, ValOut>;
    withKeyEncoding<CKI, CKO>(keyXf?: Transformer<CKI, CKO>): Subspace<NativeValue, Buffer, ValIn, ValOut> | Subspace<CKI, CKO, ValIn, ValOut>;
    withValueEncoding(valueXf?: undefined): Subspace<KeyIn, KeyOut, NativeValue, Buffer>;
    withValueEncoding<CVI, CVO>(valueXf: Transformer<CVI, CVO>): Subspace<KeyIn, KeyOut, CVI, CVO>;
    withValueEncoding<CVI, CVO>(valueXf?: Transformer<CVI, CVO>): Subspace<KeyIn, KeyOut, NativeValue, Buffer> | Subspace<KeyIn, KeyOut, CVI, CVO>;
    getSubspace(): this;
    packKey(key: KeyIn): NativeValue;
    unpackKey(key: Buffer): KeyOut;
    packKeyUnboundVersionstamp(key: KeyIn): UnboundStamp;
    packValue(val: ValIn): NativeValue;
    unpackValue(val: Buffer): ValOut;
    packValueUnboundVersionstamp(value: ValIn): UnboundStamp;
    /**
     * Encodes a range specified by `start`/`end` pair using configured key encoder.
     *
     * @param start Start of the key range. If undefined, the start of the subspace is assumed.
     * @param end End of the key range. If undefined, the end of the subspace is assumed, unless
     * `noDefaultPrefix` flag is set or enabled for this subspace, in which case, start key is treated
     * as a prefix.
     * @param noDefaultPrefix Disable treating start key as a prefix if end key is not specified.
     * @returns Encoded range as a `{ begin, end }` record.
     */
    packRange(start?: KeyIn, end?: KeyIn, noDefaultPrefix?: boolean): {
        begin: NativeValue;
        end: NativeValue;
    };
    /**
     * Encodes a range specified by the prefix using configured key encoder.
     *
     * @param prefix Start of the key key range. If undefined, the start of the subspace is assumed.
     * @returns Encoded range as a `{ begin, end }` record.
     */
    packRangeStartsWith(prefix: KeyIn): {
        begin: NativeValue;
        end: NativeValue;
    };
    contains(key: NativeValue): boolean;
}
export declare const root: Subspace;
export interface GetSubspace<KI, KO, VI, VO> {
    getSubspace(): Subspace<KI, KO, VI, VO>;
}
export declare const isGetSubspace: <KI, KO, VI, VO>(obj: any) => obj is GetSubspace<KI, KO, VI, VO>;
