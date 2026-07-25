import { create } from "zustand";
import type { FurnitureType } from "../domain/types";
import type { SnapKind } from "../domain/snap";

const STORAGE_KEY = "floorplan-ui-preferences-v1";

export type FurnitureCategory = "all" | "work" | "seating" | "storage" | "media" | "sleep";
export type CameraPreset = "isometric" | "top" | "eye" | "selection";

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
}

export interface SnapPreferences {
  endpoint: boolean;
  closure: boolean;
  center: boolean;
  edge: boolean;
  angle: boolean;
  alignment: boolean;
  grid: boolean;
}

interface PersistedUiPreferences {
  leftRailCollapsed: boolean;
  rightRailCollapsed: boolean;
  leftRailWidth: number;
  rightRailWidth: number;
  workflowDismissed: boolean;
  favoriteFurniture: FurnitureType[];
  recentFurniture: FurnitureType[];
  snapPreferences: SnapPreferences;
  visited3d: boolean;
  lastExportedAt: string | null;
  wallOpacity: number;
  show3dLabels: boolean;
}

interface UiState extends PersistedUiPreferences {
  catalogQuery: string;
  furnitureCategory: FurnitureCategory;
  helpOpen: boolean;
  aboutOpen: boolean;
  libraryOpen: boolean;
  recoveryCenterOpen: boolean;
  cameraPreset: CameraPreset;
  cameraRequest: number;
  cameraStates: Record<string, CameraState>;
  setLeftRailCollapsed: (collapsed: boolean) => void;
  setRightRailCollapsed: (collapsed: boolean) => void;
  setLeftRailWidth: (width: number) => void;
  setRightRailWidth: (width: number) => void;
  setWorkflowDismissed: (dismissed: boolean) => void;
  setCatalogQuery: (query: string) => void;
  setFurnitureCategory: (category: FurnitureCategory) => void;
  toggleFavoriteFurniture: (type: FurnitureType) => void;
  addRecentFurniture: (type: FurnitureType) => void;
  setSnapPreference: (kind: SnapKind, enabled: boolean) => void;
  mark3dVisited: () => void;
  markExported: () => void;
  setHelpOpen: (open: boolean) => void;
  setAboutOpen: (open: boolean) => void;
  setLibraryOpen: (open: boolean) => void;
  setRecoveryCenterOpen: (open: boolean) => void;
  requestCameraPreset: (preset: CameraPreset) => void;
  setCameraState: (projectId: string, state: CameraState) => void;
  setWallOpacity: (opacity: number) => void;
  setShow3dLabels: (show: boolean) => void;
}

const defaultSnapPreferences: SnapPreferences = {
  endpoint: true,
  closure: true,
  center: true,
  edge: true,
  angle: true,
  alignment: true,
  grid: true,
};

const defaults: PersistedUiPreferences = {
  leftRailCollapsed: false,
  rightRailCollapsed: false,
  leftRailWidth: 220,
  rightRailWidth: 304,
  workflowDismissed: false,
  favoriteFurniture: [],
  recentFurniture: [],
  snapPreferences: defaultSnapPreferences,
  visited3d: false,
  lastExportedAt: null,
  wallOpacity: 1,
  show3dLabels: true,
};

function readPreferences(): PersistedUiPreferences {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? "{}") as Partial<PersistedUiPreferences>;
    return {
      ...defaults,
      ...parsed,
      leftRailWidth: Math.min(320, Math.max(176, parsed.leftRailWidth ?? defaults.leftRailWidth)),
      rightRailWidth: Math.min(420, Math.max(256, parsed.rightRailWidth ?? defaults.rightRailWidth)),
      favoriteFurniture: Array.isArray(parsed.favoriteFurniture) ? parsed.favoriteFurniture : [],
      recentFurniture: Array.isArray(parsed.recentFurniture) ? parsed.recentFurniture.slice(0, 5) : [],
      snapPreferences: { ...defaultSnapPreferences, ...parsed.snapPreferences },
      wallOpacity: Math.min(1, Math.max(0.18, parsed.wallOpacity ?? 1)),
    };
  } catch {
    return defaults;
  }
}

