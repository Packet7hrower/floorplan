import { describe, expect, it } from "vitest";
import { createSampleProject } from "../src/domain/sample";
import { createPlanSvg } from "../src/export/planSvg";

describe("authoritative plan SVG", () => {
  it("generates native vector geometry with project labels and a derived viewBox", () => {
    const svg = createPlanSvg(createSampleProject(), { includeDimensions: true });
    expect(svg).toContain("<svg");
    expect(svg).toContain("viewBox=");
    expect(svg).toContain("Sample room");
    expect(svg).toContain("font-family: Inter");
    expect(svg).toContain("12&apos; 0&quot;");
    expect(svg).toContain("Desk");
    expect(svg).not.toContain("selection");
    expect(svg).not.toContain("snap-guide");
  });

  it("excludes all measurements when dimensions are disabled", () => {
    const svg = createPlanSvg(createSampleProject(), { includeDimensions: false });
    expect(svg).not.toContain('class="dimension"');
    expect(svg).not.toContain('class="opening-label"');
  });
});
