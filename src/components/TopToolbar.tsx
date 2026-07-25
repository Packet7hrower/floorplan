import {
  Box,
  Database,
  Download,
  FileDown,
  FilePlus2,
  FolderOpen,
  Grid2X2,
  HelpCircle,
  Info,
  Magnet,
  PanelLeftOpen,
  PanelRightOpen,
  Redo2,
  Save,
  Settings2,
  ShieldCheck,
  Undo2,
  X,
  ZoomIn,
} from "lucide-react";
import { useRef, useState } from "react";
import { deserializeProject } from "../domain/serialization";
import { isValidClosedRoom, projectBounds } from "../domain/geometry";
import { ProjectValidationError } from "../domain/validation";
import { directFileSaveAvailable, saveProjectFile } from "../export/projectFile";
import { unitLabel, useProjectStore } from "../store/projectStore";
import { useUiStore } from "../store/uiStore";

function formatProtectionTime(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

interface TopToolbarProps {
  onExport: () => void;
}

interface ToolButtonProps {
  label: string;
  disabled?: boolean;
  unavailableReason?: string;
  active?: boolean;
  labeled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

interface ImportFailure {
  summary: string;
  issues: string[];
}

function ImportDiagnosticsDialog({ failure, onClose }: { failure: ImportFailure; onClose: () => void }) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog import-diagnostics" role="dialog" aria-modal="true" aria-labelledby="import-diagnostics-title">
        <div className="dialog-heading">
          <div><p className="eyebrow">Import diagnostics</p><h2 id="import-diagnostics-title">Project was not opened</h2></div>
          <button type="button" className="icon-button" aria-label="Close import diagnostics" onClick={onClose}><X size={18} /></button>
        </div>
        <p>{failure.summary} The current project and its undo history were not changed.</p>
        <ul>{failure.issues.map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}</ul>
        <div className="dialog-actions"><button type="button" className="button primary" onClick={onClose}>Close</button></div>
      </section>
    </div>
  );
}

function ToolButton({ label, disabled, unavailableReason, active, labeled, onClick, children }: ToolButtonProps) {
  const setNotice = useProjectStore((state) => state.setNotice);
  return (
    <button
      type="button"
      className={"toolbar-button" + (active ? " active" : "") + (labeled ? " labeled" : "")}
      title={unavailableReason ?? label}
      aria-label={label}
      data-unavailable={unavailableReason ? "true" : undefined}
      disabled={disabled}
      onClick={() => unavailableReason ? setNotice(unavailableReason) : onClick()}
    >
      {children}{labeled && <span>{label}</span>}
    </button>
  );
}

function ProtectionStatus() {
  const dirty = useProjectStore((state) => state.dirty);
  const recoveryState = useProjectStore((state) => state.recoveryState);
  const lastRecoveryAt = useProjectStore((state) => state.lastRecoveryAt);
  const lastDownloadedAt = useProjectStore((state) => state.lastDownloadedAt);
  const lastFileSaveKind = useProjectStore((state) => state.lastFileSaveKind);
  let label = "Ready";
  let detail = "No unsaved changes";
  let tone = "ready";
  if (dirty && recoveryState === "saving") {
    label = "Saving recovery";
    detail = "Writing a local snapshot";
    tone = "working";
  } else if (dirty && recoveryState === "saved") {
    label = "Recovery saved";
    detail = `Locally protected at ${formatProtectionTime(lastRecoveryAt)}`;
    tone = "protected";
  } else if (dirty) {
    label = "Unsaved changes";
    detail = recoveryState === "error" ? "Local recovery is unavailable" : "Waiting for local recovery";
    tone = "warning";
  } else if (lastDownloadedAt) {
    label = lastFileSaveKind === "file" ? "Saved to file" : "Downloaded";
    detail = `${lastFileSaveKind === "file" ? "File updated" : "Project downloaded"} at ${formatProtectionTime(lastDownloadedAt)}`;
    tone = "protected";
  }
  return (
    <button type="button" className={`protection-status ${tone}`} title={detail} onClick={() => useUiStore.getState().setRecoveryCenterOpen(true)}>
      <span className="protection-dot" />
      <span><strong>{label}</strong><small>{detail}</small></span>
    </button>
  );
}

