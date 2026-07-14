import { useEffect, useMemo, useRef, useState } from "react";
import { formatMeasurement, parseMeasurement } from "../domain/measurements";
import {
  createDoorSwingPolygon,
  furnitureCollision,
  furnitureCorners,
  isValidClosedRoom,
  obstructedDoorIds,
  openingWorldPosition,
  orderedRoomVertices,
  polygonsOverlap,
  wallLength,
  wallVertices,
} from "../domain/geometry";
import { snapPoint, type SnapCandidate } from "../domain/snap";
import type { Point, Wall } from "../domain/types";
import { FURNITURE_CATALOG } from "../domain/defaults";
import { useProjectStore } from "../store/projectStore";

const BASE_MILS_PER_PIXEL = 200;

function pointsAttribute(points: Point[]): string {
  return points.map((point) => point.x + "," + point.y).join(" ");
}

function DimensionRail({ wall, midpoint, normal }: { wall: Wall; midpoint: Point; normal: Point }) {
  const project = useProjectStore((state) => state.project);
  const wallAnchor = useProjectStore((state) => state.wallAnchor);
  const resizeWall = useProjectStore((state) => state.resizeWall);
  const setError = useProjectStore((state) => state.setError);
  const length = Math.round(wallLength(project, wall));
  const [value, setValue] = useState(formatMeasurement(length, project.displayUnit));
  useEffect(() => setValue(formatMeasurement(length, project.displayUnit)), [length, project.displayUnit]);
  const submit = () => {
    try {
      resizeWall(wall.id, parseMeasurement(value, project.displayUnit), wallAnchor);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Wall length is invalid.");
    }
  };
  const width = 54_000;
  const height = 12_000;
  return (
    <foreignObject x={midpoint.x + normal.x - width / 2} y={midpoint.y + normal.y - height / 2} width={width} height={height} className="dimension-rail">
      <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <span aria-hidden="true" />
        <input aria-label="Exact wall length" value={value} onChange={(event) => setValue(event.target.value)} onBlur={submit} />
      </form>
    </foreignObject>
  );
}

