import { describe, expect, it } from 'vitest'
import { CAPACITOR_BRAND_COLOR } from '../constants'

describe('CAPACITOR_BRAND_COLOR', () => {
  it('matches Prestway primary used in PWA theme and Android splash', () => {
    expect(CAPACITOR_BRAND_COLOR).toBe('#000000')
  })
})
