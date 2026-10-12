import { expect, test } from 'vitest'

test('fake IndexedDB is available in unit tests', () => {
  expect(globalThis.indexedDB).toBeDefined()
})
