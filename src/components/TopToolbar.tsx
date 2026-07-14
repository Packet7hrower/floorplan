import {
  Box,
  Download,
  FileDown,
  FilePlus2,
  FolderOpen,
  Grid2X2,
  Magnet,
  Redo2,
  Save,
  Undo2,
  ZoomIn,
} from "lucide-react";
import { useRef } from "react";
import { deserializeProject } from "../domain/serialization";
import { isValidClosedRoom, projectBounds } from "../domain/geometry";
import { downloadProject } from "../export/download";
import { unitLabel, useProjectStore } from "../store/projectStore";

interface TopToolbarProps {
  onExport: () => void;
}

function ToolButton({ label, disabled, active, onClick, children }: { label: string; disabled?: boolean; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={"toolbar-button" + (active ? " active" : "")} title={label} aria-label={label} disabled={disabled} onClick={onClick}>{children}</button>;
}

export function TopToolbar({ onExport }: TopToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const state = useProjectStore();
  const roomReady = isValidClosedRoom(state.project);

  const confirmDiscard = () => !state.dirty || window.confirm("Discard unsaved changes? A separate recovery snapshot may still be available.");
  const openFile = async (file?: File) => {
    if (!file || !confirmDiscard()) return;
    try {
      state.loadProject(deserializeProject(await file.text()));
    } catch (error) {
      state.setError(error instanceof Error ? error.message : "Project could not be opened.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  const fit = () => {
    const bounds = projectBounds(state.project, 16_000);
    const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
    const width = Math.max(bounds.maxX - bounds.minX, 1);
    const height = Math.max(bounds.maxY - bounds.minY, 1);
    const zoom = Math.min(800, Math.max(10, Math.min((760 * 200 * 100) / width, (560 * 200 * 100) / height)));
    state.setViewport(zoom, center);
  };

  return (
    <header className="top-toolbar">
      <a className="brand" href="/" onClick={(event) => event.preventDefault()} aria-label="Floorplan home">
        <span className="brand-mark"><Grid2X2 size={19} /></span>
        <span>Floorplan</span>
      </a>
      <div className="toolbar-group">
        <ToolButton label="New project" onClick={() => { if (confirmDiscard()) state.newProject(); }}><FilePlus2 size={17} /></ToolButton>
        <ToolButton label="Open project" onClick={() => inputRef.current?.click()}><FolderOpen size={17} /></ToolButton>
        <input ref={inputRef} type="file" accept=".json,.floorplan.json,application/json" hidden onChange={(event) => void openFile(event.target.files?.[0])} />
        <ToolButton label="Save project" onClick={() => { downloadProject(state.project); state.markSaved(); }}><Save size={17} /></ToolButton>
        <ToolButton label="Export plan" disabled={!roomReady} onClick={onExport}><FileDown size={17} /></ToolButton>
      </div>
      <div className="toolbar-rule" />
      <div className="toolbar-group">
        <ToolButton label="Undo (Ctrl/Cmd+Z)" disabled={!state.history.past.length} onClick={state.undo}><Undo2 size={17} /></ToolButton>
        <ToolButton label="Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y)" disabled={!state.history.future.length} onClick={state.redo}><Redo2 size={17} /></ToolButton>
      </div>
      <div className="toolbar-rule" />
      <label className="toolbar-select-label">
        <span className="sr-only">Display unit</span>
        <select value={state.project.displayUnit} title={"Units: " + unitLabel(state.project.displayUnit)} onChange={(event) => state.updateProject({ displayUnit: event.target.value as "in" | "ft" })}>
          <option value="ft">Feet + inches</option>
          <option value="in">Inches</option>
        </select>
      </label>
      <ToolButton label={state.project.settings.snappingEnabled ? "Disable snapping" : "Enable snapping"} active={state.project.settings.snappingEnabled} onClick={() => state.updateSettings({ snappingEnabled: !state.project.settings.snappingEnabled })}><Magnet size={17} /></ToolButton>
      <ToolButton label={state.project.settings.showAllWallDimensions ? "Hide all wall dimensions" : "Show all wall dimensions"} active={state.project.settings.showAllWallDimensions} onClick={() => state.updateSettings({ showAllWallDimensions: !state.project.settings.showAllWallDimensions })}><Download size={17} className="dimension-icon" /></ToolButton>
      <div className="toolbar-spacer" />
      <div className="segmented-control" aria-label="View mode">
        <button type="button" className={state.view === "2d" ? "active" : ""} onClick={() => state.setView("2d")}>2D</button>
        <button type="button" className={state.view === "3d" ? "active" : ""} disabled={!roomReady} onClick={() => state.setView("3d")}><Box size={14} />3D</button>
      </div>
      <ToolButton label="Zoom to fit" onClick={fit}><ZoomIn size={17} /></ToolButton>
      <span className="zoom-readout" aria-label={"Zoom " + Math.round(state.zoom) + " percent"}>{Math.round(state.zoom)}%</span>
    </header>
  );
}
