import { describe, expect, it } from "vitest";

import { extractGestureFeatures } from "./gesture";

describe("extractGestureFeatures", () => {
  it("returns zeroed features for too-few points", () => {
    const result = extractGestureFeatures([{ x: 10, y: 10, t: 1000 }]);

    expect(result.duration_ms).toBe(0);
    expect(result.total_distance).toBe(0);
    expect(result.direction_changes).toBe(0);
    expect(result.coordinates).toEqual([[10, 10]]);
  });

  it("derives movement metrics from a gesture path", () => {
    const result = extractGestureFeatures([
      { x: 0, y: 0, t: 0 },
      { x: 3, y: 4, t: 10 },
      { x: 6, y: 0, t: 20 },
    ]);

    expect(result.duration_ms).toBe(20);
    expect(result.total_distance).toBeGreaterThan(9);
    expect(result.max_speed).toBeGreaterThan(0);
    expect(result.direction_changes).toBeGreaterThanOrEqual(1);
  });
});
