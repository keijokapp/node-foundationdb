/// <reference types="node" />
import { DatabaseOptions, NetworkOptions, TransactionOptions } from './opts.g';
export type OptionData = {
    [name: string]: {
        code: number;
        description: string;
        deprecated?: true;
        type: 'string' | 'int' | 'bytes' | 'none';
        paramDescription?: string;
    };
};
export type OptVal = string | number | Buffer | null;
export type OptionIter = (code: number, val: OptVal) => void;
export declare const eachOption: (data: OptionData, _opts: DatabaseOptions | NetworkOptions | TransactionOptions, iterfn: OptionIter) => void;
