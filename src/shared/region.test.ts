import { describe, expect, it } from 'vitest'
import { normalizeRegion, regionToCrop } from './region'

describe('normalizeRegion', () => {
  it('supports dragging in any direction', () => {
    expect(normalizeRegion({ x: 320, y: 180 }, { x: 120, y: 40 }, { x: -1920, y: 100 }, 2, 2)).toEqual({
      x: -1800,
      y: 140,
      width: 200,
      height: 140,
      displayId: 2,
      scaleFactor: 2,
    })
  })

  it('keeps a minimum valid size for a click', () => {
    const result = normalizeRegion({ x: 10, y: 10 }, { x: 10, y: 10 }, { x: 0, y: 0 }, 1, 1)
    expect(result.width).toBe(1)
    expect(result.height).toBe(1)
  })
})

describe('regionToCrop', () => {
  it('rounds physical capture coordinates', () => {
    expect(regionToCrop({ x: 10.4, y: 20.6, width: 800.5, height: 600.4, displayId: 1, scaleFactor: 2 })).toEqual({
      x: 10,
      y: 21,
      width: 801,
      height: 600,
    })
  })
})
