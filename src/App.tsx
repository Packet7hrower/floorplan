import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { isValidClosedRoom, obstructedDoorIds } from "./domain/geometry";
import { newestValidRecovery, writeRecoverySnapshot } from "./persistence/recovery";
import { useProjectStore } from "./store/projectStore";
import { PlanCanvas } from "./components/PlanCanvas";
import { Scene3D } from "./components/Scene3D";
import { ToolPalette } from "./components/ToolPalette";
import { TopToolbar } from "./components/TopToolbar";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { ExportDialog } from "./components/ExportDialog";

export function App() {
  const project = useProjectStore((state) => state.project);
  const dirty = useProjectStore((state) => state.dirty);
  const view = useProjectStore((state) => state.view);
  const notice = useProjectStore((state) => state.notice);
  const error = useProjectStore((state) => state.error);
  const setNotice = useProjectStore((state) => state.setNotice);
  const setError = useProjectStore((state) => state.setError);
  const loadProject = useProjectStore((state) => state.loadProject);
  const [exportOpen, setExportOpen] = useState(false);
  const [recovery, setRecovery] = useState<Awaited<ReturnType<typeof newestValidRecovery>>>(null);
  const initialRecoveryCheck = useRef(false);

  useEffect(() => {
    if (initialRecoveryCheck.current) return;
    initialRecoveryCheck.current = true;
    newestValidRecovery().then(setRecovery).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      writeRecoverySnapshot(project).catch(() => setError("Autosave could not write a recovery snapshot. Your explicit project file is unaffected."));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [dirty, project, setError]);

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
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        state.deleteSelection();
      } else if (event.key === "Escape") {
        state.cancelDrawing();
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, []);

  const roomReady = isValidClosedRoom(project);
  const doorWarningCount = obstructedDoorIds(project).size;

  return (
    <main className="app-shell">
      <TopToolbar onExport={() => setExportOpen(true)} />
      <ToolPalette roomReady={roomReady} />
      <section className="workspace" aria-label={view === "2d" ? "2D floorplan editor" : "3D room view"}>
        {view === "2d" ? <PlanCanvas /> : <Scene3D />}
      </section>
      <PropertiesPanel roomReady={roomReady} />
      <footer className="status-bar">
        <span><span className={roomReady ? "status-dot ready" : "status-dot"} />{roomReady ? "Room closed and valid" : "Room requires a closed polygon"}</span>
        {doorWarningCount > 0 && <span className="status-warning"><AlertTriangle size={13} />Door swing obstructed{doorWarningCount > 1 ? " (" + doorWarningCount + ")" : ""}</span>}
        <span>{project.walls.length} walls · {project.openings.length} openings · {project.furniture.length} objects</span>
      </footer>

      {(notice || error) && (
        <div className={"toast " + (error ? "error" : "notice")} role={error ? "alert" : "status"}>
          {error ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{error ?? notice}</span>
          <button type="button" className="icon-button" aria-label="Dismiss message" onClick={() => error ? setError(null) : setNotice(null)}><X size={16} /></button>
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
              <button type="button" className="button primary" onClick={() => { loadProject(recovery.project); setRecovery(null); setNotice("Recovered the newest valid autosave."); }}>Recover project</button>
            </div>
          </section>
        </div>
      )}
      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
    </main>
  );
}
