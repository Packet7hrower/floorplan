import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateUuid } from "../src/utils/uuid";

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("generateUuid", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the native randomUUID implementation when available", () => {
    const nativeUuid = "123e4567-e89b-42d3-a456-426614174000";
    const randomUUID = vi.fn(() => nativeUuid);
    const getRandomValues = vi.fn();
    vi.stubGlobal("crypto", { randomUUID, getRandomValues });

    expect(generateUuid()).toBe(nativeUuid);
    expect(randomUUID).toHaveBeenCalledOnce();
    expect(getRandomValues).not.toHaveBeenCalled();
  });

  it("uses getRandomValues when randomUUID is unavailable", () => {
    const randomBytes = Uint8Array.from({ length: 16 }, (_, index) => index);
    const getRandomValues = vi.fn((target: Uint8Array) => {
      target.set(randomBytes);
      return target;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    expect(generateUuid()).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  it("formats fallback output as an RFC 4122 version 4 UUID", () => {
    const getRandomValues = vi.fn((target: Uint8Array) => {
      target.fill(0xff);
      return target;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    const uuid = generateUuid();
    expect(uuid).toMatch(UUID_V4_PATTERN);
    expect(uuid[14]).toBe("4");
    expect(uuid[19]).toBe("b");
  });

  it("sets version and RFC 4122 variant bits without changing other random bytes", () => {
    const getRandomValues = vi.fn((target: Uint8Array) => {
      target.fill(0);
      return target;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    expect(generateUuid()).toBe("00000000-0000-4000-8000-000000000000");
  });

  it("throws a clear error when Web Crypto is unavailable", () => {
    vi.stubGlobal("crypto", undefined);

    expect(() => generateUuid()).toThrow(
      "Web Crypto API is unavailable; UUID generation requires randomUUID or getRandomValues support.",
    );
  });

  it("leaves no direct crypto.randomUUID calls in application source", () => {
    const directCalls = sourceFiles(join(process.cwd(), "src")).filter((path) =>
      /\bcrypto\.randomUUID\s*\(/.test(readFileSync(path, "utf8")),
    );

    expect(directCalls).toEqual([]);
  });
});
