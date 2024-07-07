/// <reference types="node" />
export type UnboundStamp = {
    data: Buffer;
    stampPos: number;
    codePos?: number;
};
export declare const packVersionstamp: ({ data, stampPos }: UnboundStamp, isKey: boolean) => Buffer;
export declare const packPrefixedVersionstamp: (prefix: Buffer, { data, stampPos }: UnboundStamp, isKey: boolean) => Buffer;
export declare const packVersionstampPrefixSuffix: (prefix: Buffer | undefined, suffix: Buffer | undefined, isKey: boolean) => Buffer;
