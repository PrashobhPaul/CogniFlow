declare module "gifenc" {
  export type Palette = number[][];

  export interface GIFEncoderOptions {
    auto?: boolean;
    initialCapacity?: number;
  }

  export interface WriteFrameOptions {
    palette?: Palette;
    first?: boolean;
    transparent?: boolean;
    transparentIndex?: number;
    delay?: number;
    repeat?: number;
    dispose?: number;
  }

  export interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array | Uint8ClampedArray,
      width: number,
      height: number,
      opts?: WriteFrameOptions,
    ): void;
    writeHeader(): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
    readonly buffer: ArrayBuffer;
    readonly stream: unknown;
  }

  export function GIFEncoder(opts?: GIFEncoderOptions): GIFEncoderInstance;

  export interface QuantizeOptions {
    format?: "rgb565" | "rgb444" | "rgba4444";
    oneBitAlpha?: boolean | number;
    clearAlpha?: boolean;
    clearAlphaThreshold?: number;
    clearAlphaColor?: number;
  }

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: QuantizeOptions,
  ): Palette;
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: "rgb565" | "rgb444" | "rgba4444",
  ): Uint8Array;
  export function prequantize(
    rgba: Uint8Array | Uint8ClampedArray,
    opts?: Record<string, unknown>,
  ): void;
  export function nearestColorIndex(palette: Palette, pixel: number[]): number;
  export default GIFEncoder;
}
