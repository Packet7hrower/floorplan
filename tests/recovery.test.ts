import { describe, expect, it } from "vitest";
import { createSampleProject } from "../src/domain/sample";
import { sha256 } from "../src/domain/serialization";
import { chooseSnapshotIdsToPrune, makeSnapshot, type RecoverySnapshot } from "../src/persistence/recovery";

describe("recovery snapshots", () => {
  it("attaches version, timestamp, and checksum metadata", async () => {
    const snapshot = await makeSnapshot(createSampleProject());
    expect(snapshot.schemaVersion).toBe(1);
    expect(Number.isNaN(Date.parse(snapshot.timestamp))).toBe(false);
    expect(snapshot.checksum).toBe(await sha256(snapshot.projectJson));
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
});
