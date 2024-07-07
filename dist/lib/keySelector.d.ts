import { NativeValue } from './native';
import { Transformer } from './transformer';
export interface KeySelector<Key> {
    key: Key;
    orEqual: boolean;
    offset: number;
    _isKeySelector: true;
}
declare const _default: (<Key>(key: Key, orEqual: boolean, offset: number) => KeySelector<Key>) & {
    add: <Key_1>(sel: KeySelector<Key_1>, addOffset: number) => KeySelector<Key_1>;
    next: <Key_2>(sel: KeySelector<Key_2>) => KeySelector<Key_2>;
    prev: <Key_3>(sel: KeySelector<Key_3>) => KeySelector<Key_3>;
    lastLessThan: <Key_4>(key: Key_4) => KeySelector<Key_4>;
    lastLessOrEqual: <Key_5>(key: Key_5) => KeySelector<Key_5>;
    firstGreaterThan: <Key_6>(key: Key_6) => KeySelector<Key_6>;
    firstGreaterOrEqual: <Key_7>(key: Key_7) => KeySelector<Key_7>;
    isKeySelector: <Key_8>(val: any) => val is KeySelector<Key_8>;
    from: <Key_9>(valOrKS: Key_9 | KeySelector<Key_9>) => KeySelector<Key_9>;
    toNative: <Key_10>(sel: KeySelector<Key_10>, xf: Transformer<Key_10, any>) => KeySelector<NativeValue>;
};
export default _default;
