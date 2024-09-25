#!/usr/bin/env -S node -r ts-node/register

// This is not used as part of the project!
//
// This is a script to generate opts.g.ts from the vexillographer fdb options file.
// It is only necessary to re-run this when FDB adds / deprecates options.
//
// Usage: node dist/lib/gentsopts.js <path to foundationdb checkout>
import * as fs from 'fs'
import { parseString } from 'xml2js'

const fdbSourceLocation = process.argv[2] ?? `${process.env.HOME}/3rdparty/foundationdb`
const xml = fs.readFileSync(`${fdbSourceLocation}/fdbclient/vexillographer/fdb.options`, 'utf8')

const outFilename = 'lib/opts.g.ts'
const output = fs.createWriteStream(outFilename)

output.write(`// This file is auto-generated from gentsopts.ts. Do not edit.

/* eslint-disable @typescript-eslint/no-duplicate-enum-values */

import { OptionData } from './opts'
`)

const toUpperCamelCase = (str: string) => str.replace(/(^\w|_\w)/g, c => c.length === 1 ? c.toUpperCase() : c[1].toUpperCase())

const toLowerFirst = (str: string) => str[0].toLowerCase() + str.slice(1)

const splitLines = (str: string) => str.split(/\s*(.{10,70})(?:\s+|$)/).filter(x => x)

type OptionType = 'string' | 'int' | 'bytes' | 'none'
const readOptions = (data: any[]) => data.map(({ $: opt }: { $: any }) => ({
  name: opt.name as string,
  code: opt.code as number,
  description: opt.description as string | undefined,
  paramDescription: opt.paramDescription as string | undefined,
  type: (opt.paramType ? opt.paramType.toLowerCase() : 'none') as OptionType,
  deprecated: opt.description && opt.description.toLowerCase() === 'deprecated'
}))

const typeToTs = (type: 'string' | 'int' | 'bytes' | 'none') => ({
  string: 'string',
  int: 'number',
  bytes: 'Buffer',
  none: 'true'
}[type])

parseString(xml, (err, result) => {
  if (err) {
    throw err
  }

  const line = (str: string = '') => output.write(`${str}\n`)

  // First do all the normal user-visible stuff
  result.Options.Scope.forEach((scope: any) => {
    const { name } = scope.$
    const options = readOptions(scope.Option)

    let enumName = name

    if (name.endsWith('Option')) {
      line('')

      line(`export type ${name}s = {`)
      options.forEach(({
        name, type, paramDescription, deprecated
      }) => {
        output.write(`  ${name}?: undefined | ${typeToTs(type)}`)

        if (deprecated) {
          output.write(' // DEPRECATED')
        } else if (paramDescription) {
          output.write(` // ${paramDescription.trim()}`)
        }

        line()
      })
      line('}')

      enumName = `${name}Code`
    }

    line('')

    line(`export enum ${enumName} {`)
    options.forEach(({
      name, code, description, deprecated
    }) => {
      if (deprecated) {
        line('  // DEPRECATED')
      } else if (description) {
        output.write('  /**\n')
        output.write(splitLines(description).map(s => `   * ${s}\n`).join(''))
        output.write('   */\n')
      }

      line(`  ${toUpperCamelCase(name)} = ${code},\n`)
    })

    line('}')
  })

  result.Options.Scope.forEach((scope: any) => {
    const { name } = scope.$

    if (name.endsWith('Option')) {
      const options = readOptions(scope.Option)

      line('')
      line(`export const ${toLowerFirst(name)}Data: OptionData = {`)
      options.forEach(({
        name, code, description, paramDescription, type, deprecated
      }, i) => {
        line(`  ${name}: {`)
        line(`    code: ${code},`)

        if (description != null) {
          line(`    description: '${description.replace(/'/g, '\\\'')}',`)
        } else {
          line('    description: \'\',')
        }

        if (deprecated) {
          line(`    deprecated: ${deprecated},`)
        }

        if (paramDescription != null) {
          line(`    type: '${type}',`)
          line(`    paramDescription: '${paramDescription.replace(/'/g, '\\\'')}'`)
        } else {
          line(`    type: '${type}'`)
        }

        if (i < options.length - 1) {
          line('  },\n')
        } else {
          line('  }\n')
        }
      })

      line('}')
    }
  })

  output.end()
  console.log('wrote', outFilename)
})
