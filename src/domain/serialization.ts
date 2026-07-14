import type { FloorplanProjectV1 } from "./types";
import { migrateProject } from "./validation";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, stableValue(nested)]));
  }
  return value;
}

export function serializeProject(project: FloorplanProjectV1): string {
  return JSON.stringify(stableValue(project), null, 2) + "\n";
}

export function deserializeProject(json: string): FloorplanProjectV1 {
  let input: unknown;
  try {
    input = JSON.parse(json);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }
  return migrateProject(input);
}

export function sanitizeFilename(value: string): string {
  const printable = [...value.normalize("NFKD")].filter((character) => character.charCodeAt(0) > 31).join("");
  const sanitized = printable
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .toLowerCase();
  return sanitized.slice(0, 80) || "floorplan";
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
