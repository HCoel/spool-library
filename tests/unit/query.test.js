import { describe, expect, test } from 'vitest'
import { groupUnits, matchesSearch, queryProducts } from '../../src/core/query.js'
import * as filament from '../../src/libraries/filament/definition.js'

const lib = filament
const prod = (id, name, fields, extra = {}) => ({
  id, name, brand: 'Bambu', notes: '', updated_at: `2026-01-0${id}T00:00:00.000Z`, library: 'filament',
  fields: { ...filament.newFields(), ...fields }, ...extra,
})
const unit = (id, product_id, extra = {}) => ({ id, product_id, amount_mode: 'level', level: 1, archived: false, deleted: false, updated_at: '2026-01-01T00:00:00.000Z', ...extra })

const products = [
  prod('1', 'Bambu PLA Black', { material: 'PLA', finish: 'matte', color_hex: '#111111', color_name: 'Black' }),
  prod('2', 'Bambu PETG Jade White', { material: 'PETG', color_hex: '#F0F0E8', color_name: 'Jade White' }),
  prod('3', 'Elegoo PLA Blue', { material: 'PLA', finish: 'silk', color_hex: '#1E90FF', color_name: 'Blue' }, { brand: 'Elegoo' }),
]
const units = groupUnits([
  unit('a', '1', { level: 0.25 }),
  unit('b', '2'), unit('c', '2'),
  unit('d', '3', { archived: true }),
  unit('e', '3', { deleted: true }),
])

describe('groupUnits', () => {
  test('groups by product and drops tombstones', () => {
    expect(units.get('3').map(u => u.id)).toEqual(['d'])
  })
})

describe('search', () => {
  test('matches name, brand, colour name and notes', () => {
    expect(queryProducts(products, units, lib, { search: 'jade' }).map(r => r.product.id)).toEqual(['2'])
    expect(queryProducts(products, units, lib, { search: 'elegoo', showArchived: true }).map(r => r.product.id)).toEqual(['3'])
  })
  // Review focus 4: regex characters, case and padding
  test('treats input as plain text', () => {
    expect(() => queryProducts(products, units, lib, { search: 'pla+(' })).not.toThrow()
    expect(queryProducts(products, units, lib, { search: 'pla+(' })).toEqual([])
    expect(matchesSearch(products[1], '  JADE ')).toBe(true)
    expect(matchesSearch(products[1], '   ')).toBe(true)
  })
})

describe('filters', () => {
  test('OR within a facet, AND across facets', () => {
    const ids = f => queryProducts(products, units, lib, { filters: f, showArchived: true }).map(r => r.product.id).sort()
    expect(ids({ material: ['PLA'] })).toEqual(['1', '3'])
    expect(ids({ material: ['PLA', 'PETG'] })).toEqual(['1', '2', '3'])
    expect(ids({ material: ['PLA'], finish: ['silk'] })).toEqual(['3'])
    expect(ids({ color: ['blue'] })).toEqual(['3'])
    expect(ids({ material: [] })).toEqual(['1', '2', '3'])
  })
})

describe('rows and sorting', () => {
  test('rows carry totals; archived units hidden unless asked', () => {
    const rows = queryProducts(products, units, lib, {})
    const byId = Object.fromEntries(rows.map(r => [r.product.id, r]))
    expect(byId['2']).toMatchObject({ activeCount: 2, remaining: 2000 })
    expect(byId['1'].units.map(u => u.id)).toEqual(['a'])
    expect(queryProducts(products, units, lib, { showArchived: true }).find(r => r.product.id === '3').units).toHaveLength(1)
  })
  test('products with no active units are hidden unless showArchived', () => {
    expect(queryProducts(products, units, lib, {}).map(r => r.product.id)).not.toContain('3')
    expect(queryProducts(products, units, lib, { showArchived: true }).map(r => r.product.id)).toContain('3')
  })
  test('a product with no spools at all (all deleted) stays visible', () => {
    const none = prod('4', 'Zero', {})
    expect(queryProducts([none], units, lib, {}).map(r => r.product.id)).toEqual(['4'])
  })
  test('name sort puts products with no active units last', () => {
    // "Bambu PETG..." sorts before "Bambu PLA..."; Elegoo has no active spools so goes last
    expect(queryProducts(products, units, lib, { sort: 'name', showArchived: true }).map(r => r.product.id)).toEqual(['2', '1', '3'])
  })
  test('remaining sort is ascending', () => {
    expect(queryProducts(products, units, lib, { sort: 'remaining', showArchived: true }).map(r => r.product.id)).toEqual(['1', '2', '3'])
  })
  test('updated sort is newest first', () => {
    expect(queryProducts(products.slice(0, 2), units, lib, { sort: 'updated' }).map(r => r.product.id)).toEqual(['2', '1'])
  })
})
