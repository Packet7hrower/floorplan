import { generateUuid } from "../utils/uuid";
import { OPENING_END_CLEARANCE } from "./defaults";
import type {
  Bounds,
  FloorplanProjectV1,
  FurnitureInstance,
  Opening,
  Point,
  Vertex,
  Wall,
  WallAnchor,
} from "./types";

export const EPSILON = 0.001;

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function wallVertices(project: FloorplanProjectV1, wall: Wall): [Vertex, Vertex] {
  const start = project.vertices.find((vertex) => vertex.id === wall.startVertexId);
  const end = project.vertices.find((vertex) => vertex.id === wall.endVertexId);
  if (!start || !end) throw new Error("Wall " + wall.id + " has a broken vertex reference.");
  return [start, end];
}

export function wallLength(project: FloorplanProjectV1, wall: Wall): number {
  const [start, end] = wallVertices(project, wall);
  return distance(start, end);
}

export function polygonSignedArea(points: Point[]): number {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function orientation(a: Point, b: Point, c: Point): number {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}

function onSegment(a: Point, b: Point, c: Point): boolean {
  return b.x <= Math.max(a.x, c.x) + EPSILON && b.x + EPSILON >= Math.min(a.x, c.x) &&
    b.y <= Math.max(a.y, c.y) + EPSILON && b.y + EPSILON >= Math.min(a.y, c.y);
}

export function segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  if ((o1 > EPSILON && o2 < -EPSILON || o1 < -EPSILON && o2 > EPSILON) &&
      (o3 > EPSILON && o4 < -EPSILON || o3 < -EPSILON && o4 > EPSILON)) return true;
  if (Math.abs(o1) <= EPSILON && onSegment(a1, b1, a2)) return true;
  if (Math.abs(o2) <= EPSILON && onSegment(a1, b2, a2)) return true;
  if (Math.abs(o3) <= EPSILON && onSegment(b1, a1, b2)) return true;
  if (Math.abs(o4) <= EPSILON && onSegment(b1, a2, b2)) return true;
  return false;
}

export function isSimplePolygon(points: Point[]): boolean {
  if (points.length < 3 || Math.abs(polygonSignedArea(points)) < EPSILON) return false;
  for (let i = 0; i < points.length; i += 1) {
    const nextI = (i + 1) % points.length;
    if (distance(points[i], points[nextI]) < EPSILON) return false;
    for (let j = i + 1; j < points.length; j += 1) {
      const nextJ = (j + 1) % points.length;
      if (i === j || nextI === j || i === nextJ || nextI === nextJ) continue;
      if (segmentsIntersect(points[i], points[nextI], points[j], points[nextJ])) return false;
    }
  }
  return true;
}

export function orderedRoomVertices(project: FloorplanProjectV1): Vertex[] | null {
  if (project.walls.length < 3) return null;
  const unused = new Map(project.walls.map((wall) => [wall.id, wall]));
  const first = project.walls[0];
  const orderedIds = [first.startVertexId, first.endVertexId];
  unused.delete(first.id);
  let cursor = first.endVertexId;
  while (unused.size) {
    const next = [...unused.values()].find((wall) => wall.startVertexId === cursor || wall.endVertexId === cursor);
    if (!next) return null;
    cursor = next.startVertexId === cursor ? next.endVertexId : next.startVertexId;
    orderedIds.push(cursor);
    unused.delete(next.id);
  }
  if (cursor !== orderedIds[0]) return null;
  orderedIds.pop();
  if (new Set(orderedIds).size !== orderedIds.length) return null;
  const vertices = orderedIds.map((id) => project.vertices.find((vertex) => vertex.id === id)).filter(Boolean) as Vertex[];
  return vertices.length === orderedIds.length && isSimplePolygon(vertices) ? vertices : null;
}

export function isValidClosedRoom(project: FloorplanProjectV1): boolean {
  return orderedRoomVertices(project) !== null;
}

