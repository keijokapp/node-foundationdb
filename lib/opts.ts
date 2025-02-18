import {DatabaseOptions, NetworkOptions, TransactionOptions} from './opts.g'

export type OptionData = {
  [name: string]: {
    code: number,
    description: string,
    deprecated?: true,
    type: 'string' | 'int' | 'bytes' | 'none',
    paramDescription?: string, // only if not 'none'.
  }
}

export type OptVal = string | number | Buffer | null

type GenericOptions = {[k: string]: OptVal}

export type OptionIter = (code: number, val: OptVal) => void
export const eachOption = (data: OptionData, _opts: DatabaseOptions | NetworkOptions | TransactionOptions, iterfn: OptionIter) => {
  const opts = _opts as GenericOptions
  for (const k in opts) {
    const details = data[k]
    if (details == null) {
      console.warn('Warning: Ignoring unknown option', k)
      continue
    }

    const userVal = opts[k]

    switch (details.type) {
      case 'none':
        if ((userVal as any) !== true && userVal !== 1) console.warn(`Warning: Ignoring value ${userVal} for option ${k}`)
        iterfn(details.code, null)
        break
      case 'string': case 'bytes':
        iterfn(details.code, Buffer.from(userVal as any))
        break
      case 'int':
        if (typeof userVal !== 'number') console.warn('unexpected value for key', k, 'expected int')
        iterfn(details.code, (userVal as number)|0)
        break
    }
  }
}
