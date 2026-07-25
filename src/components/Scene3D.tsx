import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Box, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { DEFAULT_WINDOW, FURNITURE_CATALOG } from "../domain/defaults";
import { openingWorldPosition, orderedRoomVertices, projectBounds, wallLength, wallVertices } from "../domain/geometry";
import { formatMeasurement } from "../domain/measurements";
import type { FloorplanProjectV1, FurnitureInstance, Opening, Selection, Wall } from "../domain/types";
import { useProjectStore } from "../store/projectStore";
import { useUiStore } from "../store/uiStore";

const SCALE = 1 / 1_000;

function WallBox({ project, wall, from, to, bottom, top, selected }: { project: FloorplanProjectV1; wall: Wall; from: number; to: number; bottom: number; top: number; selected: boolean }) {
  const wallOpacity = useUiStore((state) => state.wallOpacity);
  const [start, end] = wallVertices(project, wall);
  const total = wallLength(project, wall);
  const direction = { x: (end.x - start.x) / total, y: (end.y - start.y) / total };
  const middle = (from + to) / 2;
  const x = (start.x + direction.x * middle) * SCALE;
  const z = (start.y + direction.y * middle) * SCALE;
  const angle = -Math.atan2(end.y - start.y, end.x - start.x);
  return (
    <mesh position={[x, ((bottom + top) / 2) * SCALE, z]} rotation={[0, angle, 0]} castShadow receiveShadow>
      <boxGeometry args={[(to - from) * SCALE, (top - bottom) * SCALE, project.settings.wallThickness * SCALE]} />
      <meshStandardMaterial color={selected ? "#002fa7" : "#f4f3ef"} roughness={0.86} metalness={0} transparent={wallOpacity < 1} opacity={wallOpacity} depthWrite={wallOpacity > 0.45} />
    </mesh>
  );
}

function WallModel({ project, wall }: { project: FloorplanProjectV1; wall: Wall }) {
  const selected = useProjectStore((state) => state.selection?.kind === "wall" && state.selection.id === wall.id);
  const setSelection = useProjectStore((state) => state.setSelection);
  const length = wallLength(project, wall);
  const height = project.settings.wallHeight;
  const openings = project.openings.filter((opening) => opening.wallId === wall.id).sort((a, b) => a.offsetFromStart - b.offsetFromStart);
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  openings.forEach((opening) => {
    if (opening.offsetFromStart > cursor) pieces.push(<WallBox key={opening.id + "-before"} project={project} wall={wall} from={cursor} to={opening.offsetFromStart} bottom={0} top={height} selected={selected} />);
    const sill = opening.kind === "window" ? DEFAULT_WINDOW.sillHeight : 0;
    if (sill > 0) pieces.push(<WallBox key={opening.id + "-sill"} project={project} wall={wall} from={opening.offsetFromStart} to={opening.offsetFromStart + opening.width} bottom={0} top={sill} selected={selected} />);
    const topStart = Math.min(height, sill + opening.height);
    if (topStart < height) pieces.push(<WallBox key={opening.id + "-header"} project={project} wall={wall} from={opening.offsetFromStart} to={opening.offsetFromStart + opening.width} bottom={topStart} top={height} selected={selected} />);
    cursor = opening.offsetFromStart + opening.width;
  });
  if (cursor < length) pieces.push(<WallBox key="after" project={project} wall={wall} from={cursor} to={length} bottom={0} top={height} selected={selected} />);
  return <group onClick={(event) => { event.stopPropagation(); setSelection({ kind: "wall", id: wall.id }); }}>{pieces}</group>;
}

function OpeningModel({ project, opening }: { project: FloorplanProjectV1; opening: Opening }) {
  const selected = useProjectStore((state) => state.selection?.kind === "opening" && state.selection.id === opening.id);
  const setSelection = useProjectStore((state) => state.setSelection);
  const wall = project.walls.find((candidate) => candidate.id === opening.wallId);
  if (!wall) return null;
  const [start, end] = wallVertices(project, wall);
  const total = wallLength(project, wall);
  const direction = { x: (end.x - start.x) / total, y: (end.y - start.y) / total };
  const centerOffset = opening.offsetFromStart + opening.width / 2;
  const position: [number, number, number] = [
    (start.x + direction.x * centerOffset) * SCALE,
    ((opening.kind === "window" ? DEFAULT_WINDOW.sillHeight : 0) + opening.height / 2) * SCALE,
    (start.y + direction.y * centerOffset) * SCALE,
  ];
  const angle = -Math.atan2(end.y - start.y, end.x - start.x);
  return (
    <mesh position={position} rotation={[0, angle, 0]} onClick={(event) => { event.stopPropagation(); setSelection({ kind: "opening", id: opening.id }); }} castShadow>
      <boxGeometry args={[opening.width * SCALE, opening.height * SCALE, (opening.kind === "window" ? 0.45 : 1.25)]} />
      <meshStandardMaterial color={selected ? "#002fa7" : opening.kind === "window" ? "#9fc5d6" : "#9b7355"} roughness={opening.kind === "window" ? 0.2 : 0.72} transparent={opening.kind === "window"} opacity={opening.kind === "window" ? 0.58 : 1} />
    </mesh>
  );
}