export function createRectangleGeometry(a: Point, b: Point): Pick<FloorplanProjectV1, "vertices" | "walls"> {
  if (Math.abs(a.x - b.x) < EPSILON || Math.abs(a.y - b.y) < EPSILON) throw new Error("Rectangle width and depth must be greater than zero.");
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const ids = Array.from({ length: 4 }, () => generateUuid());
  const vertices = [
    { id: ids[0], x: Math.round(minX), y: Math.round(minY) },
    { id: ids[1], x: Math.round(maxX), y: Math.round(minY) },
    { id: ids[2], x: Math.round(maxX), y: Math.round(maxY) },
    { id: ids[3], x: Math.round(minX), y: Math.round(maxY) },
  ];
  const walls = vertices.map((vertex, index) => ({
    id: generateUuid(),
    startVertexId: vertex.id,
    endVertexId: vertices[(index + 1) % vertices.length].id,
  }));
  return { vertices, walls };
}

export function resizeWallVertices(start: Point, end: Point, newLength: number, anchor: WallAnchor): [Point, Point] {
  const currentLength = distance(start, end);
  if (currentLength < EPSILON || newLength <= 0) throw new Error("Wall length must be greater than zero.");
  const direction = { x: (end.x - start.x) / currentLength, y: (end.y - start.y) / currentLength };
  if (anchor === "start") return [start, { x: start.x + direction.x * newLength, y: start.y + direction.y * newLength }];
  if (anchor === "end") return [{ x: end.x - direction.x * newLength, y: end.y - direction.y * newLength }, end];
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const half = newLength / 2;
  return [
    { x: midpoint.x - direction.x * half, y: midpoint.y - direction.y * half },
    { x: midpoint.x + direction.x * half, y: midpoint.y + direction.y * half },
  ];
}

export function rotatePoint(point: Point, center: Point, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const x = point.x - center.x;
  const y = point.y - center.y;
  return { x: center.x + x * cos - y * sin, y: center.y + x * sin + y * cos };
}

export function furnitureCorners(item: FurnitureInstance): Point[] {
  const center = { x: item.x, y: item.y };
  const halfWidth = item.width / 2;
  const halfDepth = item.depth / 2;
  return [
    { x: item.x - halfWidth, y: item.y - halfDepth },
    { x: item.x + halfWidth, y: item.y - halfDepth },
    { x: item.x + halfWidth, y: item.y + halfDepth },
    { x: item.x - halfWidth, y: item.y + halfDepth },
  ].map((point) => rotatePoint(point, center, item.rotationDegrees));
}

function axesForPolygon(points: Point[]): Point[] {
  return points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    const edge = { x: next.x - point.x, y: next.y - point.y };
    const length = Math.hypot(edge.x, edge.y);
    return { x: -edge.y / length, y: edge.x / length };
  });
}

function projection(points: Point[], axis: Point): [number, number] {
  const values = points.map((point) => point.x * axis.x + point.y * axis.y);
  return [Math.min(...values), Math.max(...values)];
}

export function polygonsOverlap(a: Point[], b: Point[], touchingIsOverlap = true): boolean {
  for (const axis of [...axesForPolygon(a), ...axesForPolygon(b)]) {
    const [minA, maxA] = projection(a, axis);
    const [minB, maxB] = projection(b, axis);
    if (touchingIsOverlap ? maxA <= minB + EPSILON || maxB <= minA + EPSILON : maxA < minB - EPSILON || maxB < minA - EPSILON) return false;
  }
  return true;
}

export function wallRectangle(project: FloorplanProjectV1, wall: Wall): Point[] {
  const [start, end] = wallVertices(project, wall);
  const length = distance(start, end);
  const half = project.settings.wallThickness / 2;
  const normal = { x: -((end.y - start.y) / length) * half, y: ((end.x - start.x) / length) * half };
  return [
    { x: start.x + normal.x, y: start.y + normal.y },
    { x: end.x + normal.x, y: end.y + normal.y },
    { x: end.x - normal.x, y: end.y - normal.y },
    { x: start.x - normal.x, y: start.y - normal.y },
  ];
}

