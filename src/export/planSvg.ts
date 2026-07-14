import { formatMeasurement } from "../domain/measurements";
import {
  createDoorSwingPolygon,
  furnitureCorners,
  openingWorldPosition,
  orderedRoomVertices,
  projectBounds,
  wallLength,
  wallVertices,
} from "../domain/geometry";
import { FURNITURE_CATALOG } from "../domain/defaults";
import type { FloorplanProjectV1, Point } from "../domain/types";

export interface ExportOptions {
  includeDimensions: boolean;
  width?: number;
  height?: number;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ?? character);
}

function path(points: Point[], close = false): string {
  if (!points.length) return "";
  return "M " + points.map((point) => point.x + " " + point.y).join(" L ") + (close ? " Z" : "");
}

export function createPlanSvg(project: FloorplanProjectV1, options: ExportOptions): string {
  const bounds = projectBounds(project, 24_000);
  const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
  const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
  const titleHeight = 16_000;
  const width = options.width ?? contentWidth;
  const height = options.height ?? contentHeight + titleHeight;
  const wallThickness = Math.max(1_000, project.settings.wallThickness);
  const polygon = orderedRoomVertices(project);
  const dimensionMarkup = options.includeDimensions ? project.walls.map((wall) => {
    const [start, end] = wallVertices(project, wall);
    const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const length = wallLength(project, wall);
    const normalLength = Math.max(length, 1);
    const offset = 10_000;
    const nx = -((end.y - start.y) / normalLength) * offset;
    const ny = ((end.x - start.x) / normalLength) * offset;
    return '<text class="dimension" x="' + (middle.x + nx) + '" y="' + (middle.y + ny) + '" text-anchor="middle">' + escapeXml(formatMeasurement(Math.round(length), project.displayUnit)) + "</text>";
  }).join("") + project.openings.map((opening) => {
    const position = openingWorldPosition(project, opening);
    return '<text class="opening-label" x="' + position.center.x + '" y="' + (position.center.y - 7_000) + '" text-anchor="middle">' + escapeXml(formatMeasurement(opening.width, project.displayUnit)) + "</text>";
  }).join("") : "";
  const openings = project.openings.map((opening) => {
    const wall = project.walls.find((item) => item.id === opening.wallId);
    if (!wall) return "";
    const [start, end] = wallVertices(project, wall);
    const length = wallLength(project, wall);
    const a = opening.offsetFromStart / length;
    const b = (opening.offsetFromStart + opening.width) / length;
    const p1 = { x: start.x + (end.x - start.x) * a, y: start.y + (end.y - start.y) * a };
    const p2 = { x: start.x + (end.x - start.x) * b, y: start.y + (end.y - start.y) * b };
    const position = openingWorldPosition(project, opening);
    if (opening.kind === "window") {
      return '<line class="opening-cut" x1="' + p1.x + '" y1="' + p1.y + '" x2="' + p2.x + '" y2="' + p2.y + '"/><line class="window" x1="' + p1.x + '" y1="' + p1.y + '" x2="' + p2.x + '" y2="' + p2.y + '"/>';
    }
    const swing = createDoorSwingPolygon(project, opening);
    return '<line class="opening-cut" x1="' + p1.x + '" y1="' + p1.y + '" x2="' + p2.x + '" y2="' + p2.y + '"/><path class="door-swing" d="' + path(swing) + '"/><circle class="hinge" cx="' + (opening.hinge === "right" ? p2.x : p1.x) + '" cy="' + (opening.hinge === "right" ? p2.y : p1.y) + '" r="1100"/><title>' + escapeXml(formatMeasurement(opening.width, project.displayUnit)) + " " + escapeXml(position.angleDegrees.toFixed(0)) + "°</title>";
  }).join("");
  const furniture = project.furniture.map((item) => {
    const corners = furnitureCorners(item);
    return '<g class="furniture"><path d="' + path(corners, true) + '"/><text x="' + item.x + '" y="' + item.y + '" text-anchor="middle" dominant-baseline="middle">' + escapeXml(FURNITURE_CATALOG[item.catalogType].label) + "</text></g>";
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${bounds.minX} ${bounds.minY - titleHeight} ${contentWidth} ${contentHeight + titleHeight}" role="img" aria-label="${escapeXml(project.name)}">
  <style>
    text { font-family: Inter, Arial, sans-serif; fill: #111318; }
    .title { font-size: 7000px; font-weight: 650; }
    .room-fill { fill: #f7f7f8; }
    .walls { fill: none; stroke: #111318; stroke-width: ${wallThickness}px; stroke-linejoin: miter; }
    .opening-cut { stroke: #fff; stroke-width: ${wallThickness + 1800}px; }
    .window { stroke: #002fa7; stroke-width: 1800px; }
    .door-swing { fill: none; stroke: #5f6368; stroke-width: 800px; }
    .hinge { fill: #002fa7; }
    .furniture path { fill: #eef0f3; stroke: #111318; stroke-width: 900px; }
    .furniture text { font-size: 4000px; }
    .dimension, .opening-label { font-size: 4000px; font-weight: 600; paint-order: stroke; stroke: #fff; stroke-width: 2400px; stroke-linejoin: round; }
  </style>
  <rect x="${bounds.minX}" y="${bounds.minY - titleHeight}" width="${contentWidth}" height="${contentHeight + titleHeight}" fill="#fff"/>
  <text class="title" x="${bounds.minX + 4000}" y="${bounds.minY - 5000}">${escapeXml(project.name)}</text>
  ${polygon ? '<path class="room-fill" d="' + path(polygon, true) + '"/><path class="walls" d="' + path(polygon, true) + '"/>' : ""}
  ${openings}
  ${furniture}
  ${dimensionMarkup}
</svg>`;
}
