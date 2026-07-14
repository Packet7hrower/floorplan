import { create } from "zustand";
import { DEFAULT_DOOR, DEFAULT_WINDOW, FURNITURE_CATALOG, createEmptyProject } from "../domain/defaults";
import {
  createRectangleGeometry,
  furnitureCollision,
  isValidClosedRoom,
  projectBounds,
  resizeWallVertices,
  validateOpeningPlacement,
  wallVertices,
} from "../domain/geometry";
import { createSampleProject } from "../domain/sample";
import type {
  FloorplanProjectV1,
  FurnitureInstance,
  FurnitureType,
  LengthMils,
  Opening,
  Point,
  Selection,
  Tool,
  Unit,
  WallAnchor,
} from "../domain/types";
import { validateProject } from "../domain/validation";

interface History {
  past: FloorplanProjectV1[];
  future: FloorplanProjectV1[];
}

interface ProjectState {
  project: FloorplanProjectV1;
  history: History;
  selection: Selection;
  tool: Tool;
  wallAnchor: WallAnchor;
  selectedFurnitureType: FurnitureType;
  view: "2d" | "3d";
  zoom: number;
  pan: Point;
  dirty: boolean;
  notice: string | null;
  error: string | null;
  setTool: (tool: Tool) => void;
  setWallAnchor: (anchor: WallAnchor) => void;
  setSelectedFurnitureType: (type: FurnitureType) => void;
  setSelection: (selection: Selection) => void;
  setView: (view: "2d" | "3d") => void;
  setViewport: (zoom: number, pan: Point) => void;
  setNotice: (notice: string | null) => void;
  setError: (error: string | null) => void;
  newProject: () => void;
  loadProject: (project: FloorplanProjectV1) => void;
  loadSample: () => void;
  addRectangle: (a: Point, b: Point) => void;
  appendWallVertex: (point: Point, closeVertexId?: string) => void;
  cancelDrawing: () => void;
  addOpening: (wallId: string, kind: "door" | "window") => void;
  addFurniture: (type: FurnitureType, point: Point) => void;
  resizeRectangle: (width: LengthMils, depth: LengthMils) => void;
  updateProject: (patch: Partial<Pick<FloorplanProjectV1, "name" | "displayUnit">>) => void;
  updateSettings: (patch: Partial<FloorplanProjectV1["settings"]>) => void;
  resizeWall: (wallId: string, length: LengthMils, anchor: WallAnchor) => void;
  updateOpening: (id: string, patch: Partial<Opening>) => void;
  updateFurniture: (id: string, patch: Partial<FurnitureInstance>) => void;
  moveFurnitureClamped: (id: string, target: Point) => void;
  deleteSelection: () => void;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
}

function clone(project: FloorplanProjectV1): FloorplanProjectV1 {
  return structuredClone(project);
}

function stamp(project: FloorplanProjectV1): FloorplanProjectV1 {
  return { ...project, updatedAt: new Date().toISOString() };
}

function commit(set: (value: Partial<ProjectState>) => void, state: ProjectState, next: FloorplanProjectV1, notice?: string): void {
  set({
    project: stamp(next),
    history: { past: [...state.history.past, clone(state.project)].slice(-100), future: [] },
    dirty: true,
    notice: notice ?? null,
    error: null,
  });
}

