import { jsPDF } from "jspdf";
import "svg2pdf.js";
import type { FloorplanProjectV1 } from "../domain/types";
import { sanitizeFilename, serializeProject } from "../domain/serialization";
import { createPlanSvg } from "./planSvg";

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function downloadProject(project: FloorplanProjectV1): void {
  downloadBlob(new Blob([serializeProject(project)], { type: "application/json" }), sanitizeFilename(project.name) + ".floorplan.json");
}

export function downloadSvg(project: FloorplanProjectV1, includeDimensions: boolean): void {
  downloadBlob(new Blob([createPlanSvg(project, { includeDimensions })], { type: "image/svg+xml" }), sanitizeFilename(project.name) + ".svg");
}

let interFontBase64: Promise<string> | null = null;

function loadInterFont(): Promise<string> {
  if (!interFontBase64) {
    interFontBase64 = fetch("/fonts/InterVariable.ttf")
      .then((response) => {
        if (!response.ok) throw new Error("Bundled Inter font could not be loaded for PDF export.");
        return response.arrayBuffer();
      })
      .then((buffer) => {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        const chunkSize = 32_768;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
        }
        return btoa(binary);
      });
  }
  return interFontBase64;
}

export async function downloadPdf(project: FloorplanProjectV1, includeDimensions: boolean): Promise<void> {
  const svgText = createPlanSvg(project, { includeDimensions, width: 792, height: 612 });
  const svg = new DOMParser().parseFromString(svgText, "image/svg+xml").documentElement as unknown as SVGElement;
  const document = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter", compress: true });
  const font = await loadInterFont();
  document.addFileToVFS("InterVariable.ttf", font);
  document.addFont("InterVariable.ttf", "Inter", "normal");
  document.addFont("InterVariable.ttf", "Inter", "bold");
  document.setFont("Inter", "normal");
  await document.svg(svg, { x: 24, y: 24, width: 744, height: 564 });
  document.save(sanitizeFilename(project.name) + ".pdf");
}

export async function downloadPng(project: FloorplanProjectV1, includeDimensions: boolean): Promise<void> {
  const svgText = createPlanSvg(project, { includeDimensions, width: 3300, height: 2550 });
  const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The PNG renderer could not load the plan."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 3300;
    canvas.height = 2550;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The PNG renderer is unavailable.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG encoding failed.")), "image/png"));
    downloadBlob(blob, sanitizeFilename(project.name) + ".png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
