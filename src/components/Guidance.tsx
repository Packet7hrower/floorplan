import { Check, Circle, Info, Keyboard, Ruler, X } from "lucide-react";
import { useMemo, useState } from "react";
import { isValidClosedRoom } from "../domain/geometry";
import { parseMeasurement } from "../domain/measurements";
import { useProjectStore } from "../store/projectStore";
import { useUiStore } from "../store/uiStore";
import { browserCapabilities, BUILD_INFO } from "../utils/buildInfo";

interface DialogProps {
  onClose: () => void;
}

export function MeasuredRectangleDialog({ onClose }: DialogProps) {
  const state = useProjectStore();
  const [width, setWidth] = useState("12ft");
  const [depth, setDepth] = useState("10ft");
  const [error, setError] = useState<string | null>(null);
  const create = () => {
    try {
      const widthMils = parseMeasurement(width, state.project.displayUnit);
      const depthMils = parseMeasurement(depth, state.project.displayUnit);
      state.addRectangle({ x: 0, y: 0 }, { x: widthMils, y: depthMils });
      state.setViewport(100, { x: widthMils / 2, y: depthMils / 2 });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Enter valid room dimensions.");
    }
  };
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog measured-dialog" role="dialog" aria-modal="true" aria-labelledby="measured-title">
        <div className="dialog-heading">
          <div><p className="eyebrow">Quick room</p><h2 id="measured-title">Create a measured rectangle</h2></div>
          <button type="button" className="icon-button" aria-label="Close measured rectangle" onClick={onClose}><X size={18} /></button>
        </div>
        <p>Enter the interior width and depth using feet, inches, decimals, or simple fractions.</p>
        <form onSubmit={(event) => { event.preventDefault(); create(); }}>
          <div className="field-grid">
            <label className="field"><span>Width</span><input autoFocus value={width} onChange={(event) => setWidth(event.target.value)} /></label>
            <label className="field"><span>Depth</span><input value={depth} onChange={(event) => setDepth(event.target.value)} /></label>
          </div>
          {error && <div className="inline-error" role="alert">{error}</div>}
          <div className="dialog-actions">
            <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="button primary"><Ruler size={16} />Create room</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function HelpSheet({ onClose }: DialogProps) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <div className="dialog-heading">
          <div><p className="eyebrow">Reference</p><h2 id="help-title">Controls and workflow</h2></div>
          <button type="button" className="icon-button" aria-label="Close help" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="help-grid">
          <section><h3>Build the room</h3><p>Create a measured rectangle, drag a rectangle, or draw connected walls. Click the first point to close a freeform room.</p></section>
          <section><h3>Navigate</h3><p>Wheel to zoom at the pointer. Hold Space and drag, or use the middle mouse button, to pan.</p></section>
          <section><h3>Draw precisely</h3><p>Hold Shift for 45° constraints. Hold Alt to suspend snapping. Use the spatial value rail for exact dimensions.</p></section>
          <section><h3>Edit selections</h3><p>Arrow keys nudge selected objects. Shift increases the step; Alt makes it finer. Delete removes the selection.</p></section>
        </div>
        <div className="shortcut-table" aria-label="Keyboard shortcuts">
          <span><kbd>V</kbd>Select</span><span><kbd>W</kbd>Draw wall</span><span><kbd>R</kbd>Rectangle</span>
          <span><kbd>D</kbd>Door</span><span><kbd>N</kbd>Window</span><span><kbd>?</kbd>Help</span>
          <span><kbd>Ctrl Z</kbd>Undo</span><span><kbd>Ctrl Shift Z</kbd>Redo</span><span><kbd>Esc</kbd>Cancel</span>
        </div>
      </section>
    </div>
  );
}

