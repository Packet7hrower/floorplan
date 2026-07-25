import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { isValidClosedRoom, obstructedDoorIds } from "./domain/geometry";
import { newestValidRecovery, writeRecoverySnapshot } from "./persistence/recovery";
import { useProjectStore } from "./store/projectStore";
import { useUiStore } from "./store/uiStore";
import { PlanCanvas } from "./components/PlanCanvas";
import { ToolPalette } from "./components/ToolPalette";
import { TopToolbar } from "./components/TopToolbar";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { AboutDialog, HelpSheet, MeasuredRectangleDialog, ToolInstruction, WorkflowRail } from "./components/Guidance";

const Scene3D = lazy(() => import("./components/Scene3D").then((module) => ({ default: module.Scene3D })));
const ExportDialog = lazy(() => import("./components/ExportDialog").then((module) => ({ default: module.ExportDialog })));
const ProjectLibraryDialog = lazy(() => import("./components/ProjectLibrary").then((module) => ({ default: module.ProjectLibraryDialog })));
const RecoveryCenterDialog = lazy(() => import("./components/ProjectLibrary").then((module) => ({ default: module.RecoveryCenterDialog })));

function DeferredFeature({ label }: { label: string }) {
  return <div className="feature-loading" role="status"><span className="loading-rule" />Loading {label}…</div>;
}

function RailResizer({ side }: { side: "left" | "right" }) {
  const ui = useUiStore();
  const width = side === "left" ? ui.leftRailWidth : ui.rightRailWidth;
  const setWidth = side === "left" ? ui.setLeftRailWidth : ui.setRightRailWidth;
  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const move = (pointer: PointerEvent) => setWidth(startWidth + (pointer.clientX - startX) * (side === "left" ? 1 : -1));
    const stop = () => {
      globalThis.removeEventListener("pointermove", move);
      globalThis.removeEventListener("pointerup", stop);
    };
    globalThis.addEventListener("pointermove", move);
    globalThis.addEventListener("pointerup", stop);
  };
  return (
    <div
      className={`rail-resizer ${side}`}
      role="separator"
      aria-label={`Resize ${side} panel`}
      aria-orientation="vertical"
      aria-valuemin={side === "left" ? 176 : 256}
      aria-valuemax={side === "left" ? 320 : 420}
      aria-valuenow={Math.round(width)}
      tabIndex={0}
      onPointerDown={startResize}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        setWidth(width + direction * 8 * (side === "left" ? 1 : -1));
      }}
    />
  );
}

