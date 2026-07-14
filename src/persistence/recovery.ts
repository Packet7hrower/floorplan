import type { FloorplanProjectV1 } from "../domain/types";
import { deserializeProject, serializeProject, sha256 } from "../domain/serialization";

const DATABASE = "floorplan-recovery";
const STORE = "snapshots";
const VERSION = 1;
const MAX_SNAPSHOTS = 3;

export interface RecoverySnapshot {
  id: string;
  timestamp: string;
  schemaVersion: 1;
  checksum: string;
  projectJson: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: "id" });
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

export async function makeSnapshot(project: FloorplanProjectV1): Promise<RecoverySnapshot> {
  const projectJson = serializeProject(project);
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    schemaVersion: 1,
    checksum: await sha256(projectJson),
    projectJson,
  };
}

export function chooseSnapshotIdsToPrune(snapshots: RecoverySnapshot[], limit = MAX_SNAPSHOTS): string[] {
  return [...snapshots]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(limit)
    .map((snapshot) => snapshot.id);
}

export async function writeRecoverySnapshot(project: FloorplanProjectV1): Promise<void> {
  const database = await openDatabase();
  try {
    const snapshot = await makeSnapshot(project);
    const write = database.transaction(STORE, "readwrite");
    write.objectStore(STORE).put(snapshot);
    await waitForTransaction(write);
    const snapshots = await listRecoverySnapshots(database);
    const staleIds = chooseSnapshotIdsToPrune(snapshots);
    if (staleIds.length) {
      const prune = database.transaction(STORE, "readwrite");
      staleIds.forEach((id) => prune.objectStore(STORE).delete(id));
      await waitForTransaction(prune);
    }
  } finally {
    database.close();
  }
}

async function listRecoverySnapshots(database?: IDBDatabase): Promise<RecoverySnapshot[]> {
  const owner = database ?? await openDatabase();
  try {
    const transaction = owner.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).getAll();
    const snapshots = await new Promise<RecoverySnapshot[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as RecoverySnapshot[]);
      request.onerror = () => reject(request.error ?? new Error("Recovery snapshots could not be read."));
    });
    return snapshots.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } finally {
    if (!database) owner.close();
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
