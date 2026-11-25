import type { RegionBounds } from './types'

export interface Point {
  x: number
  y: number
}

export function normalizeRegion(
  start: Point,
  end: Point,
  origin: Point,
  displayId: number,
  scaleFactor: number,
): RegionBounds {
  const x = Math.round(Math.min(start.x, end.x) + origin.x)
  const y = Math.round(Math.min(start.y, end.y) + origin.y)
  const width = Math.max(1, Math.round(Math.abs(end.x - start.x)))
  const height = Math.max(1, Math.round(Math.abs(end.y - start.y)))

  return { x, y, width, height, displayId, scaleFactor }
}

export function regionToCrop(bounds: RegionBounds) {
  return {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
  }
}
