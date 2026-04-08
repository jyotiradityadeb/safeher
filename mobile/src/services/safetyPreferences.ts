import * as SecureStore from "expo-secure-store";

export type SafetyPreferences = {
  cancelWindowSeconds: 3 | 5 | 8;
  vibrationEnabled: boolean;
  autoEscalationSeconds: 60 | 120 | 180;
  batteryFallbackEnabled: boolean;
  batteryFallbackThreshold: 5 | 10 | 15;
};

const KEY = "safeher_safety_preferences";

const defaults: SafetyPreferences = {
  cancelWindowSeconds: 5,
  vibrationEnabled: true,
  autoEscalationSeconds: 120,
  batteryFallbackEnabled: true,
  batteryFallbackThreshold: 10,
};

export async function getSafetyPreferences(): Promise<SafetyPreferences> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<SafetyPreferences>;
    const cancelWindowSeconds =
      parsed.cancelWindowSeconds === 3 || parsed.cancelWindowSeconds === 8
        ? parsed.cancelWindowSeconds
        : 5;
    const autoEscalationSeconds =
      parsed.autoEscalationSeconds === 60 || parsed.autoEscalationSeconds === 180
        ? parsed.autoEscalationSeconds
        : 120;
    const batteryFallbackThreshold =
      parsed.batteryFallbackThreshold === 5 || parsed.batteryFallbackThreshold === 15
        ? parsed.batteryFallbackThreshold
        : 10;

    return {
      cancelWindowSeconds,
      vibrationEnabled: parsed.vibrationEnabled !== false,
      autoEscalationSeconds,
      batteryFallbackEnabled: parsed.batteryFallbackEnabled !== false,
      batteryFallbackThreshold,
    };
  } catch {
    return defaults;
  }
}

export async function saveSafetyPreferences(
  next: Partial<SafetyPreferences>
): Promise<SafetyPreferences> {
  const current = await getSafetyPreferences();
  const merged: SafetyPreferences = {
    ...current,
    ...next,
  };
  await SecureStore.setItemAsync(KEY, JSON.stringify(merged));
  return merged;
}