export function PlanCanvas() {
  const state = useProjectStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [pointerWorld, setPointerWorld] = useState<Point | null>(null);
  const [rectangleStart, setRectangleStart] = useState<Point | null>(null);
  const [snap, setSnap] = useState<SnapCandidate | null>(null);
  const [panDrag, setPanDrag] = useState<{ screen: Point; pan: Point } | null>(null);
  const [furnitureDrag, setFurnitureDrag] = useState<{ id: string; point: Point } | null>(null);
  const roomPolygon = useMemo(() => orderedRoomVertices(state.project), [state.project]);
  const roomCenter = useMemo(() => roomPolygon ? {
    x: roomPolygon.reduce((sum, point) => sum + point.x, 0) / roomPolygon.length,
    y: roomPolygon.reduce((sum, point) => sum + point.y, 0) / roomPolygon.length,
  } : null, [roomPolygon]);
  const obstructed = useMemo(() => obstructedDoorIds(state.project), [state.project]);
  const viewWidth = (size.width * BASE_MILS_PER_PIXEL) / (state.zoom / 100);
  const viewHeight = (size.height * BASE_MILS_PER_PIXEL) / (state.zoom / 100);
  const viewBox = [state.pan.x - viewWidth / 2, state.pan.y - viewHeight / 2, viewWidth, viewHeight].join(" ");

  useEffect(() => {
    if (!svgRef.current) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => { if (event.code === "Space" && !(event.target as HTMLElement).matches("input, textarea")) { setSpaceHeld(true); event.preventDefault(); } };
    const up = (event: KeyboardEvent) => { if (event.code === "Space") setSpaceHeld(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const toWorld = (clientX: number, clientY: number): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const world = point.matrixTransform(svg.getScreenCTM()?.inverse());
    return { x: Math.round(world.x), y: Math.round(world.y) };
  };

  const snapped = (point: Point, event: { altKey: boolean; shiftKey: boolean }): Point => {
    const last = state.project.vertices.at(-1);
    const result = snapPoint(state.project, point, {
      enabled: state.project.settings.snappingEnabled,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      thresholdScreenPx: 12,
      screenPixelsPerMil: size.width / viewWidth,
      origin: state.tool === "wall" && last ? last : undefined,
    });
    setSnap(result.candidate);
    return result.point;
  };

  const pointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (panDrag) {
      const scale = viewWidth / Math.max(size.width, 1);
      state.setViewport(state.zoom, {
        x: panDrag.pan.x - (event.clientX - panDrag.screen.x) * scale,
        y: panDrag.pan.y - (event.clientY - panDrag.screen.y) * scale,
      });
      return;
    }
    const point = snapped(toWorld(event.clientX, event.clientY), event);
    setPointerWorld(point);
    if (furnitureDrag) setFurnitureDrag({ ...furnitureDrag, point });
  };

  const pointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button === 1 || spaceHeld) {
      event.preventDefault();
      svgRef.current?.setPointerCapture(event.pointerId);
      setPanDrag({ screen: { x: event.clientX, y: event.clientY }, pan: state.pan });
      return;
    }
    const point = snapped(toWorld(event.clientX, event.clientY), event);
    if (state.tool === "rectangle" && event.button === 0 && !state.project.walls.length) {
      svgRef.current?.setPointerCapture(event.pointerId);
      setRectangleStart(point);
    }
  };

  const pointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (panDrag) {
      setPanDrag(null);
      svgRef.current?.releasePointerCapture(event.pointerId);
      return;
    }
    const point = snapped(toWorld(event.clientX, event.clientY), event);
    if (rectangleStart) {
      if (Math.abs(point.x - rectangleStart.x) > 1_000 && Math.abs(point.y - rectangleStart.y) > 1_000) state.addRectangle(rectangleStart, point);
      else state.setError("Drag to define both rectangle dimensions.");
      setRectangleStart(null);
      svgRef.current?.releasePointerCapture(event.pointerId);
    }
    if (furnitureDrag) {
      state.moveFurnitureClamped(furnitureDrag.id, furnitureDrag.point);
      setFurnitureDrag(null);
    }
  };

  const canvasClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (panDrag || rectangleStart) return;
    const point = snapped(toWorld(event.clientX, event.clientY), event);
    if (state.tool === "wall") {
      const first = state.project.vertices[0];
      const close = first && state.project.walls.length >= 2 && Math.hypot(point.x - first.x, point.y - first.y) <= (12 * viewWidth) / size.width;
      state.appendWallVertex(close ? first : point, close ? first.id : undefined);
      return;
    }
    if (state.tool === "furniture") {
      state.addFurniture(state.selectedFurnitureType, point);
      return;
    }
    if (state.tool === "select") state.setSelection(null);
  };

  const wheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const before = toWorld(event.clientX, event.clientY);
    const nextZoom = Math.min(800, Math.max(10, state.zoom * Math.exp(-event.deltaY * 0.0015)));
    const factor = state.zoom / nextZoom;
    state.setViewport(nextZoom, {
      x: before.x - (before.x - state.pan.x) * factor,
      y: before.y - (before.y - state.pan.y) * factor,
    });
  };

  const previewStart = state.tool === "wall" ? state.project.vertices.at(-1) : undefined;
  const grid = state.project.settings.gridSpacing;
  const dragCandidate = furnitureDrag ? (() => {
    const item = state.project.furniture.find((candidate) => candidate.id === furnitureDrag.id);
    return item ? { ...item, x: furnitureDrag.point.x, y: furnitureDrag.point.y } : null;
  })() : null;
  const dragCollision = dragCandidate ? furnitureCollision(state.project, dragCandidate, dragCandidate.id) : null;
  const warningFurniture = new Set(state.project.furniture.filter((item) => state.project.openings.some((opening) => obstructed.has(opening.id) && polygonsOverlap(createDoorSwingPolygon(state.project, opening), furnitureCorners(item)))).map((item) => item.id));

  return (
    <div className={"plan-canvas-wrap " + (spaceHeld || panDrag ? "panning" : "")}>
      <svg
        ref={svgRef}
        className="plan-canvas"
        viewBox={viewBox}
        onPointerMove={pointerMove}
        onPointerDown={pointerDown}
        onPointerUp={pointerUp}
        onPointerLeave={() => { if (!panDrag) { setPointerWorld(null); setSnap(null); } }}
        onClick={canvasClick}
        onWheel={wheel}
        aria-label="Floorplan drafting canvas"
      >
        <defs>
          <pattern id="minor-grid" width={grid} height={grid} patternUnits="userSpaceOnUse">
            <path d={"M " + grid + " 0 L 0 0 0 " + grid} fill="none" stroke="#e6e8ec" strokeWidth={Math.max(250, viewWidth / size.width * 0.5)} />
          </pattern>
        </defs>
        <rect x={state.pan.x - viewWidth} y={state.pan.y - viewHeight} width={viewWidth * 2} height={viewHeight * 2} fill="#fff" />
        <rect x={state.pan.x - viewWidth} y={state.pan.y - viewHeight} width={viewWidth * 2} height={viewHeight * 2} fill="url(#minor-grid)" className="grid-surface" />
        {roomPolygon && <polygon points={pointsAttribute(roomPolygon)} className="room-polygon" />}
        <g className="walls">
          {state.project.walls.map((wall) => {
            const [start, end] = wallVertices(state.project, wall);
            const selected = state.selection?.kind === "wall" && state.selection.id === wall.id;
            const length = wallLength(state.project, wall);
            const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
            let normal = { x: -((end.y - start.y) / length) * 13_000, y: ((end.x - start.x) / length) * 13_000 };
            if (roomCenter) {
              const toward = Math.hypot(middle.x + normal.x - roomCenter.x, middle.y + normal.y - roomCenter.y);
              const away = Math.hypot(middle.x - normal.x - roomCenter.x, middle.y - normal.y - roomCenter.y);
              if (toward < away) normal = { x: -normal.x, y: -normal.y };
            }
            return (
              <g key={wall.id} className={(selected ? "selected " : "") + (dragCollision === "wall" ? "blocking" : "")}>
                <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} className="wall-hit" onClick={(event) => {
                  event.stopPropagation();
                  if (state.tool === "door" || state.tool === "window") state.addOpening(wall.id, state.tool);
                  else if (state.tool === "select") state.setSelection({ kind: "wall", id: wall.id });
                }} />
                <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} className="wall-line" style={{ strokeWidth: state.project.settings.wallThickness }} />
                {(state.project.settings.showAllWallDimensions || selected) && !selected && <text x={middle.x + normal.x} y={middle.y + normal.y} className="canvas-dimension" textAnchor="middle">{formatMeasurement(Math.round(length), state.project.displayUnit)}</text>}
                {selected && <>
                  <circle
                    cx={state.wallAnchor === "start" ? start.x : state.wallAnchor === "end" ? end.x : middle.x}
                    cy={state.wallAnchor === "start" ? start.y : state.wallAnchor === "end" ? end.y : middle.y}
                    r={3_200}
                    className="anchor-marker"
                  />
                  <DimensionRail wall={wall} midpoint={middle} normal={normal} />
                </>}
              </g>
            );
          })}
        </g>
        <g className="openings">
          {state.project.openings.map((opening) => {
            const wall = state.project.walls.find((item) => item.id === opening.wallId);
            if (!wall) return null;
            const [start, end] = wallVertices(state.project, wall);
            const length = wallLength(state.project, wall);
            const p1 = { x: start.x + ((end.x - start.x) * opening.offsetFromStart) / length, y: start.y + ((end.y - start.y) * opening.offsetFromStart) / length };
            const p2 = { x: start.x + ((end.x - start.x) * (opening.offsetFromStart + opening.width)) / length, y: start.y + ((end.y - start.y) * (opening.offsetFromStart + opening.width)) / length };
            const selected = state.selection?.kind === "opening" && state.selection.id === opening.id;
            const swing = createDoorSwingPolygon(state.project, opening);
            return (
              <g key={opening.id} className={(selected ? "selected " : "") + (obstructed.has(opening.id) ? "warning" : "")} onClick={(event) => { event.stopPropagation(); if (state.tool === "select") state.setSelection({ kind: "opening", id: opening.id }); }}>
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className="opening-cut" style={{ strokeWidth: state.project.settings.wallThickness + 2_000 }} />
                {opening.kind === "window" ? <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className="window-line" /> : <><polyline points={pointsAttribute(swing)} className="swing-arc" /><circle cx={opening.hinge === "right" ? p2.x : p1.x} cy={opening.hinge === "right" ? p2.y : p1.y} r={2_100} className="hinge-dot" /></>}
                {selected && <text x={openingWorldPosition(state.project, opening).center.x} y={openingWorldPosition(state.project, opening).center.y - 8_000} className="canvas-dimension" textAnchor="middle">{formatMeasurement(opening.width, state.project.displayUnit)}</text>}
              </g>
            );
          })}
        </g>
        <g className="furniture-layer">
          {state.project.furniture.map((item) => {
            const corners = furnitureDrag?.id === item.id ? furnitureCorners({ ...item, x: furnitureDrag.point.x, y: furnitureDrag.point.y }) : furnitureCorners(item);
            const selected = state.selection?.kind === "furniture" && state.selection.id === item.id;
            return (
              <g key={item.id} className={(selected ? "selected " : "") + (warningFurniture.has(item.id) ? "warning " : "") + (dragCollision === item.id || furnitureDrag?.id === item.id && dragCollision ? "blocking" : "")} onPointerDown={(event) => {
                if (state.tool !== "select") return;
                event.stopPropagation();
                state.setSelection({ kind: "furniture", id: item.id });
                setFurnitureDrag({ id: item.id, point: { x: item.x, y: item.y } });
              }} onClick={(event) => { if (state.tool === "select") event.stopPropagation(); }}>
                <polygon points={pointsAttribute(corners)} />
                <text x={furnitureDrag?.id === item.id ? furnitureDrag.point.x : item.x} y={furnitureDrag?.id === item.id ? furnitureDrag.point.y : item.y} textAnchor="middle" dominantBaseline="middle">{FURNITURE_CATALOG[item.catalogType].label}</text>
              </g>
            );
          })}
        </g>
        {rectangleStart && pointerWorld && (
          <g className="drawing-preview">
            <rect x={Math.min(rectangleStart.x, pointerWorld.x)} y={Math.min(rectangleStart.y, pointerWorld.y)} width={Math.abs(pointerWorld.x - rectangleStart.x)} height={Math.abs(pointerWorld.y - rectangleStart.y)} />
            <text x={(rectangleStart.x + pointerWorld.x) / 2} y={Math.min(rectangleStart.y, pointerWorld.y) - 8_000} textAnchor="middle">{formatMeasurement(Math.abs(pointerWorld.x - rectangleStart.x), state.project.displayUnit)} × {formatMeasurement(Math.abs(pointerWorld.y - rectangleStart.y), state.project.displayUnit)}</text>
          </g>
        )}
        {previewStart && pointerWorld && !isValidClosedRoom(state.project) && (
          <g className="drawing-preview">
            <line x1={previewStart.x} y1={previewStart.y} x2={pointerWorld.x} y2={pointerWorld.y} />
            <text x={(previewStart.x + pointerWorld.x) / 2} y={(previewStart.y + pointerWorld.y) / 2 - 8_000} textAnchor="middle">{formatMeasurement(Math.round(Math.hypot(pointerWorld.x - previewStart.x, pointerWorld.y - previewStart.y)), state.project.displayUnit)}</text>
          </g>
        )}
        {snap && pointerWorld && <g className="snap-guide"><circle cx={pointerWorld.x} cy={pointerWorld.y} r={4_000} /><text x={pointerWorld.x + 6_000} y={pointerWorld.y - 6_000}>{snap.label}</text></g>}
      </svg>
      {!state.project.walls.length && !state.project.vertices.length && (
        <section className="empty-prompt" aria-label="First run guidance">
          <span className="prompt-number">01</span>
          <h1>Draw walls to create a room</h1>
          <p>Start with a rectangle or load an editable sample room with openings and furniture.</p>
          <div>
            <button type="button" className="button primary" onClick={() => state.setTool("rectangle")}>Draw rectangle</button>
            <button type="button" className="button secondary" onClick={state.loadSample}>Load sample room</button>
          </div>
        </section>
      )}
      <div className="canvas-help">{state.tool === "wall" ? "Click to place walls · Shift: 45° · Alt: suspend snaps · Esc: cancel" : state.tool === "rectangle" ? "Click and drag between opposite corners" : "Wheel: zoom · Space-drag or middle-drag: pan"}</div>
    </div>
  );
}