function mutationIsValid(project: FloorplanProjectV1): string | null {
  if (project.walls.length >= 3 && !isValidClosedRoom(project)) return "That change would create an invalid or self-intersecting room.";
  for (const opening of project.openings) {
    const issue = validateOpeningPlacement(project, opening, opening.id);
    if (issue) return issue;
  }
  for (const item of project.furniture) {
    const collision = furnitureCollision(project, item, item.id);
    if (collision) return "That change would create a solid collision.";
  }
  return null;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: createEmptyProject(),
  history: { past: [], future: [] },
  selection: null,
  tool: "select",
  wallAnchor: "start",
  selectedFurnitureType: "desk",
  view: "2d",
  zoom: 100,
  pan: { x: 0, y: 0 },
  dirty: false,
  notice: null,
  error: null,
  setTool: (tool) => set({ tool, error: null }),
  setWallAnchor: (wallAnchor) => set({ wallAnchor }),
  setSelectedFurnitureType: (selectedFurnitureType) => set({ selectedFurnitureType, tool: "furniture" }),
  setSelection: (selection) => set({ selection, ...(selection?.kind === "wall" ? { wallAnchor: "start" as const } : {}) }),
  setView: (view) => set({ view }),
  setViewport: (zoom, pan) => set({ zoom: Math.min(800, Math.max(10, zoom)), pan }),
  setNotice: (notice) => set({ notice }),
  setError: (error) => set({ error }),
  newProject: () => set({
    project: createEmptyProject(),
    history: { past: [], future: [] },
    selection: null,
    tool: "select",
    view: "2d",
    dirty: false,
    notice: "New project created.",
    error: null,
  }),
  loadProject: (input) => {
    const project = validateProject(input);
    const bounds = projectBounds(project, 16_000);
    const width = Math.max(bounds.maxX - bounds.minX, 1);
    const height = Math.max(bounds.maxY - bounds.minY, 1);
    const zoom = Math.min(800, Math.max(10, Math.min((760 * 200 * 100) / width, (560 * 200 * 100) / height)));
    set({
      project,
      history: { past: [], future: [] },
      selection: null,
      tool: "select",
      view: "2d",
      dirty: false,
      notice: "Project opened.",
      error: null,
      pan: { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 },
      zoom,
    });
  },
  loadSample: () => {
    const state = get();
    const sample = createSampleProject();
    commit(set, state, sample, "Editable sample room loaded.");
    set({ selection: null, tool: "select", pan: { x: 72_000, y: 60_000 }, zoom: 90 });
  },
  addRectangle: (a, b) => {
    const state = get();
    if (state.project.walls.length) {
      set({ error: "The MVP supports one room. Start a new project before drawing another." });
      return;
    }
    try {
      const geometry = createRectangleGeometry(a, b);
      commit(set, state, { ...state.project, ...geometry }, "Rectangle room created.");
      set({ tool: "select", selection: { kind: "wall", id: geometry.walls[0].id } });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Rectangle could not be created." });
    }
  },
  appendWallVertex: (point, closeVertexId) => {
    const state = get();
    const project = clone(state.project);
    if (project.walls.length && isValidClosedRoom(project)) {
      set({ error: "The room is already closed." });
      return;
    }
    if (!project.vertices.length) {
      project.vertices.push({ id: crypto.randomUUID(), x: Math.round(point.x), y: Math.round(point.y) });
      commit(set, state, project);
      return;
    }
    const previous = project.vertices[project.vertices.length - 1];
    const endId = closeVertexId ?? crypto.randomUUID();
    if (!closeVertexId) project.vertices.push({ id: endId, x: Math.round(point.x), y: Math.round(point.y) });
    const wall = { id: crypto.randomUUID(), startVertexId: previous.id, endVertexId: endId };
    project.walls.push(wall);
    if (project.walls.length >= 3 && closeVertexId && !isValidClosedRoom(project)) {
      set({ error: "Closing this wall would create an invalid room." });
      return;
    }
    commit(set, state, project, closeVertexId ? "Room closed." : undefined);
    set({ selection: { kind: "wall", id: wall.id }, tool: closeVertexId ? "select" : "wall" });
  },
  cancelDrawing: () => {
    const state = get();
    if (state.tool === "wall" && !isValidClosedRoom(state.project) && state.project.vertices.length) {
      const next = clone(state.project);
      next.vertices = [];
      next.walls = [];
      next.openings = [];
      next.furniture = [];
      commit(set, state, next, "Wall drawing canceled.");
    }
    set({ tool: "select", selection: null, error: null });
  },
  addOpening: (wallId, kind) => {
    const state = get();
    if (!isValidClosedRoom(state.project)) {
      set({ error: "Close the room before adding openings." });
      return;
    }
    const wall = state.project.walls.find((item) => item.id === wallId);
    if (!wall) return;
    const [start, end] = wallVertices(state.project, wall);
    const wallLength = Math.hypot(end.x - start.x, end.y - start.y);
    const defaults = kind === "door" ? DEFAULT_DOOR : DEFAULT_WINDOW;
    const opening: Opening = {
      id: crypto.randomUUID(),
      wallId,
      kind,
      offsetFromStart: Math.round((wallLength - defaults.width) / 2),
      width: defaults.width,
      height: defaults.height,
      ...(kind === "door" ? { hinge: "left" as const, swing: "inward" as const } : {}),
    };
    const issue = validateOpeningPlacement(state.project, opening);
    if (issue) {
      set({ error: issue });
      return;
    }
    commit(set, state, { ...state.project, openings: [...state.project.openings, opening] }, (kind === "door" ? "Door" : "Window") + " added.");
    set({ selection: { kind: "opening", id: opening.id }, tool: "select" });
  },
  addFurniture: (type, point) => {
    const state = get();
    if (!isValidClosedRoom(state.project)) {
      set({ error: "Close the room before adding furniture." });
      return;
    }
    const definition = FURNITURE_CATALOG[type];
    const item: FurnitureInstance = {
      id: crypto.randomUUID(),
      catalogType: type,
      x: Math.round(point.x),
      y: Math.round(point.y),
      rotationDegrees: 0,
      width: definition.width,
      depth: definition.depth,
      height: definition.height,
    };
    if (furnitureCollision(state.project, item)) {
      set({ error: definition.label + " does not fit at that position." });
      return;
    }
    commit(set, state, { ...state.project, furniture: [...state.project.furniture, item] }, definition.label + " added.");
    set({ selection: { kind: "furniture", id: item.id }, tool: "select" });
  },
  resizeRectangle: (width, depth) => {
    const state = get();
    if (state.project.vertices.length !== 4 || !isValidClosedRoom(state.project)) {
      set({ error: "Exact room width and depth are available for four-wall rectangle rooms." });
      return;
    }
    const next = clone(state.project);
    const minX = Math.min(...next.vertices.map((vertex) => vertex.x));
    const maxX = Math.max(...next.vertices.map((vertex) => vertex.x));
    const minY = Math.min(...next.vertices.map((vertex) => vertex.y));
    const maxY = Math.max(...next.vertices.map((vertex) => vertex.y));
    const currentWidth = maxX - minX;
    const currentDepth = maxY - minY;
    const axisAligned = next.walls.every((wall) => {
      const [start, end] = wallVertices(next, wall);
      return start.x === end.x || start.y === end.y;
    });
    if (!axisAligned || currentWidth <= 0 || currentDepth <= 0) {
      set({ error: "Exact room width and depth require an axis-aligned rectangle." });
      return;
    }
    next.vertices.forEach((vertex) => {
      vertex.x = Math.round(minX + ((vertex.x - minX) / currentWidth) * width);
      vertex.y = Math.round(minY + ((vertex.y - minY) / currentDepth) * depth);
    });
    const issue = mutationIsValid(next);
    if (issue) set({ error: issue });
    else commit(set, state, next, "Room dimensions updated.");
  },
  updateProject: (patch) => {
    const state = get();
    commit(set, state, { ...state.project, ...patch });
  },
  updateSettings: (patch) => {
    const state = get();
    const next = clone(state.project);
    next.settings = { ...next.settings, ...patch };
    const issue = mutationIsValid(next);
    if (issue) set({ error: issue });
    else commit(set, state, next);
  },
  resizeWall: (wallId, length, anchor) => {
    const state = get();
    const next = clone(state.project);
    const wall = next.walls.find((item) => item.id === wallId);
    if (!wall) return;
    const [start, end] = wallVertices(next, wall);
    const [newStart, newEnd] = resizeWallVertices(start, end, length, anchor);
    Object.assign(start, { x: Math.round(newStart.x), y: Math.round(newStart.y) });
    Object.assign(end, { x: Math.round(newEnd.x), y: Math.round(newEnd.y) });
    const issue = mutationIsValid(next);
    if (issue) set({ error: issue });
    else commit(set, state, next, "Wall length updated.");
  },
  updateOpening: (id, patch) => {
    const state = get();
    const next = clone(state.project);
    const opening = next.openings.find((item) => item.id === id);
    if (!opening) return;
    Object.assign(opening, patch);
    const issue = validateOpeningPlacement(next, opening, opening.id);
    if (issue) set({ error: issue });
    else commit(set, state, next);
  },
  updateFurniture: (id, patch) => {
    const state = get();
    const next = clone(state.project);
    const item = next.furniture.find((candidate) => candidate.id === id);
    if (!item) return;
    Object.assign(item, patch);
    const collision = furnitureCollision(next, item, id);
    if (collision) set({ error: "That size or rotation would create a solid collision." });
    else commit(set, state, next);
  },
  moveFurnitureClamped: (id, target) => {
    const state = get();
    const source = state.project.furniture.find((item) => item.id === id);
    if (!source) return;
    let best = { x: source.x, y: source.y };
    for (let step = 1; step <= 40; step += 1) {
      const ratio = step / 40;
      const candidate = { ...source, x: Math.round(source.x + (target.x - source.x) * ratio), y: Math.round(source.y + (target.y - source.y) * ratio) };
      if (furnitureCollision(state.project, candidate, id)) break;
      best = { x: candidate.x, y: candidate.y };
    }
    if (best.x === source.x && best.y === source.y) {
      set({ notice: "Furniture stopped at the nearest solid boundary." });
      return;
    }
    const next = clone(state.project);
    const item = next.furniture.find((candidate) => candidate.id === id);
    if (item) Object.assign(item, best);
    commit(set, state, next, best.x === target.x && best.y === target.y ? undefined : "Furniture stopped at the nearest solid boundary.");
  },
  deleteSelection: () => {
    const state = get();
    if (!state.selection) return;
    const next = clone(state.project);
    if (state.selection.kind === "furniture") next.furniture = next.furniture.filter((item) => item.id !== state.selection?.id);
    if (state.selection.kind === "opening") next.openings = next.openings.filter((item) => item.id !== state.selection?.id);
    if (state.selection.kind === "wall") {
      const wall = next.walls.find((item) => item.id === state.selection?.id);
      if (!wall || next.walls.length <= 3) {
        set({ error: "A room must retain at least three usable walls." });
        return;
      }
      next.walls = next.walls.filter((item) => item.id !== wall.id);
      next.openings = next.openings.filter((item) => item.wallId !== wall.id);
      const referenced = new Set(next.walls.flatMap((item) => [item.startVertexId, item.endVertexId]));
      next.vertices = next.vertices.filter((item) => referenced.has(item.id));
      if (!isValidClosedRoom(next)) {
        set({ error: "Deleting that wall would open or invalidate the room." });
        return;
      }
    }
    commit(set, state, next, "Selection deleted.");
    set({ selection: null });
  },
  undo: () => {
    const state = get();
    const previous = state.history.past.at(-1);
    if (!previous) return;
    set({
      project: clone(previous),
      history: { past: state.history.past.slice(0, -1), future: [clone(state.project), ...state.history.future].slice(0, 100) },
      selection: null,
      dirty: true,
      notice: "Undid last change.",
      error: null,
    });
  },
  redo: () => {
    const state = get();
    const next = state.history.future[0];
    if (!next) return;
    set({
      project: clone(next),
      history: { past: [...state.history.past, clone(state.project)].slice(-100), future: state.history.future.slice(1) },
      selection: null,
      dirty: true,
      notice: "Redid change.",
      error: null,
    });
  },
  markSaved: () => set({ dirty: false, notice: "Project saved." }),
}));

export function unitLabel(unit: Unit): string {
  return unit === "ft" ? "Feet" : "Inches";
}
