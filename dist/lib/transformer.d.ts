/// <reference types="node" />
import { UnboundStamp } from './versionstamp';
export type Transformer<In, Out> = {
    name?: undefined | string;
    pack(val: In): Buffer | string;
    unpack(buf: Buffer): Out;
    packUnboundVersionstamp?(val: In): UnboundStamp;
    bakeVersionstamp?(val: In, versionstamp: Buffer, code: Buffer | null): void;
    range?(prefix: In): {
        begin: Buffer | string;
        end: Buffer | string;
    };
};
export declare const defaultTransformer: Transformer<Buffer | string, Buffer>;
export declare const defaultGetRange: <KeyIn, KeyOut>(prefix: KeyIn, keyXf: Transformer<KeyIn, KeyOut>) => {
    begin: Buffer | string;
    end: Buffer | string;
};
export declare const prefixTransformer: <In, Out>(prefix: string | Buffer, inner: Transformer<In, Out>) => Transformer<In, Out>;
