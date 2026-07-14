import { describe, expect, it } from "vitest";
import { createEmptyProject } from "../src/domain/defaults";
import {
  createDoorSwingPolygon,
  createRectangleGeometry,
  furnitureCollision,
  isSimplePolygon,
  isValidClosedRoom,
  obstructedDoorIds,
  polygonSignedArea,
  polygonsOverlap,
  resizeWallVertices,
  validateOpeningPlacement,
} from "../src/domain/geometry";
import { createSampleProject } from "../src/domain/sample";

describe("room polygon geometry", () => {
  it("creates a closed rectangle with stable connected vertices", () => {
    const project = { ...createEmptyProject(), ...createRectangleGeometry({ x: 0, y: 0 }, { x: 144_000, y: 120_000 }) };
    expect(project.vertices).toHaveLength(4);
    expect(project.walls).toHaveLength(4);
    expect(isValidClosedRoom(project)).toBe(true);
    expect(Math.abs(polygonSignedArea(project.vertices))).toBe(17_280_000_000);
  });

  it("recognizes winding and rejects self-intersection", () => {
    const clockwise = [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 0 }];
    expect(polygonSignedArea(clockwise)).toBeLessThan(0);
    expect(isSimplePolygon(clockwise)).toBe(true);
    expect(isSimplePolygon([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }])).toBe(false);
  });

  it("resizes using start, center, and end anchors", () => {
    expect(resizeWallVertices({ x: 0, y: 0 }, { x: 10, y: 0 }, 20, "start")).toEqual([{ x: 0, y: 0 }, { x: 20, y: 0 }]);
    expect(resizeWallVertices({ x: 0, y: 0 }, { x: 10, y: 0 }, 20, "end")).toEqual([{ x: -10, y: 0 }, { x: 10, y: 0 }]);
    expect(resizeWallVertices({ x: 0, y: 0 }, { x: 10, y: 0 }, 20, "center")).toEqual([{ x: -5, y: 0 }, { x: 15, y: 0 }]);
  });
});

describe("openings and collision geometry", () => {
  it("enforces wall end clearance and opening overlap", () => {
    const project = createSampleProject();
    expect(validateOpeningPlacement(project, project.openings[0], project.openings[0].id)).toBeNull();
    expect(validateOpeningPlacement(project, { ...project.openings[0], id: "too-close", offsetFromStart: 1_000 })).toContain("2 inches");
    expect(validateOpeningPlacement(project, { ...project.openings[0], id: "overlap", offsetFromStart: 20_000 })).toContain("overlap");
  });

  it("uses SAT for oriented furniture and hard collisions", () => {
    const project = createSampleProject();
    const desk = project.furniture[0];
    const chair = project.furniture[1];
    expect(polygonsOverlap(
      [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 15 }, { x: 5, y: 15 }],
    )).toBe(true);
    expect(furnitureCollision(project, desk, desk.id)).toBeNull();
    expect(furnitureCollision(project, { ...chair, x: desk.x, y: desk.y }, chair.id)).toBe(desk.id);
  });

  it("treats door arcs as advisory warnings", () => {
    const project = createSampleProject();
    const door = project.openings[0];
    const swing = createDoorSwingPolygon(project, door);
    expect(swing.length).toBeGreaterThan(10);
    project.furniture[1] = { ...project.furniture[1], x: 36_000, y: 20_000, width: 10_000, depth: 10_000 };
    expect(obstructedDoorIds(project).has(door.id)).toBe(true);
  });
});
