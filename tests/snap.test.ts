import { describe, expect, it } from "vitest";
import { createSampleProject } from "../src/domain/sample";
import { collectSnapCandidates, snapPoint } from "../src/domain/snap";

const base = { enabled: true, altKey: false, shiftKey: false, thresholdScreenPx: 12, screenPixelsPerMil: 0.01 };

describe("snapping", () => {
  it("prioritizes endpoints ahead of lower-priority grid targets", () => {
    const project = createSampleProject();
    const result = snapPoint(project, { x: 100, y: 100 }, base);
    expect(result.candidate?.kind).toBe("endpoint");
    expect(result.point).toEqual({ x: 0, y: 0 });
  });

  it("disables all automatic snaps through the master toggle or Alt", () => {
    const project = createSampleProject();
    expect(collectSnapCandidates(project, { x: 100, y: 100 }, { ...base, enabled: false })).toEqual([]);
    expect(collectSnapCandidates(project, { x: 100, y: 100 }, { ...base, altKey: true })).toEqual([]);
  });

  it("keeps the intentional Shift 45-degree constraint when snapping is disabled", () => {
    const project = createSampleProject();
    const result = snapPoint(project, { x: 10_000, y: 7_000 }, { ...base, enabled: false, shiftKey: true, origin: { x: 0, y: 0 } });
    expect(result.candidate?.kind).toBe("angle");
    expect(result.point.x).toBeCloseTo(result.point.y);
  });

  it("Alt+Shift suppresses all targets except the intentional angle", () => {
    const project = createSampleProject();
    const candidates = collectSnapCandidates(project, { x: 10_000, y: 7_000 }, { ...base, altKey: true, shiftKey: true, origin: { x: 0, y: 0 } });
    expect(candidates.map((candidate) => candidate.kind)).toEqual(["angle"]);
  });
});
