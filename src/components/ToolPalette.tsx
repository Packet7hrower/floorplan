import {
  Armchair,
  Box,
  Camera,
  DoorOpen,
  Eye,
  Layers,
  MousePointer2,
  PanelLeftClose,
  PencilRuler,
  RectangleHorizontal,
  Rows3,
  Search,
  SquareSplitHorizontal,
  Star,
} from "lucide-react";
import { FURNITURE_CATALOG } from "../domain/defaults";
import type { FurnitureType, Tool } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { type FurnitureCategory, useUiStore } from "../store/uiStore";

interface ToolPaletteProps {
  roomReady: boolean;
}

const tools: Array<{ id: Tool; label: string; shortcut: string; icon: typeof MousePointer2; requiresRoom?: boolean }> = [
  { id: "select", label: "Select", shortcut: "V", icon: MousePointer2 },
  { id: "wall", label: "Draw wall", shortcut: "W", icon: PencilRuler },
  { id: "rectangle", label: "Rectangle room", shortcut: "R", icon: RectangleHorizontal },
  { id: "door", label: "Door", shortcut: "D", icon: DoorOpen, requiresRoom: true },
  { id: "window", label: "Window", shortcut: "N", icon: SquareSplitHorizontal, requiresRoom: true },
];

const categories: Record<FurnitureCategory, FurnitureType[]> = {
  all: Object.keys(FURNITURE_CATALOG) as FurnitureType[],
  work: ["desk", "office-chair", "computer-monitor"],
  seating: ["office-chair", "dining-chair", "sofa"],
  storage: ["bookshelf", "cabinet", "dresser"],
  media: ["tv", "tv-stand", "computer-monitor", "speaker"],
  sleep: ["bed"],
};

