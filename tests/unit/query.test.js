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
    expect(ids({ finish: ['matte'] })).toEqual(['1'])
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
  const sortIds = sort => queryProducts(products, units, lib, { sort, showArchived: true }).map(r => r.product.id)
  test('type sort follows the material list (PLA first), unlike name order', () => {
    // name order would be 2 (PETG) then 1 (PLA); Elegoo PLA (3) last because it has no active spools
    expect(sortIds('type')).toEqual(['1', '2', '3'])
  })
  test('brand sort', () => {
    const extra = prod('4', 'Zed', {}, { brand: 'Anycubic' })
    const blank = prod('5', 'Aaa', {}, { brand: '' })
    const u = groupUnits([unit('x', '4'), unit('y', '5')])
    expect(queryProducts([products[0], extra, blank], new Map([...units, ...u]), lib, { sort: 'brand' }).map(r => r.product.id)).toEqual(['4', '1', '5'])
  })
  test('colour sort follows the rainbow', () => {
    const red = prod('6', 'Red', { color_hex: '#E63946' })
    const u = groupUnits([unit('z', '6')])
    expect(queryProducts([products[0], products[1], red], new Map([...units, ...u]), lib, { sort: 'colour' }).map(r => r.product.id)).toEqual(['6', '1', '2'])
  })
  test('finish sort follows the finish list order, unlike name order', () => {
    const wood = prod('7', 'Aaa Wood', { finish: 'wood' })
    const u = groupUnits([unit('w', '7')])
    // name order would put "Aaa Wood" first; finish order is basic (2), matte (1), wood (7)
    expect(queryProducts([products[0], products[1], wood], new Map([...units, ...u]), lib, { sort: 'finish' }).map(r => r.product.id)).toEqual(['2', '1', '7'])
  })
  test('unknown sort falls back to name', () => {
    expect(sortIds('updated')).toEqual(['2', '1', '3'])
  })
})
