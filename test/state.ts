import * as assert from 'assert'
import { describe, it } from 'mocha'
import * as fdb from '../lib'
import mod from '../lib/native'
import { testApiVersion } from './util'

fdb.setAPIVersion(testApiVersion)

describe('state tests', () => {
  it('throws if a closed database has a tn run on it', async () => {
    const db = fdb.open()
    db.close()
    await assert.rejects(db.get('x'))
  })

  it.skip('cancels pending watches when the database is closed', async () => {
    // This doesn't actually work, though I thought it would.
    const db = fdb.open()
    const w = await db.getAndWatch('x')
    db.close()

    await w.promise
  })

  it('does nothing if the native module has setAPIVersion called again', () => {
    mod.setAPIVersion(testApiVersion)
    mod.setAPIVersionImpl(testApiVersion, testApiVersion)
  })
})
