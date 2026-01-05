export interface Point2D {
  x: number;
  y: number;
}

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export enum BlendMode {
  Normal = 'normal',
  Multiply = 'multiply',
  Screen = 'screen',
}

export enum PointerType {
  Stylus = 'pen',
  Touch = 'touch',
  Mouse = 'mouse',
}

export interface InputPoint {
  x: number;
  y: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
  timestamp: number;
  pointerType: PointerType;
}

export interface BrushConfig {
  baseSize: number;
  color: Color;
  pressureSizeCurve: (pressure: number) => number;
  pressureOpacityCurve: (pressure: number) => number;
  blendMode: BlendMode;
  spacing: number;
}

export interface StampPlot {
  position: Point2D;
  size: number;
  opacity: number;
  color: Color;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  zIndex: number;
  tileData: Map<string, Uint16Array>;
  createdAt: number;
}

export interface Canvas {
  id: string;
  width: number;
  height: number;
  zoomLevel: number;
  panOffset: Point2D;
  rotationAngle: number;
  layers: Layer[];
  activeLayerId: string;
  createdAt: number;
  modifiedAt: number;
}

export interface Stroke {
  id: string;
  layerId: string;
  points: InputPoint[];
  brushConfig: BrushConfig;
  affectedTiles: string[];
  timestamp: number;
  duration: number;
}

export type ActionType = 'stroke' | 'layerPropChange' | 'layerAdd' | 'layerDelete';

export interface HistoryEntry {
  id: string;
  actionType: ActionType;
  layerId: string;
  data: unknown;
  timestamp: number;
  inverseData: unknown;
}

export type GestureType = 'pinch' | 'pan' | 'rotate' | 'twoFingerTap' | 'threeFingerTap';

export interface GestureData {
  center: Point2D;
  scale?: number;
  angle?: number;
  displacement?: Point2D;
}
