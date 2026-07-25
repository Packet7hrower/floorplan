import { Database, FolderOpen, Save, ShieldCheck, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { deserializeProject } from "../domain/serialization";
import { createPlanSvg } from "../export/planSvg";
import {
  deleteLocalProject,
  deleteRecoverySnapshot,
  listLocalProjects,
  listRecoverySnapshots,
  openLocalProject,
  saveLocalProject,
  writeRecoverySnapshot,
  type LocalProjectRecord,
  type RecoverySnapshot,
} from "../persistence/recovery";
import { useProjectStore } from "../store/projectStore";

interface DialogProps {
  onClose: () => void;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function ProjectLibraryDialog({ onClose }: DialogProps) {
  const state = useProjectStore();
  const [records, setRecords] = useState<LocalProjectRecord[]>([]);
  const [working, setWorking] = useState(false);
  const refresh = useCallback(() => {
    listLocalProjects().then(setRecords).catch((error) => state.setError(error instanceof Error ? error.message : "Local projects could not be read."));
  }, [state]);
  useEffect(refresh, [refresh]);
  const saveCurrent = async () => {
    setWorking(true);
    try {
      const thumbnail = createPlanSvg(state.project, { width: 240, height: 160, includeDimensions: false });
      await saveLocalProject(state.project, thumbnail);
      state.setNotice("Project saved to the local library.");
      refresh();
    } catch (error) {
      state.setError(error instanceof Error ? error.message : "The local project could not be saved.");
    } finally {
      setWorking(false);
    }
  };
  const openRecord = async (record: LocalProjectRecord) => {
    if (state.dirty && !window.confirm("Open this local project and replace the current unsaved workspace?")) return;
    try {
      state.loadProject(await openLocalProject(record));
      state.setNotice("Local project opened.");
      onClose();
    } catch (error) {
      state.setError(error instanceof Error ? error.message : "The local project is invalid.");
    }
  };
  const removeRecord = async (record: LocalProjectRecord) => {
    if (!window.confirm(`Delete “${record.projectName}” from this browser? Downloaded files are unaffected.`)) return;
    await deleteLocalProject(record.id);
    refresh();
  };
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog library-dialog" role="dialog" aria-modal="true" aria-labelledby="library-title">
        <div className="dialog-heading">
          <div><p className="eyebrow">This browser</p><h2 id="library-title">Local projects</h2></div>
          <button type="button" className="icon-button" aria-label="Close local projects" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="library-toolbar">
          <p>Local projects stay in this browser. Download a project file for a portable copy.</p>
          <button type="button" className="button primary" disabled={working} onClick={() => void saveCurrent()}><Save size={16} />Save current locally</button>
        </div>
        <div className="project-grid">
          {records.map((record) => (
            <article key={record.id} className="project-card">
              <div className="project-thumbnail"><img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(record.thumbnailSvg)}`} alt="" /></div>
              <div className="project-card-copy"><strong>{record.projectName}</strong><small>Updated {formatDate(record.updatedAt)} · Schema {record.schemaVersion}</small></div>
              <div className="project-card-actions">
                <button type="button" className="button secondary" onClick={() => void openRecord(record)}><FolderOpen size={15} />Open</button>
                <button type="button" className="icon-button" aria-label={`Delete ${record.projectName} from local projects`} onClick={() => void removeRecord(record)}><Trash2 size={15} /></button>
              </div>
            </article>
          ))}
          {!records.length && <div className="library-empty"><Database size={22} /><strong>No local projects yet</strong><span>Save the current project here to reopen it without choosing a downloaded file.</span></div>}
        </div>
      </section>
    </div>
  );
}

function snapshotProjectName(snapshot: RecoverySnapshot): string {
  if (snapshot.label) return snapshot.label;
  try {
    return deserializeProject(snapshot.projectJson).name;
  } catch {
    return "Unavailable snapshot";
  }
}

export function RecoveryCenterDialog({ onClose }: DialogProps) {
  const state = useProjectStore();
  const [snapshots, setSnapshots] = useState<RecoverySnapshot[]>([]);
  const [label, setLabel] = useState(state.project.name);
  const refresh = useCallback(() => {
    listRecoverySnapshots().then(setSnapshots).catch((error) => state.setError(error instanceof Error ? error.message : "Recovery snapshots could not be read."));
  }, [state]);
  useEffect(refresh, [refresh]);
  const createNamed = async () => {
    try {
      await writeRecoverySnapshot(state.project, label.trim() || state.project.name, "named");
      state.markRecoverySaved();
      state.setNotice("Named recovery snapshot created.");
      refresh();
    } catch (error) {
      state.setError(error instanceof Error ? error.message : "Recovery snapshot could not be created.");
    }
  };
  const restore = (snapshot: RecoverySnapshot) => {
    if (state.dirty && !window.confirm("Restore this snapshot and replace the current unsaved workspace?")) return;
    try {
      state.loadProject(deserializeProject(snapshot.projectJson));
      state.markRecoverySaved(snapshot.timestamp);
      state.setNotice("Recovery snapshot restored.");
      onClose();
    } catch (error) {
      state.setError(error instanceof Error ? error.message : "The recovery snapshot is invalid.");
    }
  };
  const remove = async (snapshot: RecoverySnapshot) => {
    if (!window.confirm("Delete this recovery snapshot from this browser?")) return;
    await deleteRecoverySnapshot(snapshot.id);
    refresh();
  };
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog recovery-center-dialog" role="dialog" aria-modal="true" aria-labelledby="recovery-center-title">
        <div className="dialog-heading">
          <div><p className="eyebrow">Local protection</p><h2 id="recovery-center-title">Recovery center</h2></div>
          <button type="button" className="icon-button" aria-label="Close recovery center" onClick={onClose}><X size={18} /></button>
        </div>
        <form className="snapshot-create" onSubmit={(event) => { event.preventDefault(); void createNamed(); }}>
          <label><span>Snapshot name</span><input value={label} onChange={(event) => setLabel(event.target.value)} /></label>
          <button type="submit" className="button primary"><ShieldCheck size={16} />Create snapshot</button>
        </form>
        <div className="snapshot-list">
          {snapshots.map((snapshot) => (
            <article key={snapshot.id}>
              <span className={`snapshot-kind ${snapshot.kind === "named" ? "named" : ""}`}>{snapshot.kind === "named" ? "Named" : "Automatic"}</span>
              <div><strong>{snapshotProjectName(snapshot)}</strong><small>{formatDate(snapshot.timestamp)} · Schema {snapshot.schemaVersion}</small></div>
              <button type="button" className="button secondary" onClick={() => restore(snapshot)}>Restore</button>
              <button type="button" className="icon-button" aria-label={`Delete snapshot from ${formatDate(snapshot.timestamp)}`} onClick={() => void remove(snapshot)}><Trash2 size={15} /></button>
            </article>
          ))}
          {!snapshots.length && <div className="library-empty"><ShieldCheck size={22} /><strong>No recovery snapshots</strong><span>A local snapshot is created automatically after project changes.</span></div>}
        </div>
      </section>
    </div>
  );
}
