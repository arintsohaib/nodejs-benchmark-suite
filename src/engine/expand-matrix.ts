import { BenchError } from "../errors/bench-error.js";
import type { MatrixSpec, MatrixValue } from "../profiles/types.js";
import type { MatrixCell } from "./types.js";

function encodeAxisValue(value: MatrixValue): string {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, "-");
}

/** Stable cell id from axis map, e.g. `packagemanager-npm__runner-native`. */
export function encodeCellId(axes: Readonly<Record<string, MatrixValue>>): string {
  const keys = Object.keys(axes).sort();
  if (keys.length === 0) {
    return "default";
  }
  return keys
    .map((key) => {
      const value = axes[key];
      if (value === undefined) {
        throw new BenchError("INTERNAL", `Missing matrix axis value for key: ${key}`, { key });
      }
      return `${key.toLowerCase()}-${encodeAxisValue(value)}`;
    })
    .join("__");
}

/**
 * Expand a profile matrix into the full cartesian product of cells.
 */
export function expandMatrixCells(matrix: MatrixSpec | undefined): readonly MatrixCell[] {
  if (matrix === undefined) {
    return [{ cellId: "default", axes: {} }];
  }

  const axisNames = Object.keys(matrix).sort();
  if (axisNames.length === 0) {
    return [{ cellId: "default", axes: {} }];
  }

  for (const name of axisNames) {
    const values = matrix[name];
    if (values === undefined || values.length === 0) {
      throw new BenchError(
        "INVALID_PROFILE",
        `Matrix axis "${name}" must contain at least one value`,
        { axis: name },
      );
    }
  }

  let partial: Array<Record<string, MatrixValue>> = [{}];
  for (const name of axisNames) {
    const values = matrix[name];
    if (values === undefined) {
      throw new BenchError("INTERNAL", `Matrix axis disappeared during expansion: ${name}`, {
        axis: name,
      });
    }
    const next: Array<Record<string, MatrixValue>> = [];
    for (const current of partial) {
      for (const value of values) {
        next.push({ ...current, [name]: value });
      }
    }
    partial = next;
  }

  if (partial.length === 0) {
    throw new BenchError("INTERNAL", "Matrix expansion produced no cells");
  }

  return partial.map((axes) => ({
    cellId: encodeCellId(axes),
    axes,
  }));
}