export function furnitureCollision(project: FloorplanProjectV1, candidate: FurnitureInstance, ignoreId?: string): string | null {
  const polygon = orderedRoomVertices(project);
  const corners = furnitureCorners(candidate);
  if (!polygon || corners.some((corner) => !pointInPolygon(corner, polygon))) return "wall";
  const wallCollision = project.walls.some((wall) => polygonsOverlap(corners, wallRectangle(project, wall)));
  if (wallCollision) return "wall";
  const other = project.furniture.find((item) => item.id !== ignoreId && polygonsOverlap(corners, furnitureCorners(item)));
  return other?.id ?? null;
}

export function validateOpeningPlacement(project: FloorplanProjectV1, opening: Opening, ignoreId?: string): string | null {
  const wall = project.walls.find((item) => item.id === opening.wallId);
  if (!wall) return "Opening references a missing wall.";
  const length = wallLength(project, wall);
  const start = opening.offsetFromStart;
  const end = start + opening.width;
  if (start < OPENING_END_CLEARANCE || end > length - OPENING_END_CLEARANCE) return "Keep openings at least 2 inches from each wall end.";
  const overlap = project.openings.find((item) => item.wallId === opening.wallId && item.id !== ignoreId &&
    start < item.offsetFromStart + item.width && end > item.offsetFromStart);
  return overlap ? "Openings cannot overlap." : null;
}

export function openingWorldPosition(project: FloorplanProjectV1, opening: Opening): { center: Point; angleDegrees: number } {
  const wall = project.walls.find((item) => item.id === opening.wallId);
  if (!wall) throw new Error("Opening references a missing wall.");
  const [start, end] = wallVertices(project, wall);
  const length = distance(start, end);
  const at = (opening.offsetFromStart + opening.width / 2) / length;
  return {
    center: { x: start.x + (end.x - start.x) * at, y: start.y + (end.y - start.y) * at },
    angleDegrees: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI,
  };
}

export function projectBounds(project: FloorplanProjectV1, padding = 0): Bounds {
  const points: Point[] = [...project.vertices, ...project.furniture.flatMap(furnitureCorners)];
  if (!points.length) return { minX: -60_000, minY: -60_000, maxX: 60_000, maxY: 60_000 };
  return {
    minX: Math.min(...points.map((point) => point.x)) - padding,
    minY: Math.min(...points.map((point) => point.y)) - padding,
    maxX: Math.max(...points.map((point) => point.x)) + padding,
    maxY: Math.max(...points.map((point) => point.y)) + padding,
  };
}

export function createDoorSwingPolygon(project: FloorplanProjectV1, opening: Opening, steps = 12): Point[] {
  if (opening.kind !== "door") return [];
  const wall = project.walls.find((item) => item.id === opening.wallId);
  if (!wall) return [];
  const [start, end] = wallVertices(project, wall);
  const length = distance(start, end);
  const direction = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
  const normalSign = opening.swing === "outward" ? -1 : 1;
  const normal = { x: -direction.y * normalSign, y: direction.x * normalSign };
  const hingeDistance = opening.hinge === "right" ? opening.offsetFromStart + opening.width : opening.offsetFromStart;
  const hinge = { x: start.x + direction.x * hingeDistance, y: start.y + direction.y * hingeDistance };
  const closedDirection = opening.hinge === "right" ? { x: -direction.x, y: -direction.y } : direction;
  const points = [hinge];
  for (let index = 0; index <= steps; index += 1) {
    const angle = (Math.PI / 2) * (index / steps);
    const radial = {
      x: closedDirection.x * Math.cos(angle) + normal.x * Math.sin(angle),
      y: closedDirection.y * Math.cos(angle) + normal.y * Math.sin(angle),
    };
    points.push({ x: hinge.x + radial.x * opening.width, y: hinge.y + radial.y * opening.width });
  }
  return points;
}

export function obstructedDoorIds(project: FloorplanProjectV1): Set<string> {
  const result = new Set<string>();
  for (const opening of project.openings.filter((item) => item.kind === "door")) {
    const swing = createDoorSwingPolygon(project, opening);
    if (project.furniture.some((item) => polygonsOverlap(swing, furnitureCorners(item)))) result.add(opening.id);
  }
  return result;
}