export function App() {
  const project = useProjectStore((state) => state.project);
  const dirty = useProjectStore((state) => state.dirty);
  const view = useProjectStore((state) => state.view);
  const notice = useProjectStore((state) => state.notice);
  const error = useProjectStore((state) => state.error);
  const setNotice = useProjectStore((state) => state.setNotice);
  const setError = useProjectStore((state) => state.setError);
  const loadProject = useProjectStore((state) => state.loadProject);
  const markRecoverySaving = useProjectStore((state) => state.markRecoverySaving);
  const markRecoverySaved = useProjectStore((state) => state.markRecoverySaved);
  const markRecoveryFailed = useProjectStore((state) => state.markRecoveryFailed);
  const ui = useUiStore();
  const [exportOpen, setExportOpen] = useState(false);
  const [measuredOpen, setMeasuredOpen] = useState(false);
  const [recovery, setRecovery] = useState<Awaited<ReturnType<typeof newestValidRecovery>>>(null);
  const initialRecoveryCheck = useRef(false);

  useEffect(() => {
    if (initialRecoveryCheck.current) return;
    initialRecoveryCheck.current = true;
    const skip = globalThis.sessionStorage?.getItem("floorplan-skip-recovery-once") === "1";
    if (skip) {
      globalThis.sessionStorage?.removeItem("floorplan-skip-recovery-once");
      return;
    }
    newestValidRecovery().then(setRecovery).catch(() => setNotice("Local recovery could not be checked. Downloaded project files are unaffected."));
  }, [setNotice]);

  useEffect(() => {
    if (!dirty) return;
    markRecoverySaving();
    const timer = window.setTimeout(() => {
      writeRecoverySnapshot(project)
        .then(() => markRecoverySaved())
        .catch(() => {
          markRecoveryFailed();
          setError("Local recovery could not save a snapshot. Download the project to protect this version.");
        });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [dirty, project, markRecoveryFailed, markRecoverySaved, markRecoverySaving, setError]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [notice, setNotice]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, select")) return;
      const state = useProjectStore.getState();
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
      } else if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        state.redo();
      } else if (modifier && event.key.toLowerCase() === "c") {
        event.preventDefault();
        state.copySelectedFurniture();
      } else if (modifier && event.key.toLowerCase() === "v") {
        event.preventDefault();
        state.pasteFurniture();
      } else if (modifier && event.key.toLowerCase() === "d") {
        event.preventDefault();
        state.duplicateSelectedFurniture();
      } else if (event.key === "]") {
        event.preventDefault();
        state.rotateSelectedFurniture90();
      } else if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        const step = event.altKey ? 100 : event.shiftKey ? 1_000 : 250;
        state.nudgeSelection(
          event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0,
          event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0,
        );
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        state.deleteSelection();
      } else if (event.key === "Escape") {
        state.cancelDrawing();
      } else if (event.key === "?") {
        event.preventDefault();
        useUiStore.getState().setHelpOpen(true);
      } else if (!modifier && state.view === "2d") {
        const shortcuts: Record<string, "select" | "wall" | "rectangle" | "door" | "window"> = {
          v: "select",
          w: "wall",
          r: "rectangle",
          d: "door",
          n: "window",
        };
        const tool = shortcuts[event.key.toLowerCase()];
        if (tool) state.setTool(tool);
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, []);

  const roomReady = isValidClosedRoom(project);
  const doorWarningCount = obstructedDoorIds(project).size;
  const openMeasured = () => {
    if (project.walls.length) setNotice("Start a new project before creating another room.");
    else setMeasuredOpen(true);
  };

  return (
    <main
      className={`app-shell${ui.leftRailCollapsed ? " left-collapsed" : ""}${ui.rightRailCollapsed ? " right-collapsed" : ""}`}
      style={{
        "--left-rail-width": `${ui.leftRailCollapsed ? 0 : ui.leftRailWidth}px`,
        "--right-rail-width": `${ui.rightRailCollapsed ? 0 : ui.rightRailWidth}px`,
      } as React.CSSProperties}
    >
      <TopToolbar onExport={() => roomReady ? setExportOpen(true) : setNotice("Close the room to export the plan.")} />
      <ToolPalette roomReady={roomReady} />
      {!ui.leftRailCollapsed && <RailResizer side="left" />}
      <section className="workspace" aria-label={view === "2d" ? "2D floorplan editor" : "3D room view"}>
        {view === "2d" ? <PlanCanvas onMeasuredRectangle={openMeasured} /> : (
          <Suspense fallback={<DeferredFeature label="3D view" />}><Scene3D /></Suspense>
        )}
        <WorkflowRail onMeasuredRectangle={openMeasured} onExport={() => setExportOpen(true)} />
        {view === "2d" && <ToolInstruction />}
        {error && (
          <div className="workspace-error" role="alert">
            <AlertTriangle size={17} />
            <span>{error}</span>
            {!roomReady && <button type="button" onClick={() => { useProjectStore.getState().setView("2d"); useProjectStore.getState().setTool("wall"); }}>Continue drawing</button>}
            <button type="button" className="icon-button" aria-label="Dismiss error" onClick={() => setError(null)}><X size={15} /></button>
          </div>
        )}
      </section>
      <PropertiesPanel roomReady={roomReady} />
      {!ui.rightRailCollapsed && <RailResizer side="right" />}
      <footer className="status-bar">
        <button type="button" className="status-action" onClick={() => {
          if (!roomReady) { useProjectStore.getState().setView("2d"); useProjectStore.getState().setTool("wall"); }
        }}>
          <span className={roomReady ? "status-dot ready" : "status-dot"} />{roomReady ? "Room closed and valid" : "Room requires a closed polygon"}
        </button>
        {doorWarningCount > 0 && <span className="status-warning"><AlertTriangle size={13} />Door swing obstructed{doorWarningCount > 1 ? ` (${doorWarningCount})` : ""}</span>}
        <span>{project.walls.length} walls · {project.openings.length} openings · {project.furniture.length} objects</span>
      </footer>

      {notice && (
        <div className="toast notice" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button type="button" className="icon-button" aria-label="Dismiss message" onClick={() => setNotice(null)}><X size={16} /></button>
        </div>
      )}

      {recovery && (
        <div className="dialog-backdrop" role="presentation">
          <section className="dialog recovery-dialog" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
            <div className="dialog-heading">
              <div><p className="eyebrow">Recovery snapshot</p><h2 id="recovery-title">Recover unsaved work?</h2></div>
              <button type="button" className="icon-button" aria-label="Dismiss recovery" onClick={() => setRecovery(null)}><X size={18} /></button>
            </div>
            <p>A valid autosave from {new Date(recovery.snapshot.timestamp).toLocaleString()} is available for “{recovery.project.name}”.</p>
            <div className="dialog-actions">
              <button type="button" className="button secondary" onClick={() => setRecovery(null)}>Not now</button>
              <button type="button" className="button primary" onClick={() => {
                loadProject(recovery.project);
                markRecoverySaved(recovery.snapshot.timestamp);
                setRecovery(null);
                setNotice("Recovered the newest valid local snapshot.");
              }}>Recover project</button>
            </div>
          </section>
        </div>
      )}
      {exportOpen && <Suspense fallback={<DeferredFeature label="export tools" />}><ExportDialog onClose={() => setExportOpen(false)} /></Suspense>}
      {measuredOpen && <MeasuredRectangleDialog onClose={() => setMeasuredOpen(false)} />}
      {ui.helpOpen && <HelpSheet onClose={() => ui.setHelpOpen(false)} />}
      {ui.aboutOpen && <AboutDialog onClose={() => ui.setAboutOpen(false)} />}
      {ui.libraryOpen && <Suspense fallback={<DeferredFeature label="local projects" />}><ProjectLibraryDialog onClose={() => ui.setLibraryOpen(false)} /></Suspense>}
      {ui.recoveryCenterOpen && <Suspense fallback={<DeferredFeature label="recovery center" />}><RecoveryCenterDialog onClose={() => ui.setRecoveryCenterOpen(false)} /></Suspense>}
    </main>
  );
}
