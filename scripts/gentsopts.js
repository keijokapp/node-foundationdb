#!/usr/bin/env node

// @ts-check

// This is not used as part of the project!
//
// This is a script to generate opts.g.ts from the vexillographer fdb options file.
// It is only necessary to re-run this when FDB adds / deprecates options.
//
// Usage: node scripts/gentsopts.js <path to foundationdb checkout>
import fs from 'fs'
import xml2js from 'xml2js'

const {parseString} = xml2js

/**
 * @typedef {'string' | 'int' | 'bytes' | 'none'} OptionType
 */

const fdbSourceLocation = process.argv[2] || (process.env.HOME + '/3rdparty/foundationdb')
const xml = fs.readFileSync(fdbSourceLocation + '/fdbclient/vexillographer/fdb.options', 'utf8')

const outFilename = 'lib/opts.g.js'
const output = fs.createWriteStream(outFilename)

const comment = '\/\/' // I'm really sad that this is needed.
output.write(`// @ts-check

${comment} This file is auto-generated from gentsopts.ts. Do not edit.

`)


/** @param {string} str @returns {string}  */
const toUpperCamelCase = (str) => str.replace(/(^\w|_\w)/g, c =>
  c.length == 1 ? c.toUpperCase() : c[1].toUpperCase()
)
/** @param {string} str @returns {string}  */
const toLowerFirst = (str) => str[0].toLowerCase() + str.slice(1)

/** @param {string} str @returns {string[]}  */
const splitLines = (str) => str.split(/\s*(.{10,70})(?:\s+|$)/).filter(x => x)

/** @param {any[]} data */
const readOptions = (data) => (
  data.map(({$:opt}) => ({
    name: /** @type {string} */(opt.name),
    code: /** @type {number} */(opt.code),
    description: /** @type {string | undefined} */(opt.description),
    paramDescription: /** @type {string | undefined} */(opt.paramDescription),
    type: /** @type {OptionType} */(opt.paramType ? opt.paramType.toLowerCase() : 'none'),
    deprecated: (opt.description && opt.description.toLowerCase() === 'deprecated')
  }))
)

/** @type {(type: OptionType) => string} */
const typeToTs = (type) => ({
  string: 'string',
  int: 'number',
  bytes: 'Buffer',
  none: 'true'
}[type])

parseString(xml, (err, result) => {
  if (err) throw err

  /** @param {string} [str] */
  const line = (str = '') => output.write(str + '\n')

  // First do all the normal user-visible stuff
  result.Options.Scope.forEach(/** @param {any} scope */(scope) => {
    const name = /** @type {string} */(scope.$.name)
    const options = readOptions(scope.Option)

    let enumName = name

    if (name.endsWith('Option')) {
      line(`/**`)
      line(` * @typedef {{`)
      options.forEach(({name, type, paramDescription, deprecated}) => {
        output.write(` *  ${name}?: undefined | ${typeToTs(type)}`)
        if (deprecated) output.write(` ${comment} DEPRECATED`)
        else if (paramDescription) output.write(`  ${comment} ${paramDescription}`)
        line()
      })
      line(` * }} ${name}s`)
      line(` */`)

      enumName = name + 'Code'
    }

    line();

    line(`/** @enum {number} */`)
    line(`export const ${enumName} = {`)
    options.forEach(({name, code, type, description, deprecated}) => {
      if (deprecated) line(`  ${comment} DEPRECATED`)
      else if (description) {
        output.write('  /**\n')
        output.write(splitLines(description).map(s => `   * ${s}\n`).join(''))
        output.write('   */\n')
      }

      // line(`  '${code}': ${JSON.stringify(name)},\n`)
      line(`  ${toUpperCamelCase(name)}: ${code},\n`)
    })

    line(`}\n`)
  })

  result.Options.Scope.forEach(/** @param {any} scope */(scope) => {
    const name = /** @type {string} */(scope.$.name)
    if (name.endsWith('Option')) {
      const options = readOptions(scope.Option)

      line('/** @type {import(\'./opts.js\').OptionData} */')
      line(`export const ${toLowerFirst(name) + 'Data'} = {`)
      options.forEach(({name, code, description, paramDescription, type, deprecated}) => {
        line(`  ${name}: {`)
        line(`    code: ${code},`)
        line(`    description: "${description}",`)
        if (deprecated) line(`    deprecated: ${deprecated},`)
        line(`    type: '${type}',`)
        if (type !== 'none') line(`    paramDescription: "${paramDescription}",`)
        line(`  },\n`)
      })
      line(`}\n`)
    }
  })

  output.end()
  console.log('wrote', outFilename)
})