function BoxPart({ position, size, color = "#9b7355" }: { position: [number, number, number]; size: [number, number, number]; color?: string }) {
  return <mesh position={position} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.78} metalness={0} /></mesh>;
}

function FurnitureGeometry({ item, selected }: { item: FurnitureInstance; selected: boolean }) {
  const w = item.width * SCALE;
  const d = item.depth * SCALE;
  const h = item.height * SCALE;
  const accent = selected ? "#002fa7" : "#8a694f";
  const dark = selected ? "#002fa7" : "#343941";
  const type = item.catalogType;
  if (type === "desk" || type === "table") return (
    <>
      <BoxPart position={[0, h - 1.5, 0]} size={[w, 3, d]} color={accent} />
      {[[-w / 2 + 2, h / 2 - 1.5, -d / 2 + 2], [w / 2 - 2, h / 2 - 1.5, -d / 2 + 2], [-w / 2 + 2, h / 2 - 1.5, d / 2 - 2], [w / 2 - 2, h / 2 - 1.5, d / 2 - 2]].map((position, index) => <BoxPart key={index} position={position as [number, number, number]} size={[2.5, h - 3, 2.5]} color={dark} />)}
    </>
  );
  if (type.includes("chair")) return (
    <>
      <BoxPart position={[0, h * 0.46, 0]} size={[w, 3, d * 0.86]} color={accent} />
      <BoxPart position={[0, h * 0.72, d * 0.38]} size={[w, h * 0.48, 3]} color={accent} />
      {[[-w * 0.38, h * 0.23, -d * 0.33], [w * 0.38, h * 0.23, -d * 0.33], [-w * 0.38, h * 0.23, d * 0.33], [w * 0.38, h * 0.23, d * 0.33]].map((position, index) => <BoxPart key={index} position={position as [number, number, number]} size={[2, h * 0.46, 2]} color={dark} />)}
    </>
  );
  if (type === "sofa") return (
    <>
      <BoxPart position={[0, h * 0.32, 0]} size={[w, h * 0.55, d]} color={accent} />
      <BoxPart position={[0, h * 0.72, d * 0.4]} size={[w, h * 0.56, d * 0.2]} color={accent} />
      <BoxPart position={[-w * 0.46, h * 0.58, 0]} size={[w * 0.1, h * 0.45, d]} color={accent} />
      <BoxPart position={[w * 0.46, h * 0.58, 0]} size={[w * 0.1, h * 0.45, d]} color={accent} />
    </>
  );
  if (type === "bed") return <><BoxPart position={[0, h * 0.42, 0]} size={[w, h * 0.7, d]} color="#c9c8c2" /><BoxPart position={[0, h * 0.55, d * 0.46]} size={[w, h * 0.9, d * 0.08]} color={accent} /></>;
  if (type === "tv" || type === "computer-monitor") return (
    <>
      <BoxPart position={[0, h * 0.62, 0]} size={[w, h * 0.7, Math.max(1.5, d * 0.28)]} color={dark} />
      <BoxPart position={[0, h * 0.18, 0]} size={[2, h * 0.28, 2]} color={dark} />
      <BoxPart position={[0, 1, 0]} size={[w * 0.45, 2, Math.max(4, d)]} color={dark} />
    </>
  );
  if (type === "speaker") return <><BoxPart position={[0, h / 2, 0]} size={[w, h, d]} color={dark} /><mesh position={[0, h * 0.62, -d / 2 - 0.1]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[w * 0.25, w * 0.25, 0.8, 20]} /><meshStandardMaterial color="#111318" /></mesh></>;
  if (type === "bookshelf") return (
    <>
      <BoxPart position={[0, h / 2, d * 0.42]} size={[w, h, d * 0.12]} color={accent} />
      {[-0.47, 0.47].map((x) => <BoxPart key={x} position={[w * x, h / 2, 0]} size={[w * 0.06, h, d]} color={accent} />)}
      {[0.03, 0.27, 0.51, 0.75, 0.97].map((y) => <BoxPart key={y} position={[0, h * y, 0]} size={[w, h * 0.035, d]} color={accent} />)}
    </>
  );
  return <BoxPart position={[0, h / 2, 0]} size={[w, h, d]} color={type === "tv-stand" ? dark : accent} />;
}

