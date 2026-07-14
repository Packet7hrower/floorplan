import { Box, Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FURNITURE_CATALOG } from "../domain/defaults";
import { formatArea, formatMeasurement, parseMeasurement } from "../domain/measurements";
import { obstructedDoorIds, orderedRoomVertices, polygonSignedArea, wallLength } from "../domain/geometry";
import type { LengthMils, Unit } from "../domain/types";
import { useProjectStore } from "../store/projectStore";

interface PropertiesPanelProps {
  roomReady: boolean;
}

interface MeasurementFieldProps {
  label: string;
  value: LengthMils;
  unit: Unit;
  onCommit: (value: LengthMils) => void;
  help?: string;
}

function MeasurementField({ label, value, unit, onCommit, help }: MeasurementFieldProps) {
  const [input, setInput] = useState(formatMeasurement(value, unit));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setInput(formatMeasurement(value, unit)), [value, unit]);
  const commit = () => {
    try {
      const parsed = parseMeasurement(input, unit);
      onCommit(parsed);
      setInput(formatMeasurement(parsed, unit));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Invalid measurement.");
    }
  };
  return (
    <label className={"field " + (error ? "invalid" : "")}>
      <span>{label}</span>
      <input value={input} onChange={(event) => setInput(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} aria-invalid={Boolean(error)} />
      {help && !error && <small>{help}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

export function PropertiesPanel({ roomReady }: PropertiesPanelProps) {
  const state = useProjectStore();
  const selectedWall = state.selection?.kind === "wall" ? state.project.walls.find((item) => item.id === state.selection?.id) : undefined;
  const selectedOpening = state.selection?.kind === "opening" ? state.project.openings.find((item) => item.id === state.selection?.id) : undefined;
  const selectedFurniture = state.selection?.kind === "furniture" ? state.project.furniture.find((item) => item.id === state.selection?.id) : undefined;
  const roomVertices = useMemo(() => orderedRoomVertices(state.project), [state.project]);
  const obstructedDoors = useMemo(() => obstructedDoorIds(state.project), [state.project]);
  const isRectangle = roomReady && state.project.vertices.length === 4 && state.project.walls.every((wall) => {
    const start = state.project.vertices.find((vertex) => vertex.id === wall.startVertexId);
    const end = state.project.vertices.find((vertex) => vertex.id === wall.endVertexId);
    return start && end && (start.x === end.x || start.y === end.y);
  });
  const roomWidth = state.project.vertices.length ? Math.round(Math.max(...state.project.vertices.map((vertex) => vertex.x)) - Math.min(...state.project.vertices.map((vertex) => vertex.x))) : 0;
  const roomDepth = state.project.vertices.length ? Math.round(Math.max(...state.project.vertices.map((vertex) => vertex.y)) - Math.min(...state.project.vertices.map((vertex) => vertex.y))) : 0;

  return (
    <aside className="properties-panel" aria-label="Properties">
      <div className="panel-heading"><span>Properties</span><span className="panel-index">02</span></div>
      {selectedWall ? (
        <>
          <div className="property-title"><div><p className="eyebrow">Wall</p><h2>Wall segment</h2></div><span className="selection-chip">Selected</span></div>
          <MeasurementField label="Length" value={Math.round(wallLength(state.project, selectedWall))} unit={state.project.displayUnit} onCommit={(value) => state.resizeWall(selectedWall.id, value, state.wallAnchor)} />
          <fieldset className="anchor-fieldset">
            <legend>Anchor</legend>
            <div className="segmented-control stretch">
              {(["start", "center", "end"] as const).map((value) => <button key={value} type="button" className={state.wallAnchor === value ? "active" : ""} onClick={() => state.setWallAnchor(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}
            </div>
            <small>The anchored point stays fixed while the wall changes.</small>
          </fieldset>
          <div className="data-row"><span>Connected vertices</span><strong>2</strong></div>
          <button type="button" className="button danger" onClick={state.deleteSelection}>Delete wall</button>
        </>
      ) : selectedOpening ? (
        <>
          <div className="property-title"><div><p className="eyebrow">{selectedOpening.kind}</p><h2>{selectedOpening.kind === "door" ? "Door opening" : "Window opening"}</h2></div><span className="selection-chip">Selected</span></div>
          <MeasurementField label="Width" value={selectedOpening.width} unit={state.project.displayUnit} onCommit={(width) => state.updateOpening(selectedOpening.id, { width })} />
          <MeasurementField label="Height" value={selectedOpening.height} unit={state.project.displayUnit} onCommit={(height) => state.updateOpening(selectedOpening.id, { height })} />
          <MeasurementField label="Offset from wall start" value={selectedOpening.offsetFromStart} unit={state.project.displayUnit} onCommit={(offsetFromStart) => state.updateOpening(selectedOpening.id, { offsetFromStart })} />
          {selectedOpening.kind === "door" && (
            <>
              <label className="field"><span>Hinge</span><select value={selectedOpening.hinge} onChange={(event) => state.updateOpening(selectedOpening.id, { hinge: event.target.value as "left" | "right" })}><option value="left">Left</option><option value="right">Right</option></select></label>
              <label className="field"><span>Swing</span><select value={selectedOpening.swing} onChange={(event) => state.updateOpening(selectedOpening.id, { swing: event.target.value as "inward" | "outward" })}><option value="inward">Inward</option><option value="outward">Outward</option></select></label>
              {obstructedDoors.has(selectedOpening.id) && <div className="inline-warning"><Info size={16} /><span><strong>Door swing obstructed</strong>Furniture may remain in this advisory clearance area.</span></div>}
            </>
          )}
          <button type="button" className="button danger" onClick={state.deleteSelection}>Delete {selectedOpening.kind}</button>
        </>
      ) : selectedFurniture ? (
        <>
          <div className="property-title"><div><p className="eyebrow">Furniture</p><h2>{FURNITURE_CATALOG[selectedFurniture.catalogType].label}</h2></div><span className="selection-chip">Selected</span></div>
          <MeasurementField label="Width" value={selectedFurniture.width} unit={state.project.displayUnit} onCommit={(width) => state.updateFurniture(selectedFurniture.id, { width })} />
          <MeasurementField label="Depth / length" value={selectedFurniture.depth} unit={state.project.displayUnit} onCommit={(depth) => state.updateFurniture(selectedFurniture.id, { depth })} />
          <MeasurementField label="Height" value={selectedFurniture.height} unit={state.project.displayUnit} onCommit={(height) => state.updateFurniture(selectedFurniture.id, { height })} />
          <label className="field"><span>Rotation</span><div className="input-suffix"><input type="number" min="-360" max="360" step="1" value={selectedFurniture.rotationDegrees} onChange={(event) => state.updateFurniture(selectedFurniture.id, { rotationDegrees: Number(event.target.value) })} /><span>°</span></div></label>
          {state.view === "3d" && <button type="button" className="button primary" onClick={() => state.setView("2d")}><Box size={16} />Edit in 2D</button>}
          <button type="button" className="button danger" onClick={state.deleteSelection}>Delete object</button>
        </>
      ) : (
        <>
          <div className="property-title"><div><p className="eyebrow">Project</p><h2>Room settings</h2></div></div>
          <label className="field"><span>Project name</span><input defaultValue={state.project.name} key={state.project.id + state.project.name} onBlur={(event) => { const name = event.target.value.trim(); if (name && name !== state.project.name) state.updateProject({ name }); }} /></label>
          {isRectangle && (
            <div className="field-grid">
              <MeasurementField label="Room width" value={roomWidth} unit={state.project.displayUnit} onCommit={(width) => state.resizeRectangle(width, roomDepth)} />
              <MeasurementField label="Room depth" value={roomDepth} unit={state.project.displayUnit} onCommit={(depth) => state.resizeRectangle(roomWidth, depth)} />
            </div>
          )}
          <MeasurementField label="Wall thickness" value={state.project.settings.wallThickness} unit={state.project.displayUnit} onCommit={(wallThickness) => state.updateSettings({ wallThickness })} />
          <MeasurementField label="Wall height" value={state.project.settings.wallHeight} unit={state.project.displayUnit} onCommit={(wallHeight) => state.updateSettings({ wallHeight })} />
          <MeasurementField label="Grid spacing" value={state.project.settings.gridSpacing} unit={state.project.displayUnit} onCommit={(gridSpacing) => state.updateSettings({ gridSpacing })} />
          {roomVertices && <div className="summary-block"><span>Interior area</span><strong>{formatArea(Math.abs(polygonSignedArea(roomVertices)), state.project.displayUnit)}</strong><small>Calculated from the closed room polygon.</small></div>}
          {!roomReady && <div className="inline-note"><Info size={16} /><span>Draw at least three connected, non-self-intersecting walls and close the polygon to enable objects, export, and 3D.</span></div>}
        </>
      )}
    </aside>
  );
}
