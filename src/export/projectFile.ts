import type { FloorplanProjectV1 } from "../domain/types";
import { sanitizeFilename, serializeProject } from "../domain/serialization";

interface FileSystemWritableFileStream {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface SaveFilePickerWindow extends Window {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandle>;
}

let projectFileHandle: FileSystemFileHandle | null = null;

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function directFileSaveAvailable(): boolean {
  return globalThis.isSecureContext && typeof (globalThis as unknown as SaveFilePickerWindow).showSaveFilePicker === "function";
}

export async function saveProjectFile(project: FloorplanProjectV1): Promise<"file" | "download"> {
  const filename = sanitizeFilename(project.name) + ".floorplan.json";
  const blob = new Blob([serializeProject(project)], { type: "application/json" });
  const picker = (globalThis as unknown as SaveFilePickerWindow).showSaveFilePicker;
  if (directFileSaveAvailable() && picker) {
    projectFileHandle ??= await picker({
      suggestedName: filename,
      types: [{ description: "Floorplan project", accept: { "application/json": [".floorplan.json", ".json"] } }],
    });
    const writable = await projectFileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return "file";
  }
  downloadBlob(blob, filename);
  return "download";
}
