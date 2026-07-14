import { createEmptyProject, FURNITURE_CATALOG } from "./defaults";
import type { FloorplanProjectV1 } from "./types";

export function createSampleProject(): FloorplanProjectV1 {
  const project = createEmptyProject("Sample room — 12 ft × 10 ft");
  project.vertices = [
    { id: "v1", x: 0, y: 0 },
    { id: "v2", x: 144_000, y: 0 },
    { id: "v3", x: 144_000, y: 120_000 },
    { id: "v4", x: 0, y: 120_000 },
  ];
  project.walls = [
    { id: "w1", startVertexId: "v1", endVertexId: "v2" },
    { id: "w2", startVertexId: "v2", endVertexId: "v3" },
    { id: "w3", startVertexId: "v3", endVertexId: "v4" },
    { id: "w4", startVertexId: "v4", endVertexId: "v1" },
  ];
  project.openings = [
    {
      id: "door-1",
      wallId: "w1",
      kind: "door",
      offsetFromStart: 18_000,
      width: 36_000,
      height: 80_000,
      hinge: "left",
      swing: "inward",
    },
    { id: "window-1", wallId: "w3", kind: "window", offsetFromStart: 48_000, width: 48_000, height: 48_000 },
  ];
  project.furniture = [
    {
      id: "desk-1",
      catalogType: "desk",
      x: 102_000,
      y: 94_000,
      rotationDegrees: 0,
      width: FURNITURE_CATALOG.desk.width,
      depth: FURNITURE_CATALOG.desk.depth,
      height: FURNITURE_CATALOG.desk.height,
    },
    {
      id: "chair-1",
      catalogType: "office-chair",
      x: 102_000,
      y: 62_000,
      rotationDegrees: 180,
      width: FURNITURE_CATALOG["office-chair"].width,
      depth: FURNITURE_CATALOG["office-chair"].depth,
      height: FURNITURE_CATALOG["office-chair"].height,
    },
  ];
  return project;
}