function FurnitureModel({ item }: { item: FurnitureInstance }) {
  const selection = useProjectStore((state) => state.selection);
  const setSelection = useProjectStore((state) => state.setSelection);
  const selected = selection?.kind === "furniture" && selection.id === item.id;
  return (
    <group
      position={[item.x * SCALE, 0, item.y * SCALE]}
      rotation={[0, (-item.rotationDegrees * Math.PI) / 180, 0]}
      onClick={(event) => { event.stopPropagation(); setSelection({ kind: "furniture", id: item.id }); }}
      name={FURNITURE_CATALOG[item.catalogType].label}
    >
      <FurnitureGeometry item={item} selected={selected} />
    </group>
  );
}

function RoomScene({ project }: { project: FloorplanProjectV1 }) {
  const polygon = orderedRoomVertices(project);
  const shape = useMemo(() => {
    if (!polygon) return null;
    const result = new THREE.Shape();
    polygon.forEach((point, index) => {
      const x = point.x * SCALE;
      const y = point.y * SCALE;
      if (index === 0) result.moveTo(x, y);
      else result.lineTo(x, y);
    });
    result.closePath();
    return result;
  }, [polygon]);
  return (
    <group onClick={() => useProjectStore.getState().setSelection(null)}>
      {shape && <mesh rotation={[Math.PI / 2, 0, 0]} receiveShadow><shapeGeometry args={[shape]} /><meshStandardMaterial color="#d9dadd" roughness={0.94} side={THREE.DoubleSide} /></mesh>}
      {project.walls.map((wall) => <WallModel key={wall.id} project={project} wall={wall} />)}
      {project.openings.map((opening) => <OpeningModel key={opening.id} project={project} opening={opening} />)}
      {project.furniture.map((item) => <FurnitureModel key={item.id} item={item} />)}
    </group>
  );
}

function selectionTarget(project: FloorplanProjectV1, selection: Selection): [number, number, number] | null {
  if (!selection) return null;
  if (selection.kind === "furniture") {
    const item = project.furniture.find((candidate) => candidate.id === selection.id);
    return item ? [item.x * SCALE, item.height * SCALE * 0.5, item.y * SCALE] : null;
  }
  if (selection.kind === "opening") {
    const opening = project.openings.find((candidate) => candidate.id === selection.id);
    if (!opening) return null;
    const center = openingWorldPosition(project, opening).center;
    const height = (opening.kind === "window" ? DEFAULT_WINDOW.sillHeight : 0) + opening.height / 2;
    return [center.x * SCALE, height * SCALE, center.y * SCALE];
  }
  const wall = project.walls.find((candidate) => candidate.id === selection.id);
  if (!wall) return null;
  const [start, end] = wallVertices(project, wall);
  return [((start.x + end.x) / 2) * SCALE, project.settings.wallHeight * SCALE * 0.45, ((start.y + end.y) / 2) * SCALE];
}

function SceneCamera({
  center,
  focus,
  projectId,
  span,
  wallHeight,
}: {
  center: [number, number, number];
  focus: [number, number, number] | null;
  projectId: string;
  span: number;
  wallHeight: number;
}) {
  const camera = useThree((state) => state.camera);
  const controls = useRef<OrbitControlsImpl>(null);
  const cameraRequest = useUiStore((state) => state.cameraRequest);
  const cameraPreset = useUiStore((state) => state.cameraPreset);
  const cameraState = useUiStore((state) => state.cameraStates[projectId] ?? null);
  const setCameraState = useUiStore((state) => state.setCameraState);
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (!cameraState) return;
    camera.position.set(...cameraState.position);
    controls.current?.target.set(...cameraState.target);
    controls.current?.update();
  }, [camera, cameraState]);
  useEffect(() => {
    if (!cameraRequest) return;
    const target = cameraPreset === "selection" && focus ? focus : center;
    const distance = cameraPreset === "selection" ? Math.max(80, span * 0.75) : Math.max(240, span * 1.8);
    const position: [number, number, number] = cameraPreset === "top"
      ? [target[0], Math.max(180, distance * 1.35), target[2] + 0.01]
      : cameraPreset === "eye"
        ? [target[0] + distance, Math.max(48, wallHeight * 0.55), target[2] + distance * 0.12]
        : cameraPreset === "selection"
          ? [target[0] + distance * 0.55, target[1] + distance * 0.38, target[2] + distance * 0.55]
          : [center[0] + distance * 0.58, distance * 1.1, center[2] + distance * 0.7];
    camera.position.set(...position);
    camera.up.set(0, 1, 0);
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
    controls.current?.target.set(...target);
    controls.current?.update();
  }, [camera, cameraPreset, cameraRequest, center, focus, span, wallHeight]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={center}
      minDistance={24}
      maxDistance={2000}
      onEnd={() => {
        if (!controls.current) return;
        setCameraState(projectId, {
          position: camera.position.toArray() as [number, number, number],
          target: controls.current.target.toArray() as [number, number, number],
        });
      }}
    />
  );
}

