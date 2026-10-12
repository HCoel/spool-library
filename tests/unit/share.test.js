import { expect, test, vi } from 'vitest'
import { deliverFile } from '../../src/core/share.js'

const file = { name: 'b.json' }
const err = name => Object.assign(new Error(name), { name })
const nav = share => ({ canShare: () => true, share })

test('shares when the share sheet is available', async () => {
  const download = vi.fn()
  expect(await deliverFile(file, { nav: nav(async () => {}), download })).toBe('shared')
  expect(download).not.toHaveBeenCalled()
})

test('a cancelled share is not a backup', async () => {
  const download = vi.fn()
  expect(await deliverFile(file, { nav: nav(async () => { throw err('AbortError') }), download })).toBe('cancelled')
  expect(download).not.toHaveBeenCalled()
})

test('a share blocked for lack of a fresh tap is reported, not silently downloaded', async () => {
  const download = vi.fn()
  expect(await deliverFile(file, { nav: nav(async () => { throw err('NotAllowedError') }), download })).toBe('blocked')
  expect(download).not.toHaveBeenCalled()
})

test('falls back to a download when sharing files is unsupported', async () => {
  const download = vi.fn()
  expect(await deliverFile(file, { nav: {}, download })).toBe('downloaded')
  expect(download).toHaveBeenCalledWith(file)
})
