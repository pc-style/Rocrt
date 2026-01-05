import { TILE_SIZE } from '../core/config';
import type { Color } from '../core/types';

export function colorToFloat16(color: Color): [number, number, number, number] {
  return [
    color.r / 255,
    color.g / 255,
    color.b / 255,
    color.a / 255,
  ];
}

export function sRGBToLinear(value: number): number {
  return value <= 0.04045
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

export function linearToSRGB(value: number): number {
  return value <= 0.0031308
    ? value * 12.92
    : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
}

export function blendPixel(
  dst: Uint16Array,
  offset: number,
  srcR: number,
  srcG: number,
  srcB: number,
  srcA: number
): void {
  const dstR = dst[offset]!;
  const dstG = dst[offset + 1]!;
  const dstB = dst[offset + 2]!;
  const dstA = dst[offset + 3]!;

  const outA = srcA + dstA * (1 - srcA);
  
  if (outA > 0) {
    dst[offset] = (srcR * srcA + dstR * dstA * (1 - srcA)) / outA;
    dst[offset + 1] = (srcG * srcA + dstG * dstA * (1 - srcA)) / outA;
    dst[offset + 2] = (srcB * srcA + dstB * dstA * (1 - srcA)) / outA;
    dst[offset + 3] = outA;
  }
}

export function setPixel(
  buffer: Uint16Array,
  x: number,
  y: number,
  color: Color,
  blend: boolean = true
): void {
  if (x < 0 || x >= TILE_SIZE || y < 0 || y >= TILE_SIZE) return;

  const offset = (y * TILE_SIZE + x) * 4;
  const [r, g, b, a] = colorToFloat16(color);
  
  const linearR = sRGBToLinear(r);
  const linearG = sRGBToLinear(g);
  const linearB = sRGBToLinear(b);

  if (blend) {
    blendPixel(buffer, offset, linearR, linearG, linearB, a);
  } else {
    buffer[offset] = linearR;
    buffer[offset + 1] = linearG;
    buffer[offset + 2] = linearB;
    buffer[offset + 3] = a;
  }
}

export function clearBuffer(buffer: Uint16Array): void {
  buffer.fill(0);
}

export function drawCircle(
  buffer: Uint16Array,
  centerX: number,
  centerY: number,
  radius: number,
  color: Color
): void {
  const radiusSq = radius * radius;
  const minX = Math.max(0, Math.floor(centerX - radius));
  const maxX = Math.min(TILE_SIZE - 1, Math.ceil(centerX + radius));
  const minY = Math.max(0, Math.floor(centerY - radius));
  const maxY = Math.min(TILE_SIZE - 1, Math.ceil(centerY + radius));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distSq = dx * dx + dy * dy;

      if (distSq <= radiusSq) {
        const dist = Math.sqrt(distSq);
        const edgeFalloff = Math.max(0, 1 - dist / radius);
        const alpha = edgeFalloff * edgeFalloff;
        
        const pixelColor: Color = {
          r: color.r,
          g: color.g,
          b: color.b,
          a: Math.round(color.a * alpha),
        };
        
        setPixel(buffer, x, y, pixelColor, true);
      }
    }
  }
}