function selectionDetails(project: FloorplanProjectV1, selection: Selection): { label: string; detail: string } | null {
  if (!selection) return null;
  if (selection.kind === "furniture") {
    const item = project.furniture.find((candidate) => candidate.id === selection.id);
    return item ? {
      label: FURNITURE_CATALOG[item.catalogType].label,
      detail: `${formatMeasurement(item.width, project.displayUnit)} × ${formatMeasurement(item.depth, project.displayUnit)}`,
    } : null;
  }
  if (selection.kind === "opening") {
    const opening = project.openings.find((candidate) => candidate.id === selection.id);
    return opening ? {
      label: opening.kind === "door" ? "Door opening" : "Window opening",
      detail: `${formatMeasurement(opening.width, project.displayUnit)} wide`,
    } : null;
  }
  const wall = project.walls.find((candidate) => candidate.id === selection.id);
  return wall ? { label: "Wall segment", detail: formatMeasurement(Math.round(wallLength(project, wall)), project.displayUnit) } : null;
}

export function Scene3D() {
  const project = useProjectStore((state) => state.project);
  const selection = useProjectStore((state) => state.selection);
  const setView = useProjectStore((state) => state.setView);
  const ui = useUiStore();
  const bounds = projectBounds(project);
  const centerX = ((bounds.minX + bounds.maxX) / 2) * SCALE;
  const centerZ = ((bounds.minY + bounds.maxY) / 2) * SCALE;
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * SCALE;
  const cameraDistance = Math.max(240, span * 1.8);
  const center = useMemo<[number, number, number]>(() => [centerX, project.settings.wallHeight * SCALE * 0.35, centerZ], [centerX, centerZ, project.settings.wallHeight]);
  const focus = useMemo(() => selectionTarget(project, selection), [project, selection]);
  const details = useMemo(() => selectionDetails(project, selection), [project, selection]);
  return (
    <div className="scene-3d">
      <Canvas
        shadows
        camera={{ position: [centerX + cameraDistance * 0.58, cameraDistance * 1.1, centerZ + cameraDistance * 0.7], fov: 42, near: 0.1, far: 5000 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.setClearColor("#eef0f3");
        }}
      >
        <hemisphereLight args={["#ffffff", "#818896", 1.35]} />
        <ambientLight intensity={0.42} />
        <directionalLight position={[centerX - 80, 180, centerZ + 100]} intensity={2.2} color="#fffaf2" castShadow shadow-mapSize={[2048, 2048]} shadow-radius={7} />
        <RoomScene project={project} />
        <ContactShadows position={[0, 0.05, 0]} opacity={0.3} scale={Math.max(400, span * 2)} blur={2.8} far={220} />
        <SceneCamera center={center} focus={focus} projectId={project.id} span={span} wallHeight={project.settings.wallHeight * SCALE} />
      </Canvas>
      <div className="view-badge"><span>3D inspection</span><small>Camera and selection · geometry edits stay in 2D</small></div>
      {ui.show3dLabels && details && (
        <div className="scene-selection-label">
          <span className="eyebrow">Selected</span><strong>{details.label}</strong><small>{details.detail}</small>
          <button type="button" className="button primary" onClick={() => setView("2d")}><Box size={15} />Edit in 2D</button>
        </div>
      )}
      <button type="button" className="button secondary reset-camera" onClick={() => ui.requestCameraPreset("isometric")}><RotateCcw size={16} />Reset camera</button>
    </div>
  );
}