export function TopToolbar({ onExport }: TopToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importFailure, setImportFailure] = useState<ImportFailure | null>(null);
  const state = useProjectStore();
  const ui = useUiStore();
  const roomReady = isValidClosedRoom(state.project);
  const directSave = directFileSaveAvailable();

  const confirmDiscard = () => !state.dirty || window.confirm("Discard unsaved changes? A separate recovery snapshot may still be available.");
  const openFile = async (file?: File) => {
    if (!file) return;
    try {
      const project = deserializeProject(await file.text());
      if (!confirmDiscard()) return;
      state.loadProject(project);
    } catch (error) {
      const issues = error instanceof ProjectValidationError ? error.issues : [error instanceof Error ? error.message : "Project could not be opened."];
      const category = issues.some((issue) => issue.includes("schema"))
        ? "The file uses an unsupported project schema."
        : issues.some((issue) => issue.includes("polygon") || issue.includes("Wall"))
          ? "The room geometry is invalid."
          : issues.some((issue) => issue.includes("Opening"))
            ? "One or more openings are invalid."
            : issues.some((issue) => issue.includes("Furniture") || issue.includes("collision"))
              ? "One or more furniture objects are invalid."
              : "The selected file is not a valid Floorplan project.";
      setImportFailure({ summary: category, issues });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  const save = async () => {
    try {
      state.markDownloaded(await saveProjectFile(state.project));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      state.setError(error instanceof Error ? error.message : "Project file could not be saved.");
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
    <>
    <header className="top-toolbar">
      <a className="brand" href="/" onClick={(event) => event.preventDefault()} aria-label="Floorplan home">
        <span className="brand-mark"><Grid2X2 size={19} /></span>
        <span>Floorplan</span>
      </a>
      <nav className="compact-menus" aria-label="Application menus">
        <details><summary>File</summary><div className="compact-menu-card">
          <button type="button" onClick={() => { if (confirmDiscard()) state.newProject(); }}>New project</button>
          <button type="button" onClick={() => inputRef.current?.click()}>Open downloaded file</button>
          <button type="button" onClick={() => ui.setLibraryOpen(true)}>Open local projects</button>
          <button type="button" onClick={() => void save()}>{directSave ? "Save to file" : "Download project"}</button>
          <button type="button" data-unavailable={!roomReady ? "true" : undefined} onClick={() => roomReady ? onExport() : state.setNotice("Close the room to export the plan.")}>Export plan</button>
        </div></details>
        <details><summary>Edit</summary><div className="compact-menu-card">
          <button type="button" disabled={!state.history.past.length} onClick={state.undo}>Undo</button>
          <button type="button" disabled={!state.history.future.length} onClick={state.redo}>Redo</button>
          <button type="button" onClick={state.copySelectedFurniture}>Copy furniture</button>
          <button type="button" onClick={state.pasteFurniture}>Paste furniture</button>
          <button type="button" onClick={state.duplicateSelectedFurniture}>Duplicate furniture</button>
        </div></details>
        <details><summary>View</summary><div className="compact-menu-card">
          <button type="button" onClick={() => state.setView("2d")}>2D editor</button>
          <button type="button" data-unavailable={!roomReady ? "true" : undefined} onClick={() => roomReady ? state.setView("3d") : state.setNotice("Close the room to inspect it in 3D.")}>3D inspection</button>
          <button type="button" onClick={fit}>Zoom to fit</button>
          <button type="button" onClick={() => ui.setLeftRailCollapsed(!ui.leftRailCollapsed)}>{ui.leftRailCollapsed ? "Show" : "Hide"} tools</button>
          <button type="button" onClick={() => ui.setRightRailCollapsed(!ui.rightRailCollapsed)}>{ui.rightRailCollapsed ? "Show" : "Hide"} properties</button>
        </div></details>
        <details><summary>Help</summary><div className="compact-menu-card">
          <button type="button" onClick={() => ui.setHelpOpen(true)}>Controls and workflow</button>
          <button type="button" onClick={() => ui.setRecoveryCenterOpen(true)}>Recovery center</button>
          <button type="button" onClick={() => ui.setAboutOpen(true)}>About and diagnostics</button>
        </div></details>
      </nav>
      <div className="toolbar-group file-actions" aria-label="File actions">
        <ToolButton label="New project" onClick={() => { if (confirmDiscard()) state.newProject(); }}><FilePlus2 size={17} /></ToolButton>
        <ToolButton label="Open downloaded file" onClick={() => inputRef.current?.click()}><FolderOpen size={17} /></ToolButton>
        <ToolButton label="Open local projects" onClick={() => ui.setLibraryOpen(true)}><Database size={17} /></ToolButton>
        <input ref={inputRef} type="file" accept=".json,.floorplan.json,application/json" hidden onChange={(event) => void openFile(event.target.files?.[0])} />
        <ToolButton label={directSave ? "Save to file" : "Download project"} labeled onClick={() => void save()}>{directSave ? <Save size={17} /> : <Download size={17} />}</ToolButton>
        <ToolButton label="Export plan" labeled unavailableReason={!roomReady ? "Close the room to export the plan." : undefined} onClick={onExport}><FileDown size={17} /></ToolButton>
      </div>
      <div className="toolbar-rule" />
      <div className="toolbar-group edit-actions" aria-label="Edit actions">
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
      <div className="snap-control">
        <ToolButton label={state.project.settings.snappingEnabled ? "Disable snapping" : "Enable snapping"} active={state.project.settings.snappingEnabled} onClick={() => state.updateSettings({ snappingEnabled: !state.project.settings.snappingEnabled })}><Magnet size={17} /></ToolButton>
        <details className="toolbar-popover">
          <summary aria-label="Snap preferences" title="Snap preferences"><Settings2 size={15} /></summary>
          <div className="popover-card snap-options">
            <p className="eyebrow">Snap preferences</p>
            {([
              ["endpoint", "Wall endpoints"],
              ["center", "Wall centers"],
              ["edge", "Object edges"],
              ["alignment", "Alignment"],
              ["angle", "45° angles"],
              ["grid", "Grid"],
            ] as const).map(([kind, label]) => (
              <label key={kind}><input type="checkbox" checked={ui.snapPreferences[kind]} onChange={(event) => ui.setSnapPreference(kind, event.target.checked)} /><span>{label}</span></label>
            ))}
          </div>
        </details>
      </div>
      <ToolButton label={state.project.settings.showAllWallDimensions ? "Hide all wall dimensions" : "Show all wall dimensions"} active={state.project.settings.showAllWallDimensions} onClick={() => state.updateSettings({ showAllWallDimensions: !state.project.settings.showAllWallDimensions })}><Download size={17} className="dimension-icon" /></ToolButton>
      <div className="toolbar-spacer" />
      {ui.leftRailCollapsed && <ToolButton label="Show tool panel" onClick={() => ui.setLeftRailCollapsed(false)}><PanelLeftOpen size={17} /></ToolButton>}
      {ui.rightRailCollapsed && <ToolButton label="Show properties panel" onClick={() => ui.setRightRailCollapsed(false)}><PanelRightOpen size={17} /></ToolButton>}
      <ToolButton label="Recovery center" onClick={() => ui.setRecoveryCenterOpen(true)}><ShieldCheck size={17} /></ToolButton>
      <ProtectionStatus />
      <div className="segmented-control" aria-label="View mode">
        <button type="button" className={state.view === "2d" ? "active" : ""} onClick={() => state.setView("2d")}>2D</button>
        <button
          type="button"
          className={state.view === "3d" ? "active" : ""}
          data-unavailable={!roomReady ? "true" : undefined}
          title={!roomReady ? "Close the room to inspect it in 3D." : "3D view"}
          onClick={() => {
            if (!roomReady) state.setNotice("Close the room to inspect it in 3D.");
            else { state.setView("3d"); ui.mark3dVisited(); }
          }}
        ><Box size={14} />3D</button>
      </div>
      <ToolButton label="Zoom to fit" onClick={fit}><ZoomIn size={17} /></ToolButton>
      <span className="zoom-readout" aria-label={"Zoom " + Math.round(state.zoom) + " percent"}>{Math.round(state.zoom)}%</span>
      <ToolButton label="Help (?)" onClick={() => ui.setHelpOpen(true)}><HelpCircle size={17} /></ToolButton>
      <ToolButton label="About and diagnostics" onClick={() => ui.setAboutOpen(true)}><Info size={17} /></ToolButton>
    </header>
    {importFailure && <ImportDiagnosticsDialog failure={importFailure} onClose={() => setImportFailure(null)} />}
    </>
  );
}
