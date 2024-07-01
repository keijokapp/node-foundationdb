// @ts-check

/**
 * @param {import('foundationdb').OptionData} data
 * @param {(
 *   | import('foundationdb').DatabaseOptions
 *   | import('foundationdb').NetworkOptions
 *   | import('foundationdb').TransactionOptions
 * )} _opts
 * @param {(code: number, value: string | number | Buffer | null) => void} iterfn
 */
export const eachOption = (data, _opts, iterfn) => {
  /** @type {Record<string, string | number | Buffer | null>} */
  const opts = /** @type {Record<string, string | number | Buffer | null>} */(_opts)
  for (const k in opts) {
    const details = data[k]
    if (details == null) {
      console.warn('Warning: Ignoring unknown option', k)
      continue
    }

    const {code, type} = details
    const userVal = opts[k]

    switch (type) {
      case 'none':
        if (/** @type {any} */(userVal) !== true && userVal !== 1) console.warn(`Warning: Ignoring value ${userVal} for option ${k}`)
        iterfn(details.code, null)
        break
      case 'string': case 'bytes':
        iterfn(details.code, Buffer.from(/** @type {any} */(userVal)))
        break
      case 'int':
        if (typeof userVal !== 'number') console.warn('unexpected value for key', k, 'expected int')
        iterfn(details.code, /** @type {any} */(userVal)|0)
        break
    }
  }
}
