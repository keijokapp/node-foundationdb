import type { TupleItem } from 'fdb-tuple';
import * as tupleEncoder from 'fdb-tuple';
import type { Transformer } from './transformer';
import { id } from './util';

export const int32BE: Transformer<number, number> = {
	pack(num) {
		const b = Buffer.allocUnsafe(4)
		b.writeInt32BE(num)

		return b
	},
	unpack(buf) { return buf.readInt32BE() }
}

export const json: Transformer<any, any> = {
	pack(obj) { return JSON.stringify(obj) },
	unpack(buf) { return JSON.parse(buf.toString()) }
}

export const string: Transformer<string, string> = {
    pack(str) { return Buffer.from(str) },
    unpack(buf) { return buf.toString() }
}

export const buf: Transformer<Buffer, Buffer> = {
	pack: id,
	unpack: id
}

export const tuple = tupleEncoder as any as Omit<typeof tupleEncoder, 'bakeVersionstamp'> & NonNullable<Transformer<TupleItem | TupleItem[], TupleItem[]>['bakeVersionstamp']>
