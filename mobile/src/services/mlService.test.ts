import { describe, expect, it } from "vitest";

import { runLocalInference } from "./mlService";

describe("runLocalInference", () => {
  it("flags high-intensity gesture features as emergency", async () => {
    const result = await runLocalInference({
      coordinates: [
        [0, 0],
        [10, 10],
      ],
      duration_ms: 900,
      average_speed: 0.6,
      max_speed: 1.5,
      total_distance: 320,
      direction_changes: 4,
    });

    expect(result.emergency).toBe(true);
    expect(result.label).toBe("distress_swipe");
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it("keeps ordinary interactions marked as safe", async () => {
    const result = await runLocalInference({
      coordinates: [
        [0, 0],
        [2, 2],
      ],
      duration_ms: 2500,
      average_speed: 0.08,
      max_speed: 0.2,
      total_distance: 80,
      direction_changes: 0,
    });

    expect(result.emergency).toBe(false);
    expect(result.label).toBe("normal_interaction");
  });
});
