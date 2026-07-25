import { afterEach, describe, expect, it, vi } from "vitest";
import { createSampleProject } from "../src/domain/sample";
import { sha256 } from "../src/domain/serialization";
import { chooseSnapshotIdsToPrune, listRecoverySnapshots, makeSnapshot, writeRecoverySnapshot, type RecoverySnapshot } from "../src/persistence/recovery";

describe("recovery snapshots", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.removeItem("floorplan-recovery-fallback-snapshots");
  });

  it("attaches version, timestamp, and checksum metadata", async () => {
    const snapshot = await makeSnapshot(createSampleProject(), "Before furniture", "named");
    expect(snapshot.schemaVersion).toBe(1);
    expect(Number.isNaN(Date.parse(snapshot.timestamp))).toBe(false);
    expect(snapshot.checksum).toBe(await sha256(snapshot.projectJson));
    expect(snapshot.label).toBe("Before furniture");
    expect(snapshot.kind).toBe("named");
  });

  it("keeps the newest three snapshots and prunes older snapshots only after ordering", () => {
    const snapshots = Array.from({ length: 5 }, (_, index) => ({
      id: String(index),
      timestamp: new Date(2026, 0, index + 1).toISOString(),
      schemaVersion: 1,
      checksum: "",
      projectJson: "",
    })) satisfies RecoverySnapshot[];
    expect(chooseSnapshotIdsToPrune(snapshots)).toEqual(["1", "0"]);
  });

  it("falls back to localStorage when IndexedDB is blocked", async () => {
    vi.stubGlobal("indexedDB", undefined);
    await writeRecoverySnapshot(createSampleProject());
    const snapshots = await listRecoverySnapshots();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].projectJson).toContain('"schemaVersion": 1');
  });
});