function SceneControls() {
  const ui = useUiStore();
  const state = useProjectStore();
  const presets = [
    { id: "isometric" as const, label: "Isometric", icon: Box },
    { id: "top" as const, label: "Top", icon: Layers },
    { id: "eye" as const, label: "Eye level", icon: Eye },
    { id: "selection" as const, label: "Frame selection", icon: Camera },
  ];
  return (
    <>
      <div className="panel-heading"><span>Scene</span><button type="button" className="icon-button" aria-label="Collapse scene controls" onClick={() => ui.setLeftRailCollapsed(true)}><PanelLeftClose size={16} /></button></div>
      <nav className="tool-list" aria-label="3D camera presets">
        {presets.map(({ id, label, icon: Icon }) => (
          <button type="button" key={id} className={"tool-item " + (ui.cameraPreset === id ? "active" : "")} onClick={() => ui.requestCameraPreset(id)}>
            <Icon size={18} /><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="panel-section-heading"><Layers size={16} /><span>Display</span></div>
      <label className="rail-field">
        <span>Wall visibility</span>
        <input type="range" min="0.18" max="1" step="0.02" value={ui.wallOpacity} onChange={(event) => ui.setWallOpacity(Number(event.target.value))} />
        <small>{Math.round(ui.wallOpacity * 100)}%</small>
      </label>
      <label className="rail-check"><input type="checkbox" checked={ui.show3dLabels} onChange={(event) => ui.setShow3dLabels(event.target.checked)} /><span>Selection label and dimensions</span></label>
      <button type="button" className="button secondary rail-primary-action" onClick={() => state.setView("2d")}>Edit plan in 2D</button>
    </>
  );
}

export function ToolPalette({ roomReady }: ToolPaletteProps) {
  const state = useProjectStore();
  const ui = useUiStore();
  if (state.view === "3d") {
    return <aside className="tool-palette scene-palette" aria-label="3D scene controls"><SceneControls /></aside>;
  }
  const query = ui.catalogQuery.trim().toLowerCase();
  const allowed = new Set(categories[ui.furnitureCategory]);
  const catalog = (Object.entries(FURNITURE_CATALOG) as Array<[FurnitureType, (typeof FURNITURE_CATALOG)[FurnitureType]]>)
    .filter(([type, definition]) => allowed.has(type) && (!query || definition.label.toLowerCase().includes(query)))
    .sort(([a], [b]) => {
      const favorite = Number(ui.favoriteFurniture.includes(b)) - Number(ui.favoriteFurniture.includes(a));
      if (favorite) return favorite;
      const aRecent = ui.recentFurniture.indexOf(a);
      const bRecent = ui.recentFurniture.indexOf(b);
      if (aRecent >= 0 || bRecent >= 0) return (aRecent < 0 ? 99 : aRecent) - (bRecent < 0 ? 99 : bRecent);
      return FURNITURE_CATALOG[a].label.localeCompare(FURNITURE_CATALOG[b].label);
    });
  const chooseFurniture = (type: FurnitureType) => {
    if (!roomReady) {
      state.setNotice("Close the room to place furniture.");
      return;
    }
    state.setSelectedFurnitureType(type);
    ui.addRecentFurniture(type);
  };
  return (
    <aside className="tool-palette" aria-label="Drawing tools">
      <div className="panel-heading"><span>Tools</span><button type="button" className="icon-button" aria-label="Collapse drawing tools" onClick={() => ui.setLeftRailCollapsed(true)}><PanelLeftClose size={16} /></button></div>
      <nav className="tool-list">
        {tools.map(({ id, label, shortcut, icon: Icon, requiresRoom }) => (
          <button
            type="button"
            key={id}
            className={"tool-item " + (state.tool === id ? "active" : "")}
            data-unavailable={requiresRoom && !roomReady ? "true" : undefined}
            onClick={() => requiresRoom && !roomReady ? state.setNotice(`Close the room to add a ${id}.`) : state.setTool(id)}
            title={requiresRoom && !roomReady ? `Close the room to add a ${id}.` : `${label} (${shortcut})`}
          >
            <Icon size={18} /><span>{label}</span><kbd aria-hidden="true">{shortcut}</kbd>
          </button>
        ))}
      </nav>
      <div className="panel-section-heading"><Armchair size={16} /><span>Furniture</span></div>
      <div className="catalog-filters">
        <label className="catalog-search"><Search size={14} /><span className="sr-only">Search furniture</span><input type="search" placeholder="Search furniture" value={ui.catalogQuery} onChange={(event) => ui.setCatalogQuery(event.target.value)} /></label>
        <label><span className="sr-only">Furniture category</span><select value={ui.furnitureCategory} onChange={(event) => ui.setFurnitureCategory(event.target.value as FurnitureCategory)}>
          <option value="all">All categories</option>
          <option value="work">Work</option>
          <option value="seating">Seating</option>
          <option value="storage">Storage</option>
          <option value="media">Media</option>
          <option value="sleep">Sleep</option>
        </select></label>
      </div>
      <div className="catalog" role="group" aria-label="Furniture catalog">
        {catalog.map(([type, definition]) => (
          <div className="catalog-row" key={type}>
            <button type="button" data-unavailable={!roomReady ? "true" : undefined} className={"catalog-item " + (state.tool === "furniture" && state.selectedFurnitureType === type ? "active" : "")} onClick={() => chooseFurniture(type)}>
              <Rows3 size={14} /><span>{definition.label}</span>
            </button>
            <button type="button" className={"favorite-button " + (ui.favoriteFurniture.includes(type) ? "active" : "")} aria-label={`${ui.favoriteFurniture.includes(type) ? "Remove" : "Add"} ${definition.label} ${ui.favoriteFurniture.includes(type) ? "from" : "to"} favorites`} onClick={() => ui.toggleFavoriteFurniture(type)}>
              <Star size={13} fill={ui.favoriteFurniture.includes(type) ? "currentColor" : "none"} />
            </button>
          </div>
        ))}
        {!catalog.length && <p className="catalog-empty">No furniture matches this search.</p>}
      </div>
    </aside>
  );
}
