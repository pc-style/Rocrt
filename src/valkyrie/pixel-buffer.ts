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
  dst: Float32Array,
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
  buffer: Float32Array,
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

export function clearBuffer(buffer: Float32Array): void {
  buffer.fill(0);
}

export function drawCircle(
  buffer: Float32Array,
  centerX: number,
  centerY: number,
  radius: number,
  color: Color
): void {
  const r = Math.max(0.5, radius);
  const minX = Math.max(0, Math.floor(centerX - r - 1));
  const maxX = Math.min(TILE_SIZE - 1, Math.ceil(centerX + r + 1));
  const minY = Math.max(0, Math.floor(centerY - r - 1));
  const maxY = Math.min(TILE_SIZE - 1, Math.ceil(centerY + r + 1));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - centerX;
      const dy = y + 0.5 - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= r + 1) {
        // Hard edge with 1px anti-aliasing
        const alpha = Math.max(0, Math.min(1, r + 0.5 - dist));
        
        if (alpha > 0.01) {
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
}

export function drawLine(
  buffer: Float32Array,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  color: Color
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length < 0.1) {
    drawCircle(buffer, x0, y0, radius, color);
    return;
  }

  // Draw a capsule shape (line with round ends)
  const r = Math.max(0.5, radius);
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - r - 1));
  const maxX = Math.min(TILE_SIZE - 1, Math.ceil(Math.max(x0, x1) + r + 1));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - r - 1));
  const maxY = Math.min(TILE_SIZE - 1, Math.ceil(Math.max(y0, y1) + r + 1));

  // Normalized direction
  const nx = dx / length;
  const ny = dy / length;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5 - x0;
      const py = y + 0.5 - y0;

      // Project point onto line segment
      const t = Math.max(0, Math.min(length, px * nx + py * ny));
      
      // Closest point on line segment
      const closestX = t * nx;
      const closestY = t * ny;
      
      // Distance from pixel to closest point
      const distX = px - closestX;
      const distY = py - closestY;
      const dist = Math.sqrt(distX * distX + distY * distY);

      if (dist <= r + 1) {
        const alpha = Math.max(0, Math.min(1, r + 0.5 - dist));
        
        if (alpha > 0.01) {
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
}
