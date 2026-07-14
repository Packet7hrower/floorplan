import type { FloorplanProjectV1, FurnitureType, LengthMils } from "./types";

export const MILE_PER_INCH = 1_000;
export const DEFAULT_WALL_THICKNESS = 4_500;
export const DEFAULT_WALL_HEIGHT = 96_000;
export const DEFAULT_GRID_SPACING = 6_000;
export const DEFAULT_DOOR = { width: 36_000, height: 80_000 } as const;
export const DEFAULT_WINDOW = { width: 48_000, height: 48_000, sillHeight: 36_000 } as const;
export const OPENING_END_CLEARANCE = 2_000;
export const MAX_LENGTH_MILS = 10_000_000;

export interface FurnitureDefinition {
  label: string;
  width: LengthMils;
  depth: LengthMils;
  height: LengthMils;
}

export const FURNITURE_CATALOG: Record<FurnitureType, FurnitureDefinition> = {
  desk: { label: "Desk", width: 60_000, depth: 30_000, height: 30_000 },
  "office-chair": { label: "Office chair", width: 27_000, depth: 27_000, height: 44_000 },
  "dining-chair": { label: "Dining chair", width: 20_000, depth: 22_000, height: 36_000 },
  bookshelf: { label: "Bookshelf", width: 36_000, depth: 12_000, height: 72_000 },
  sofa: { label: "Sofa", width: 84_000, depth: 36_000, height: 34_000 },
  table: { label: "Table", width: 60_000, depth: 36_000, height: 30_000 },
  bed: { label: "Bed", width: 60_000, depth: 80_000, height: 24_000 },
  tv: { label: "TV", width: 48_000, depth: 4_000, height: 28_000 },
  "tv-stand": { label: "TV stand", width: 60_000, depth: 18_000, height: 24_000 },
  "computer-monitor": { label: "Computer / monitor", width: 24_000, depth: 8_000, height: 18_000 },
  speaker: { label: "Speaker", width: 12_000, depth: 12_000, height: 36_000 },
  cabinet: { label: "Cabinet", width: 36_000, depth: 18_000, height: 72_000 },
  dresser: { label: "Dresser", width: 60_000, depth: 20_000, height: 36_000 },
};

export function createEmptyProject(name = "Untitled floorplan"): FloorplanProjectV1 {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name,
    displayUnit: "ft",
    settings: {
      wallThickness: DEFAULT_WALL_THICKNESS,
      wallHeight: DEFAULT_WALL_HEIGHT,
      gridSpacing: DEFAULT_GRID_SPACING,
      snappingEnabled: true,
      showAllWallDimensions: false,
    },
    vertices: [],
    walls: [],
    openings: [],
    furniture: [],
    updatedAt: new Date().toISOString(),
  };
}
