import { beforeEach, describe, expect, it } from "vitest";
import { serializeProject } from "../src/domain/serialization";
import { isValidClosedRoom, wallLength } from "../src/domain/geometry";
import { useProjectStore } from "../src/store/projectStore";

describe("precision project commands", () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
    useProjectStore.getState().addRectangle({ x: 0, y: 0 }, { x: 144_000, y: 120_000 });
  });

  it("nudges, copies, pastes, rotates, and undoes furniture as project commands", () => {
    useProjectStore.getState().addFurniture("desk", { x: 72_000, y: 60_000 });
    const original = useProjectStore.getState().project.furniture[0];
    useProjectStore.getState().nudgeSelection(250, 0);
    expect(useProjectStore.getState().project.furniture[0].x).toBe(original.x + 250);

    useProjectStore.getState().rotateSelectedFurniture90();
    expect(useProjectStore.getState().project.furniture[0].rotationDegrees).toBe(90);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.furniture[0].rotationDegrees).toBe(0);

    useProjectStore.getState().setSelection({ kind: "furniture", id: original.id });
    useProjectStore.getState().copySelectedFurniture();
    useProjectStore.getState().pasteFurniture();
    expect(useProjectStore.getState().project.furniture).toHaveLength(2);
    expect(new Set(useProjectStore.getState().project.furniture.map((item) => item.id)).size).toBe(2);
  });

  it("moves room vertices and openings while preserving valid geometry", () => {
    const vertex = useProjectStore.getState().project.vertices[0];
    useProjectStore.getState().moveVertexClamped(vertex.id, { x: 2_000, y: 2_000 });
    expect(useProjectStore.getState().project.vertices.find((candidate) => candidate.id === vertex.id)).toMatchObject({ x: 2_000, y: 2_000 });

    const wall = useProjectStore.getState().project.walls[1];
    useProjectStore.getState().addOpening(wall.id, "door");
    const opening = useProjectStore.getState().project.openings[0];
    useProjectStore.getState().moveOpeningClamped(opening.id, opening.offsetFromStart + 1_000);
    expect(useProjectStore.getState().project.openings[0].offsetFromStart).toBe(opening.offsetFromStart + 1_000);
  });

  it("reorients a selected wall without removing its connected drawing data", () => {
    const state = useProjectStore.getState();
    const wall = state.project.walls[0];
    state.addOpening(wall.id, "door");
    const originalLength = wallLength(state.project, wall);
    state.setWallOrientation(wall.id, 20, "start");

    const next = useProjectStore.getState().project;
    expect(isValidClosedRoom(next)).toBe(true);
    expect(next.walls).toHaveLength(4);
    expect(next.openings).toHaveLength(1);
    expect(next.openings[0].wallId).toBe(wall.id);
    expect(wallLength(next, next.walls[0])).toBeCloseTo(originalLength, 0);
  });

  it("keeps UI command state out of schema-version-1 project files", () => {
    useProjectStore.getState().addFurniture("desk", { x: 72_000, y: 60_000 });
    useProjectStore.getState().copySelectedFurniture();
    const json = serializeProject(useProjectStore.getState().project);
    expect(json).toContain('"schemaVersion": 1');
    expect(json).not.toContain("furnitureClipboard");
    expect(json).not.toContain("lastMutationKey");
    expect(json).not.toContain("recoveryState");
  });
});
