import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    store.delete(key);
  }),
}));

import { getSafetyPreferences, saveSafetyPreferences } from "./safetyPreferences";

describe("safetyPreferences", () => {
  beforeEach(() => {
    store.clear();
  });

  it("returns defaults when nothing is stored", async () => {
    const prefs = await getSafetyPreferences();
    expect(prefs.cancelWindowSeconds).toBe(5);
    expect(prefs.vibrationEnabled).toBe(true);
    expect(prefs.autoEscalationSeconds).toBe(120);
    expect(prefs.batteryFallbackEnabled).toBe(true);
    expect(prefs.batteryFallbackThreshold).toBe(10);
  });

  it("saves and returns updated values", async () => {
    const saved = await saveSafetyPreferences({
      cancelWindowSeconds: 8,
      vibrationEnabled: false,
      autoEscalationSeconds: 180,
      batteryFallbackEnabled: false,
      batteryFallbackThreshold: 15,
    });
    expect(saved.cancelWindowSeconds).toBe(8);
    expect(saved.vibrationEnabled).toBe(false);
    expect(saved.autoEscalationSeconds).toBe(180);
    expect(saved.batteryFallbackEnabled).toBe(false);
    expect(saved.batteryFallbackThreshold).toBe(15);

    const loaded = await getSafetyPreferences();
    expect(loaded).toEqual(saved);
  });
});