function persist(state: UiState): void {
  const value: PersistedUiPreferences = {
    leftRailCollapsed: state.leftRailCollapsed,
    rightRailCollapsed: state.rightRailCollapsed,
    leftRailWidth: state.leftRailWidth,
    rightRailWidth: state.rightRailWidth,
    workflowDismissed: state.workflowDismissed,
    favoriteFurniture: state.favoriteFurniture,
    recentFurniture: state.recentFurniture,
    snapPreferences: state.snapPreferences,
    visited3d: state.visited3d,
    lastExportedAt: state.lastExportedAt,
    wallOpacity: state.wallOpacity,
    show3dLabels: state.show3dLabels,
  };
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // The editor remains fully usable when storage is blocked.
  }
}

function persistentUpdate(set: (updater: (state: UiState) => Partial<UiState>) => void, updater: (state: UiState) => Partial<UiState>): void {
  set((state) => {
    const next = { ...state, ...updater(state) };
    persist(next);
    return next;
  });
}

const initial = readPreferences();

export const useUiStore = create<UiState>((set) => ({
  ...initial,
  catalogQuery: "",
  furnitureCategory: "all",
  helpOpen: false,
  aboutOpen: false,
  libraryOpen: false,
  recoveryCenterOpen: false,
  cameraPreset: "isometric",
  cameraRequest: 0,
  cameraStates: {},
  setLeftRailCollapsed: (leftRailCollapsed) => persistentUpdate(set, () => ({ leftRailCollapsed })),
  setRightRailCollapsed: (rightRailCollapsed) => persistentUpdate(set, () => ({ rightRailCollapsed })),
  setLeftRailWidth: (leftRailWidth) => persistentUpdate(set, () => ({ leftRailWidth: Math.min(320, Math.max(176, leftRailWidth)) })),
  setRightRailWidth: (rightRailWidth) => persistentUpdate(set, () => ({ rightRailWidth: Math.min(420, Math.max(256, rightRailWidth)) })),
  setWorkflowDismissed: (workflowDismissed) => persistentUpdate(set, () => ({ workflowDismissed })),
  setCatalogQuery: (catalogQuery) => set({ catalogQuery }),
  setFurnitureCategory: (furnitureCategory) => set({ furnitureCategory }),
  toggleFavoriteFurniture: (type) => persistentUpdate(set, (state) => ({
    favoriteFurniture: state.favoriteFurniture.includes(type)
      ? state.favoriteFurniture.filter((candidate) => candidate !== type)
      : [...state.favoriteFurniture, type],
  })),
  addRecentFurniture: (type) => persistentUpdate(set, (state) => ({
    recentFurniture: [type, ...state.recentFurniture.filter((candidate) => candidate !== type)].slice(0, 5),
  })),
  setSnapPreference: (kind, enabled) => persistentUpdate(set, (state) => ({
    snapPreferences: { ...state.snapPreferences, [kind]: enabled },
  })),
  mark3dVisited: () => persistentUpdate(set, () => ({ visited3d: true })),
  markExported: () => persistentUpdate(set, () => ({ lastExportedAt: new Date().toISOString() })),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
  setLibraryOpen: (libraryOpen) => set({ libraryOpen }),
  setRecoveryCenterOpen: (recoveryCenterOpen) => set({ recoveryCenterOpen }),
  requestCameraPreset: (cameraPreset) => set((state) => ({ cameraPreset, cameraRequest: state.cameraRequest + 1 })),
  setCameraState: (projectId, cameraState) => set((state) => ({ cameraStates: { ...state.cameraStates, [projectId]: cameraState } })),
  setWallOpacity: (wallOpacity) => persistentUpdate(set, () => ({ wallOpacity: Math.min(1, Math.max(0.18, wallOpacity)) })),
  setShow3dLabels: (show3dLabels) => persistentUpdate(set, () => ({ show3dLabels })),
}));
