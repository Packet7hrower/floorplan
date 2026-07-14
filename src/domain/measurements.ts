import { MAX_LENGTH_MILS } from "./defaults";
import type { LengthMils, Unit } from "./types";

export class MeasurementError extends Error {}

function parsePositiveNumber(value: string): number {
  const normalized = value.trim();
  if (!normalized) throw new MeasurementError("Enter a measurement.");
  if (/^-/.test(normalized)) throw new MeasurementError("Measurements cannot be negative.");
  const mixed = normalized.match(/^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const denominator = Number(mixed[3]);
    if (denominator === 0 || denominator > 64) throw new MeasurementError("Fractions require a denominator from 1 to 64.");
    return Number(mixed[1]) + Number(mixed[2]) / denominator;
  }
  const fraction = normalized.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator === 0 || denominator > 64) throw new MeasurementError("Fractions require a denominator from 1 to 64.");
    return Number(fraction[1]) / denominator;
  }
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new MeasurementError("Use inches, feet, or feet-and-inches notation.");
  return Number(normalized);
}

function checkedMils(inches: number): LengthMils {
  const mils = Math.round(inches * 1_000);
  if (!Number.isFinite(mils)) throw new MeasurementError("Measurement must be finite.");
  if (mils <= 0) throw new MeasurementError("Measurement must be greater than zero.");
  if (mils > MAX_LENGTH_MILS) throw new MeasurementError("Measurement is outside the supported range.");
  return mils;
}

export function parseMeasurement(input: string, defaultUnit: Unit = "in"): LengthMils {
  const normalized = input
    .trim()
    .replace(/[’′]/g, "'")
    .replace(/[“”″]/g, '"')
    .toLowerCase();
  if (!normalized) throw new MeasurementError("Enter a measurement.");

  const feetAndInches = normalized.match(/^(.+?)\s*(?:'|ft)\s*(.*?)\s*(?:"|in)?$/);
  if (feetAndInches) {
    const feet = parsePositiveNumber(feetAndInches[1]);
    const inchPart = feetAndInches[2].trim();
    const inches = inchPart ? parsePositiveNumber(inchPart) : 0;
    if (inches >= 12) throw new MeasurementError("The inch portion must be less than 12.");
    return checkedMils(feet * 12 + inches);
  }

  const explicitInches = normalized.match(/^(.+?)\s*(?:"|in)$/);
  if (explicitInches) return checkedMils(parsePositiveNumber(explicitInches[1]));
  const explicitFeet = normalized.match(/^(.+?)\s*ft$/);
  if (explicitFeet) return checkedMils(parsePositiveNumber(explicitFeet[1]) * 12);
  return checkedMils(parsePositiveNumber(normalized) * (defaultUnit === "ft" ? 12 : 1));
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function formatMeasurement(mils: LengthMils, unit: Unit): string {
  if (unit === "in") {
    const inches = (mils / 1_000).toFixed(3).replace(/\.0+$|(?<=\.\d*)0+$/g, "");
    return `${inches} in`;
  }
  const totalSixteenths = Math.round((mils / 1_000) * 16);
  const feet = Math.floor(totalSixteenths / 192);
  const inchSixteenths = totalSixteenths - feet * 192;
  const inches = Math.floor(inchSixteenths / 16);
  const numerator = inchSixteenths % 16;
  const divisor = numerator ? gcd(numerator, 16) : 1;
  const fraction = numerator ? ` ${numerator / divisor}/${16 / divisor}` : "";
  return `${feet}' ${inches}${fraction}"`;
}

export function formatArea(squareMils: number, unit: Unit): string {
  const squareInches = squareMils / 1_000_000;
  return unit === "ft" ? `${(squareInches / 144).toFixed(1)} sq ft` : `${Math.round(squareInches).toLocaleString()} sq in`;
}
