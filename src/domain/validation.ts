import { z } from "zod";
import { furnitureCollision, isValidClosedRoom, validateOpeningPlacement, wallLength } from "./geometry";
import type { FloorplanProjectV1 } from "./types";

const id = z.string().min(1);
const mils = z.number().int().positive().max(10_000_000);
const coordinate = z.number().int().min(-10_000_000).max(10_000_000);

export const projectV1Schema = z.object({
  schemaVersion: z.literal(1),
  id,
  name: z.string().trim().min(1).max(120),
  displayUnit: z.enum(["in", "ft"]),
  settings: z.object({
    wallThickness: mils,
    wallHeight: mils,
    gridSpacing: mils,
    snappingEnabled: z.boolean(),
    showAllWallDimensions: z.boolean(),
  }).strict(),
  vertices: z.array(z.object({ id, x: coordinate, y: coordinate }).strict()).max(1_000),
  walls: z.array(z.object({ id, startVertexId: id, endVertexId: id }).strict()).max(1_000),
  openings: z.array(z.object({
    id,
    wallId: id,
    kind: z.enum(["door", "window"]),
    offsetFromStart: z.number().int().nonnegative().max(10_000_000),
    width: mils,
    height: mils,
    hinge: z.enum(["left", "right"]).optional(),
    swing: z.enum(["inward", "outward"]).optional(),
  }).strict()).max(1_000),
  furniture: z.array(z.object({
    id,
    catalogType: z.enum([
      "desk", "office-chair", "dining-chair", "bookshelf", "sofa", "table", "bed",
      "tv", "tv-stand", "computer-monitor", "speaker", "cabinet", "dresser",
    ]),
    x: coordinate,
    y: coordinate,
    rotationDegrees: z.number().finite().min(-360_000).max(360_000),
    width: mils,
    depth: mils,
    height: mils,
  }).strict()).max(2_000),
  updatedAt: z.string().datetime(),
}).strict();

export class ProjectValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join(" "));
  }
}

function ensureUnique(values: string[], label: string, issues: string[]): void {
  if (new Set(values).size !== values.length) issues.push(label + " IDs must be unique.");
}

export function validateProject(input: unknown): FloorplanProjectV1 {
  if (!input || typeof input !== "object") throw new ProjectValidationError(["Project data must be an object."]);
  const version = (input as { schemaVersion?: unknown }).schemaVersion;
  if (version !== 1) throw new ProjectValidationError(["Unsupported project schema version: " + String(version) + "."]);
  const result = projectV1Schema.safeParse(input);
  if (!result.success) {
    throw new ProjectValidationError(result.error.issues.map((issue) => (issue.path.join(".") || "project") + ": " + issue.message));
  }
  const project = result.data as FloorplanProjectV1;
  const issues: string[] = [];
  ensureUnique(project.vertices.map((item) => item.id), "Vertex", issues);
  ensureUnique(project.walls.map((item) => item.id), "Wall", issues);
  ensureUnique(project.openings.map((item) => item.id), "Opening", issues);
  ensureUnique(project.furniture.map((item) => item.id), "Furniture", issues);
  const vertexIds = new Set(project.vertices.map((item) => item.id));
  project.walls.forEach((wall) => {
    const referencesValid = vertexIds.has(wall.startVertexId) && vertexIds.has(wall.endVertexId);
    if (!referencesValid) issues.push("Wall " + wall.id + " references a missing vertex.");
    if (wall.startVertexId === wall.endVertexId) issues.push("Wall " + wall.id + " is collapsed.");
    if (referencesValid && wallLength(project, wall) < 1) issues.push("Wall " + wall.id + " is collapsed.");
  });
  const hasBrokenReferences = issues.some((issue) => issue.includes("missing vertex"));
  if (project.walls.length > 0 && issues.length === 0 && !isValidClosedRoom(project)) issues.push("Walls must form one closed, non-self-intersecting polygon.");
  project.openings.forEach((opening) => {
    if (opening.kind === "door" && (!opening.hinge || !opening.swing)) issues.push("Door " + opening.id + " requires hinge and swing settings.");
    const placementIssue = !hasBrokenReferences && project.walls.some((wall) => wall.id === opening.wallId) ? validateOpeningPlacement(project, opening, opening.id) : hasBrokenReferences ? null : "Opening references a missing wall.";
    if (placementIssue) issues.push("Opening " + opening.id + ": " + placementIssue);
  });
  project.furniture.forEach((item) => {
    if (hasBrokenReferences) return;
    const collision = furnitureCollision(project, item, item.id);
    if (collision) issues.push("Furniture " + item.id + " has a solid collision with " + collision + ".");
  });
  if (issues.length) throw new ProjectValidationError(issues);
  return project;
}

export function migrateProject(input: unknown): FloorplanProjectV1 {
  if (!input || typeof input !== "object") throw new ProjectValidationError(["Project data must be an object."]);
  const version = (input as { schemaVersion?: unknown }).schemaVersion;
  switch (version) {
    case 1:
      return validateProject(input);
    default:
      throw new ProjectValidationError(["Unsupported project schema version: " + String(version) + "."]);
  }
}
