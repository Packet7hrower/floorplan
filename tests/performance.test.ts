import { describe, expect, it } from "vitest";
import { createEmptyProject } from "../src/domain/defaults";
import type { FloorplanProjectV1 } from "../src/domain/types";
import { createPlanSvg } from "../src/export/planSvg";
import { validateProject } from "../src/domain/validation";

function createStressProject(): FloorplanProjectV1 {
  const project = createEmptyProject("50-wall acceptance fixture");
  const radius = 2_000_000;
  project.vertices = Array.from({ length: 50 }, (_, index) => {
    const angle = (index / 50) * Math.PI * 2;
    return { id: "v-" + index, x: Math.round(Math.cos(angle) * radius), y: Math.round(Math.sin(angle) * radius) };
  });
  project.walls = project.vertices.map((vertex, index) => ({
    id: "w-" + index,
    startVertexId: vertex.id,
    endVertexId: project.vertices[(index + 1) % project.vertices.length].id,
  }));
  project.openings = project.walls.map((wall, index) => ({
    id: "opening-" + index,
    wallId: wall.id,
    kind: "window" as const,
    offsetFromStart: 100_000,
    width: 36_000,
    height: 48_000,
  }));
  project.furniture = Array.from({ length: 100 }, (_, index) => ({
    id: "furniture-" + index,
    catalogType: "dining-chair" as const,
    x: (index % 10 - 4.5) * 36_000,
    y: (Math.floor(index / 10) - 4.5) * 36_000,
    rotationDegrees: (index % 4) * 15,
    width: 20_000,
    depth: 22_000,
    height: 36_000,
  }));
  return project;
}

describe("MVP acceptance-scale project", () => {
  it("validates and renders 50 walls, 50 openings, and 100 furniture objects responsively", () => {
    const project = createStressProject();
    const start = performance.now();
    expect(validateProject(project)).toEqual(project);
    const svg = createPlanSvg(project, { includeDimensions: true });
    const elapsed = performance.now() - start;
    expect(svg.match(/class="opening-cut"/g)).toHaveLength(50);
    expect(svg.match(/class="furniture"/g)).toHaveLength(100);
    expect(elapsed).toBeLessThan(1_500);
  });
});
