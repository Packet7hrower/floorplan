import type { FloorplanProjectV1 } from "../domain/types";
import { deserializeProject, serializeProject, sha256 } from "../domain/serialization";
import { generateUuid } from "../utils/uuid";

const DATABASE = "floorplan-recovery";
const SNAPSHOT_STORE = "snapshots";
const PROJECT_STORE = "projects";
const VERSION = 2;
const MAX_SNAPSHOTS = 3;

export interface RecoverySnapshot {
  id: string;
  timestamp: string;
  schemaVersion: 1;
  checksum: string;
  projectJson: string;
  label?: string;
  kind?: "automatic" | "named";
}

export interface LocalProjectRecord {
  id: string;
  projectName: string;
  updatedAt: string;
  schemaVersion: 1;
  projectJson: string;
  thumbnailSvg: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) database.createObjectStore(SNAPSHOT_STORE, { keyPath: "id" });
      if (!database.objectStoreNames.contains(PROJECT_STORE)) database.createObjectStore(PROJECT_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB could not be opened."));
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Recovery transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Recovery transaction was interrupted."));
  });
}

export async function makeSnapshot(project: FloorplanProjectV1, label?: string, kind: "automatic" | "named" = "automatic"): Promise<RecoverySnapshot> {
  const projectJson = serializeProject(project);
  return {
    id: generateUuid(),
    timestamp: new Date().toISOString(),
    schemaVersion: 1,
    checksum: await sha256(projectJson),
    projectJson,
    label,
    kind,
  };
}

export function chooseSnapshotIdsToPrune(snapshots: RecoverySnapshot[], limit = MAX_SNAPSHOTS): string[] {
  return [...snapshots]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(limit)
    .map((snapshot) => snapshot.id);
}

export async function writeRecoverySnapshot(project: FloorplanProjectV1, label?: string, kind: "automatic" | "named" = "automatic"): Promise<void> {
  const database = await openDatabase();
  try {
    const snapshot = await makeSnapshot(project, label, kind);
    const write = database.transaction(SNAPSHOT_STORE, "readwrite");
    write.objectStore(SNAPSHOT_STORE).put(snapshot);
    await waitForTransaction(write);
    const snapshots = await listRecoverySnapshots(database);
    const staleIds = chooseSnapshotIdsToPrune(snapshots);
    if (staleIds.length) {
      const prune = database.transaction(SNAPSHOT_STORE, "readwrite");
      staleIds.forEach((id) => prune.objectStore(SNAPSHOT_STORE).delete(id));
      await waitForTransaction(prune);
    }
  } finally {
    database.close();
  }
}

export async function listRecoverySnapshots(database?: IDBDatabase): Promise<RecoverySnapshot[]> {
  const owner = database ?? await openDatabase();
  try {
    const transaction = owner.transaction(SNAPSHOT_STORE, "readonly");
    const request = transaction.objectStore(SNAPSHOT_STORE).getAll();
    const snapshots = await new Promise<RecoverySnapshot[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as RecoverySnapshot[]);
      request.onerror = () => reject(request.error ?? new Error("Recovery snapshots could not be read."));
    });
    return snapshots.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } finally {
    if (!database) owner.close();
  }
}

export async function deleteRecoverySnapshot(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(SNAPSHOT_STORE, "readwrite");
    transaction.objectStore(SNAPSHOT_STORE).delete(id);
    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

export async function saveLocalProject(project: FloorplanProjectV1, thumbnailSvg: string): Promise<void> {
  const database = await openDatabase();
  try {
    const record: LocalProjectRecord = {
      id: project.id,
      projectName: project.name,
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
      projectJson: serializeProject(project),
      thumbnailSvg,
    };
    const transaction = database.transaction(PROJECT_STORE, "readwrite");
    transaction.objectStore(PROJECT_STORE).put(record);
    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

export async function listLocalProjects(): Promise<LocalProjectRecord[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PROJECT_STORE, "readonly");
    const request = transaction.objectStore(PROJECT_STORE).getAll();
    return await new Promise<LocalProjectRecord[]>((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as LocalProjectRecord[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      request.onerror = () => reject(request.error ?? new Error("Local projects could not be read."));
    });
  } finally {
    database.close();
  }
}

export async function openLocalProject(record: LocalProjectRecord): Promise<FloorplanProjectV1> {
  return deserializeProject(record.projectJson);
}

export async function deleteLocalProject(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PROJECT_STORE, "readwrite");
    transaction.objectStore(PROJECT_STORE).delete(id);
    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

export async function newestValidRecovery(): Promise<{ snapshot: RecoverySnapshot; project: FloorplanProjectV1 } | null> {
  const snapshots = await listRecoverySnapshots();
  for (const snapshot of snapshots) {
    try {
      if (snapshot.schemaVersion !== 1) continue;
      if (await sha256(snapshot.projectJson) !== snapshot.checksum) continue;
      return { snapshot, project: deserializeProject(snapshot.projectJson) };
    } catch {
      continue;
    }
  }
  return null;
}
