// @ts-check

/**
 * @template Key
 * @typedef {{
 *   key: Key,
 *   orEqual: boolean
 *   offset: number
 *   _isKeySelector: true
 * }} KeySelector
 */

/**
 * @template Key
 * @param {Key} key
 * @param {boolean} orEqual
 * @param {number} offset
 * @returns {KeySelector<Key>}
 */
const keySelector = (key, orEqual, offset) => (
  {key, orEqual, offset, _isKeySelector: true}
)

/**
 * @template Key
 * @param {KeySelector<Key>} sel
 * @param {number} addOffset
 * @returns {KeySelector<Key>}
 */
const add = (sel, addOffset) => keySelector(sel.key, sel.orEqual, sel.offset + addOffset)

/**
 * @template Key
 * @param {KeySelector<Key>} sel
 * @returns {KeySelector<Key>}
 */
const next = (sel) => add(sel, 1)
/**
 * @template Key
 * @param {KeySelector<Key>} sel
 * @returns {KeySelector<Key>}
 */
const prev = (sel) => add(sel, -1)

// From the [docs](https://apple.github.io/foundationdb/developer-guide.html#key-selectors):
//
// To resolve these key selectors FoundationDB first finds the last key less
// than the reference key (or equal to the reference key, if the equality flag
// is true), then moves forward a number of keys equal to the offset (or
// backwards, if the offset is negative).
/**
 * @template Key
 * @param {Key} key
 * @returns {KeySelector<Key>}
 */
const lastLessThan = (key) => keySelector(key, false, 0)
/**
 * @template Key
 * @param {Key} key
 * @returns {KeySelector<Key>}
 */
const lastLessOrEqual = (key) => keySelector(key, true, 0)
/**
 * @template Key
 * @param {Key} key
 * @returns {KeySelector<Key>}
 */
const firstGreaterThan = (key) => keySelector(key, true, 1)
/**
 * @template Key
 * @param {Key} key
 * @returns {KeySelector<Key>}
 */
const firstGreaterOrEqual = (key) => keySelector(key, false, 1)

/**
 * @template Key
 * @param {any} val
 * @returns {val is KeySelector<Key>}
 */
const isKeySelector = (val) => {
  return (typeof val === 'object' && val != null && val._isKeySelector)
}

/**
 * @template Key
 * @param {Key | KeySelector<Key>} valOrKS
 * @returns {KeySelector<Key>}
 */
const from = (valOrKS) => (
  isKeySelector(valOrKS) ? valOrKS : firstGreaterOrEqual(valOrKS)
)

/**
 * @template Key
 * @param {KeySelector<Key>} sel
 * @param {import('./transformer.js').Transformer<Key, any>} xf
 * @returns {KeySelector<import('./native.js').NativeValue>}
 */
const toNative = (sel, xf) => (
  keySelector(xf.pack(sel.key), sel.orEqual, sel.offset)
)

export default Object.assign(keySelector, {
  add, next, prev, lastLessThan, lastLessOrEqual, firstGreaterThan, firstGreaterOrEqual, isKeySelector, from, toNative
})
