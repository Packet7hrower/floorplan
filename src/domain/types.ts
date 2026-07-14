export type LengthMils = number;
export type Unit = "in" | "ft";
export type WallAnchor = "start" | "center" | "end";
export type Tool = "select" | "wall" | "rectangle" | "door" | "window" | "furniture";
export type FurnitureType =
  | "desk"
  | "office-chair"
  | "dining-chair"
  | "bookshelf"
  | "sofa"
  | "table"
  | "bed"
  | "tv"
  | "tv-stand"
  | "computer-monitor"
  | "speaker"
  | "cabinet"
  | "dresser";

export interface FloorplanProjectV1 {
  schemaVersion: 1;
  id: string;
  name: string;
  displayUnit: Unit;
  settings: {
    wallThickness: LengthMils;
    wallHeight: LengthMils;
    gridSpacing: LengthMils;
    snappingEnabled: boolean;
    showAllWallDimensions: boolean;
  };
  vertices: Vertex[];
  walls: Wall[];
  openings: Opening[];
  furniture: FurnitureInstance[];
  updatedAt: string;
}

export interface Vertex {
  id: string;
  x: LengthMils;
  y: LengthMils;
}

export interface Wall {
  id: string;
  startVertexId: string;
  endVertexId: string;
}

export interface Opening {
  id: string;
  wallId: string;
  kind: "door" | "window";
  offsetFromStart: LengthMils;
  width: LengthMils;
  height: LengthMils;
  hinge?: "left" | "right";
  swing?: "inward" | "outward";
}

export interface FurnitureInstance {
  id: string;
  catalogType: FurnitureType;
  x: LengthMils;
  y: LengthMils;
  rotationDegrees: number;
  width: LengthMils;
  depth: LengthMils;
  height: LengthMils;
}

export type Selection =
  | { kind: "wall"; id: string }
  | { kind: "opening"; id: string }
  | { kind: "furniture"; id: string }
  | null;

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