export function AboutDialog({ onClose }: DialogProps) {
  const capabilities = useMemo(browserCapabilities, []);
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title">
        <div className="dialog-heading">
          <div><p className="eyebrow">Diagnostics</p><h2 id="about-title">About Floorplan</h2></div>
          <button type="button" className="icon-button" aria-label="Close about" onClick={onClose}><X size={18} /></button>
        </div>
        <dl className="build-details">
          <div><dt>Version</dt><dd>{BUILD_INFO.version}</dd></div>
          <div><dt>Build</dt><dd>{BUILD_INFO.buildId}</dd></div>
          <div><dt>Commit</dt><dd>{BUILD_INFO.commit}</dd></div>
          <div><dt>Mode</dt><dd>{BUILD_INFO.mode}</dd></div>
          <div><dt>Project schema</dt><dd>Version {BUILD_INFO.schemaVersion}</dd></div>
        </dl>
        <div className="capability-list">
          {capabilities.map((capability) => (
            <div key={capability.label} className={capability.available ? "available" : "unavailable"}>
              {capability.available ? <Check size={15} /> : <Info size={15} />}
              <span><strong>{capability.label}</strong><small>{capability.detail}</small></span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

interface WorkflowRailProps {
  onMeasuredRectangle: () => void;
  onExport: () => void;
}

export function WorkflowRail({ onMeasuredRectangle, onExport }: WorkflowRailProps) {
  const state = useProjectStore();
  const ui = useUiStore();
  const roomReady = isValidClosedRoom(state.project);
  if (ui.workflowDismissed) return null;
  const steps = [
    { label: "Define room", complete: roomReady },
    { label: "Add openings", complete: state.project.openings.length > 0 },
    { label: "Place furniture", complete: state.project.furniture.length > 0 },
    { label: "Inspect in 3D", complete: ui.visited3d },
    { label: "Download or export", complete: Boolean(state.lastDownloadedAt || ui.lastExportedAt) },
  ];
  const current = steps.findIndex((step) => !step.complete);
  const act = () => {
    if (current <= 0) onMeasuredRectangle();
    else if (current === 1) state.setTool("door");
    else if (current === 2) state.setSelectedFurnitureType("desk");
    else if (current === 3) { state.setView("3d"); ui.mark3dVisited(); }
    else onExport();
  };
  const actionLabel = ["Create measured room", "Add a door", "Place a desk", "Open 3D", "Export plan"][Math.max(0, current)];
  return (
    <aside className="workflow-rail" aria-label="Room workflow">
      <div className="workflow-heading"><span>Room workflow</span><button type="button" className="icon-button" aria-label="Dismiss workflow" onClick={() => ui.setWorkflowDismissed(true)}><X size={15} /></button></div>
      <ol>
        {steps.map((step, index) => (
          <li key={step.label} className={step.complete ? "complete" : index === current ? "current" : ""}>
            {step.complete ? <Check size={14} /> : <Circle size={12} />}<span>{step.label}</span>
          </li>
        ))}
      </ol>
      {current >= 0 && <button type="button" className="workflow-action" onClick={act}>{actionLabel}</button>}
      {current < 0 && <p>Room workflow complete.</p>}
    </aside>
  );
}

export function ToolInstruction() {
  const tool = useProjectStore((state) => state.tool);
  const project = useProjectStore((state) => state.project);
  const roomReady = isValidClosedRoom(project);
  const copy: Record<string, string> = {
    select: roomReady ? "Select geometry to edit it. Drag furniture or use the handles for precise changes." : "Create or close the room before adding openings and furniture.",
    wall: "Click connected points. Click the first point to close the room. Shift constrains angles; Alt suspends snaps.",
    rectangle: "Drag between opposite corners, or use Create measured room for keyboard entry.",
    door: "Click a wall to place a 36 in door, then adjust it on the canvas or in Properties.",
    window: "Click a wall to place a 48 in window, then adjust it on the canvas or in Properties.",
    furniture: "Click inside the room to place the selected furniture item.",
  };
  return <div className="tool-instruction"><Keyboard size={14} /><span>{copy[tool]}</span></div>;
}
