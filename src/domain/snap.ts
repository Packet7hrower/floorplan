import type { FloorplanProjectV1, Point } from "./types";
import { distance, furnitureCorners, wallVertices } from "./geometry";

export type SnapKind = "endpoint" | "closure" | "center" | "edge" | "angle" | "alignment" | "grid";

export interface SnapCandidate {
  point: Point;
  kind: SnapKind;
  label: string;
  distance: number;
}

export interface SnapOptions {
  enabled: boolean;
  altKey: boolean;
  shiftKey: boolean;
  thresholdScreenPx: number;
  screenPixelsPerMil: number;
  origin?: Point;
}

const PRIORITY: Record<SnapKind, number> = {
  closure: 0,
  endpoint: 0,
  center: 1,
  edge: 1,
  angle: 2,
  alignment: 2,
  grid: 3,
};

function constrained45(point: Point, origin: Point): Point {
  const radius = distance(point, origin);
  const angle = Math.atan2(point.y - origin.y, point.x - origin.x);
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  return { x: origin.x + Math.cos(snapped) * radius, y: origin.y + Math.sin(snapped) * radius };
}

export function collectSnapCandidates(project: FloorplanProjectV1, point: Point, options: SnapOptions): SnapCandidate[] {
  const threshold = options.thresholdScreenPx / Math.max(options.screenPixelsPerMil, 0.000001);
  const origin = options.origin;
  if (options.shiftKey && origin && (!options.enabled || options.altKey)) {
    const result = constrained45(point, origin);
    return [{ point: result, kind: "angle", label: "45° constraint", distance: distance(point, result) }];
  }
  if (!options.enabled || options.altKey) return [];
  const candidates: SnapCandidate[] = [];
  const add = (candidatePoint: Point, kind: SnapKind, label: string) => {
    const candidateDistance = distance(point, candidatePoint);
    if (candidateDistance <= threshold) candidates.push({ point: candidatePoint, kind, label, distance: candidateDistance });
  };
  project.vertices.forEach((vertex, index) => add({ x: vertex.x, y: vertex.y }, index === 0 && origin ? "closure" : "endpoint", index === 0 && origin ? "Close room" : "Wall endpoint"));
  project.walls.forEach((wall) => {
    const [start, end] = wallVertices(project, wall);
    add({ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }, "center", "Wall center");
  });
  project.furniture.forEach((item) => {
    furnitureCorners(item).forEach((corner) => add(corner, "edge", "Furniture edge"));
  });
  project.openings.forEach((opening) => {
    const wall = project.walls.find((item) => item.id === opening.wallId);
    if (!wall) return;
    const [start, end] = wallVertices(project, wall);
    const length = distance(start, end);
    for (const offset of [opening.offsetFromStart, opening.offsetFromStart + opening.width]) {
      add({ x: start.x + ((end.x - start.x) * offset) / length, y: start.y + ((end.y - start.y) * offset) / length }, "edge", "Opening edge");
    }
  });
  if (origin) {
    const angular = constrained45(point, origin);
    add(angular, "angle", "45° angle");
    add({ x: point.x, y: origin.y }, "alignment", "Perpendicular alignment");
    add({ x: origin.x, y: point.y }, "alignment", "Parallel alignment");
  }
  const spacing = project.settings.gridSpacing;
  add({ x: Math.round(point.x / spacing) * spacing, y: Math.round(point.y / spacing) * spacing }, "grid", "Grid");
  return candidates.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || a.distance - b.distance);
}

export function snapPoint(project: FloorplanProjectV1, point: Point, options: SnapOptions): { point: Point; candidate: SnapCandidate | null } {
  const candidate = collectSnapCandidates(project, point, options)[0] ?? null;
  return { point: candidate?.point ?? point, candidate };
}
