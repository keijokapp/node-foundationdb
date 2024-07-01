#!/usr/bin/env node

// This is not used as part of the project!
//
// This is a script to generate opts.g.js from the vexillographer fdb options file.
// It is only necessary to re-run this when FDB adds / deprecates options.
//
// Usage: node scripts/genopts.js <path to foundationdb checkout>
import * as fs from 'node:fs'
import { parseString } from 'xml2js'

/**
 * @typedef {'string' | 'int' | 'bytes' | 'none'} OptionType
 */

const fdbSourceLocation = process.argv[2] ?? `${process.env.HOME}/3rdparty/foundationdb`
const xml = fs.readFileSync(`${fdbSourceLocation}/fdbclient/vexillographer/fdb.options`, 'utf8')

const outFilename = 'lib/opts.g.js'
const output = fs.createWriteStream(outFilename)

output.write(`// This file is auto-generated from genopts.js. Do not edit.
`)

/**
 * @param {string} str
 * @returns {string}
 */
const toUpperCamelCase = str => str.replace(
  /(^\w|_\w)/g,
  c => c.length === 1 ? c.toUpperCase() : c[1].toUpperCase(),
)

/**
 * @param {string} str
 * @returns {string}
 */
const toLowerFirst = str => str[0].toLowerCase() + str.slice(1)

/**
 * @param {string} str
 * @returns {string[]}
 */
const splitLines = str => str.split(/\s*(.{10,70})(?:\s+|$)/).filter(x => x)

/**
 * @param {any[]} data
 * @returns {{ name: string; code: number; description: string | undefined; paramDescription: string | undefined; type: OptionType; deprecated: boolean; }[]}
 */
const readOptions = data => data.map(({ $: opt }) => ({
  name: opt.name,
  code: opt.code,
  description: opt.description,
  paramDescription: opt.paramDescription,
  type: (opt.paramType ? opt.paramType.toLowerCase() : 'none'),
  deprecated: opt.description && opt.description.toLowerCase() === 'deprecated',
}))

/**
 * @param {OptionType} type
 * @returns {string}
 */
const typeToTs = type => ({
  string: 'string',
  int: 'number',
  bytes: 'Buffer',
  none: 'true',
}[type])

parseString(xml, (err, result) => {
  if (err) {
    throw err
  }

  const line = (str = '') => output.write(`${str}\n`)

  // First do all the normal user-visible stuff
  result.Options.Scope.forEach(/** @param {any} scope */scope => {
    const { name } = scope.$
    const options = readOptions(scope.Option)

    let enumName = name

    if (name.endsWith('Option')) {
      line()

      line('/**')
      line(' * @typedef {{')
      options.forEach(({
        name, type, paramDescription, deprecated,
      }) => {
        output.write(` *  ${name}?: undefined | ${typeToTs(type)}`)

        if (deprecated) {
          output.write(' // DEPRECATED')
        } else if (paramDescription) {
          output.write(` // ${paramDescription.trim()}`)
        }

        line()
      })
      line(` * }} ${name}s`)
      line(' */')

      enumName = `${name}Code`
    }

    line()
    line('/** @enum {number} */')
    line(`export const ${enumName} = {`)
    options.forEach(({
      name, code, description, deprecated,
    }) => {
      if (deprecated) {
        line('  // DEPRECATED')
      } else if (description) {
        output.write('  /**\n')
        output.write(splitLines(description).map(s => `   * ${s}\n`).join(''))
        output.write('   */\n')
      }

      line(`  ${toUpperCamelCase(name)}: ${code},\n`)
    })

    line('}')
  })

  result.Options.Scope.forEach(/** @param {any} scope */scope => {
    const { name } = scope.$

    if (name.endsWith('Option')) {
      const options = readOptions(scope.Option)

      line()
      line('/** @type {import(\'./opts.js\').OptionData} */')
      line(`export const ${toLowerFirst(name)}Data = {`)
      options.forEach(({
        name, code, description, paramDescription, type, deprecated,
      }) => {
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

        line('  },\n')
      })

      line('}')
    }
  })

  output.end()
  console.log('wrote', outFilename)
})
