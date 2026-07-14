import { describe, expect, it } from "vitest";
import { MeasurementError, formatMeasurement, parseMeasurement } from "../src/domain/measurements";

describe("measurement parsing", () => {
  it.each([
    ["150in", "in", 150_000],
    ["12.5ft", "in", 150_000],
    ["12'6\"", "in", 150_000],
    ["12ft 6in", "in", 150_000],
    ["12' 6 1/2\"", "in", 150_500],
    ["12’ 6 1/2”", "in", 150_500],
    ["6 1/4", "in", 6_250],
    ["1/16in", "ft", 63],
    ["10.33ft", "in", 123_960],
    ["12.5", "ft", 150_000],
    ["12.5", "in", 12_500],
  ] as const)("parses %s", (input, unit, expected) => {
    expect(parseMeasurement(input, unit)).toBe(expected);
  });

  it.each(["", "-2in", "one foot", "4/0in", "1/65in", "12' 14\"", "NaNin", "Infinityft"])("rejects %s", (input) => {
    expect(() => parseMeasurement(input)).toThrow(MeasurementError);
  });
});

describe("measurement formatting", () => {
  it("formats decimal inches with three trimmed places", () => {
    expect(formatMeasurement(12_500, "in")).toBe("12.5 in");
    expect(formatMeasurement(12_001, "in")).toBe("12.001 in");
    expect(formatMeasurement(12_000, "in")).toBe("12 in");
  });

  it("formats feet and inches to the nearest sixteenth without decimal feet", () => {
    expect(formatMeasurement(150_500, "ft")).toBe("12' 6 1/2\"");
    expect(formatMeasurement(144_000, "ft")).toBe("12' 0\"");
    expect(formatMeasurement(1_032, "ft")).toBe("0' 1 1/16\"");
  });
});
