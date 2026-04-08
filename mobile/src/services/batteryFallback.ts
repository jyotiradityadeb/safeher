import * as Battery from "expo-battery";
import * as SecureStore from "expo-secure-store";

import { createEmergencyAlertWithConfig } from "./alertService";
import { getSafetyPreferences } from "./safetyPreferences";

const LAST_SENT_KEY = "safeher_battery_fallback_last_sent_at";
const CHECK_INTERVAL_MS = 60000;
const COOLDOWN_MS = 30 * 60 * 1000;

const fallbackFeatures = {
  coordinates: [
    [0, 0],
    [8, 10],
    [2, 20],
    [18, 34],
  ],
  duration_ms: 520,
  average_speed: 0.41,
  max_speed: 1.02,
  total_distance: 144,
  direction_changes: 2,
};

async function getLastSentAtMs(): Promise<number> {
  const raw = await SecureStore.getItemAsync(LAST_SENT_KEY);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

async function setLastSentAtMs(atMs: number): Promise<void> {
  await SecureStore.setItemAsync(LAST_SENT_KEY, String(atMs));
}

async function maybeTriggerBatteryFallback() {
  const token = await SecureStore.getItemAsync("safeher_token");
  if (!token) {
    return;
  }

  const prefs = await getSafetyPreferences();
  if (!prefs.batteryFallbackEnabled) {
    return;
  }

  const level = await Battery.getBatteryLevelAsync();
  const state = await Battery.getBatteryStateAsync();
  const isCharging = state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;
  if (isCharging) {
    return;
  }

  const thresholdRatio = prefs.batteryFallbackThreshold / 100;
  if (level > thresholdRatio) {
    return;
  }

  const now = Date.now();
  const lastSentAt = await getLastSentAtMs();
  if (now - lastSentAt < COOLDOWN_MS) {
    return;
  }

  await createEmergencyAlertWithConfig("battery_low_fallback", 0.91, fallbackFeatures, {
    metadata: {
      source: "battery_fallback",
      battery_level_percent: Math.round(level * 100),
      battery_threshold_percent: prefs.batteryFallbackThreshold,
    },
  });
  await setLastSentAtMs(now);
}

export function startBatteryFallbackMonitor(): () => void {
  maybeTriggerBatteryFallback().catch(() => undefined);
  const timer = setInterval(() => {
    maybeTriggerBatteryFallback().catch(() => undefined);
  }, CHECK_INTERVAL_MS);

  const listener = Battery.addBatteryLevelListener(() => {
    maybeTriggerBatteryFallback().catch(() => undefined);
  });

  return () => {
    clearInterval(timer);
    listener.remove();
  };
}
