/* eslint-disable import/prefer-default-export */

/**
 * @import { DatabaseOptions, NetworkOptions, TransactionOptions } from './opts.g.js'
 */

/**
 * @typedef {{
 *   [name: string]: {
 *     code: number,
 *     description: string,
 *     deprecated?: true,
 *     type: 'string' | 'int' | 'bytes' | 'none',
 *     paramDescription?: string, // only if not 'none'.
 *   }
 * }} OptionData
 */

/**
 * @param {OptionData} data
 * @param {DatabaseOptions | NetworkOptions | TransactionOptions} _opts
 * @param {(code: number, value: string | number | Buffer | null) => void} iterfn
 */
export const eachOption = (data, _opts, iterfn) => {
  /** @type {Record<string, string | number | Buffer | null>} */
  const opts = /** @type {Record<string, string | number | Buffer | null>} */(_opts)

  for (const k in opts) {
    const details = data[k]

    if (details == null) {
      // eslint-disable-next-line no-console
      console.warn('Warning: Ignoring unknown option', k)

      continue
    }

    const userVal = opts[k]

    switch (details.type) {
      case 'none':
        if (/** @type {any} */(userVal) !== true && userVal !== 1) {
          // eslint-disable-next-line no-console
          console.warn(`Warning: Ignoring value ${userVal} for option ${k}`)
        }

        iterfn(details.code, null)

        break
      case 'string':
      case 'bytes':
        iterfn(details.code, Buffer.from(/** @type {any} */(userVal)))

        break
      case 'int':
        if (typeof userVal !== 'number') {
          // eslint-disable-next-line no-console
          console.warn('unexpected value for key', k, 'expected int')
        }

        // eslint-disable-next-line no-bitwise
        iterfn(details.code, /** @type {number} */(userVal) | 0)

        break
    }
  }
}
