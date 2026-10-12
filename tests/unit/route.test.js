import { expect, test } from 'vitest'
import { parseHash } from '../../src/core/route.js'

test.each([
  ['', { name: 'grid' }],
  ['#/', { name: 'grid' }],
  ['#/p/abc', { name: 'product', id: 'abc' }],
  ['#/edit/abc', { name: 'edit', id: 'abc' }],
  ['#/new', { name: 'new', from: null }],
  ['#/new/abc', { name: 'new', from: 'abc' }],
  ['#/settings', { name: 'settings' }],
  ['#/nonsense', { name: 'grid' }],
  ['#/p', { name: 'grid' }],
])('%s', (hash, route) => expect(parseHash(hash)).toEqual(route))
