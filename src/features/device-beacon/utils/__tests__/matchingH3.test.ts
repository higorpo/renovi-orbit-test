import { latLngToCell } from 'h3-js'
import { describe, expect, it } from 'vitest'

import {
  H3_RESOLUTION_MATCHING,
  h3HexToBigInt,
  latLngToH3BigInt,
} from '../matchingH3'

describe('matchingH3', () => {
  it('converts an H3 hexadecimal index without losing 64-bit precision', () => {
    const hex = '87a8100d2ffffff'

    expect(h3HexToBigInt(hex)).toBe(BigInt(`0x${hex}`))
    expect(h3HexToBigInt(hex.toUpperCase())).toBe(BigInt(`0x${hex}`))
  })

  it.each(['', '0x87a8100d2ffffff', 'not-an-index', '87a8 100'])(
    'rejects non-hexadecimal input %j',
    (value) => {
      expect(h3HexToBigInt(value)).toBeNull()
    },
  )

  it('uses the platform matching resolution by default', () => {
    const latitude = -23.5505
    const longitude = -46.6333
    const expectedHex = latLngToCell(latitude, longitude, H3_RESOLUTION_MATCHING)

    expect(latLngToH3BigInt(latitude, longitude)).toBe(BigInt(`0x${expectedHex}`))
  })

  it('honors an explicit H3 resolution', () => {
    const latitude = -27.5949
    const longitude = -48.5482
    const expectedHex = latLngToCell(latitude, longitude, 9)

    expect(latLngToH3BigInt(latitude, longitude, 9)).toBe(BigInt(`0x${expectedHex}`))
  })

  it.each([
    [Number.NaN, -46.6333, H3_RESOLUTION_MATCHING],
    [-23.5505, Number.POSITIVE_INFINITY, H3_RESOLUTION_MATCHING],
    [-23.5505, -46.6333, 99],
  ])('returns null when H3 rejects the coordinates or resolution', (latitude, longitude, resolution) => {
    expect(latLngToH3BigInt(latitude, longitude, resolution)).toBeNull()
  })
})
