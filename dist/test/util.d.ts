/// <reference types="node" />
import 'mocha';
import * as fdb from '../lib';
export declare const prefix = "__test_data__/";
export declare const bufToNum: (b: Buffer | null, def?: number) => number;
export declare const numToBuf: (n: number) => Buffer;
export declare const numXF: {
    pack: (n: number) => Buffer;
    unpack: (b: Buffer | null, def?: number) => number;
};
export declare const strXF: {
    pack(s: string): string;
    unpack(b: Buffer): string;
};
export declare const testApiVersion = 630;
export declare const withEachDb: (fn: (db: fdb.Database) => void) => void;
