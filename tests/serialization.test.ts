import { describe, expect, it } from "vitest";
import { createSampleProject } from "../src/domain/sample";
import { deserializeProject, sanitizeFilename, serializeProject, sha256 } from "../src/domain/serialization";
import { ProjectValidationError, validateProject } from "../src/domain/validation";

describe("project validation and serialization", () => {
  it("performs a lossless validated round trip", () => {
    const project = createSampleProject();
    expect(deserializeProject(serializeProject(project))).toEqual(project);
  });

  it("rejects unsupported schemas, broken references, collisions, and malformed JSON", () => {
    expect(() => validateProject({ schemaVersion: 2 })).toThrow(ProjectValidationError);
    const broken = createSampleProject();
    broken.walls[0].startVertexId = "missing";
    expect(() => validateProject(broken)).toThrow(/missing vertex/);
    const collision = createSampleProject();
    collision.furniture[1].x = collision.furniture[0].x;
    collision.furniture[1].y = collision.furniture[0].y;
    expect(() => validateProject(collision)).toThrow(/solid collision/);
    expect(() => deserializeProject("{bad")).toThrow(/not valid JSON/);
  });

  it("creates deterministic checksums and sanitized filenames", async () => {
    expect(await sha256("floorplan")).toBe(await sha256("floorplan"));
    expect(await sha256("floorplan")).not.toBe(await sha256("Floorplan"));
    expect(sanitizeFilename(' Casey\'s <Plan>: 01 ')).toBe("caseys-plan-01");
    expect(sanitizeFilename("***")).toBe("floorplan");
  });
});
