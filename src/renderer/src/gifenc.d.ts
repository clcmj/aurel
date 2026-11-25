declare module 'gifenc' {
  export interface GifFrameOptions {
    palette?: number[][]
    first?: boolean
    transparent?: boolean
    transparentIndex?: number
    delay?: number
    repeat?: number
    dispose?: number
  }

  type Rgba = Uint8Array<ArrayBufferLike> | Uint8ClampedArray<ArrayBufferLike>
  export function quantize(rgba: Rgba, maxColors: number, options?: { format?: 'rgb565' | 'rgb444' | 'rgba4444' }): number[][]
  export function applyPalette(rgba: Rgba, palette: number[][], format?: 'rgb565' | 'rgb444' | 'rgba4444'): Uint8Array<ArrayBuffer>

  export interface GIFEncoder {
    writeFrame(index: Uint8Array, width: number, height: number, options?: GifFrameOptions): void
    finish(): void
    bytes(): Uint8Array<ArrayBuffer>
  }

  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): GIFEncoder
}
