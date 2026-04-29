import * as SecureStore from "expo-secure-store";

const LAST_LOCATION_KEY = "safeher_last_location";

export type BestEffortLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  source: "current" | "last_known" | "cached" | "unavailable";
};

async function readCachedLocation(): Promise<BestEffortLocation | null> {
  try {
    const raw = await SecureStore.getItemAsync(LAST_LOCATION_KEY);
    return raw ? (JSON.parse(raw) as BestEffortLocation) : null;
  } catch {
    return null;
  }
}

async function writeCachedLocation(location: BestEffortLocation): Promise<void> {
  try {
    await SecureStore.setItemAsync(LAST_LOCATION_KEY, JSON.stringify(location));
  } catch {
    // ignore caching errors
  }
}

export async function getBestEffortLocation(): Promise<BestEffortLocation> {
  try {
    const Location = await import("expo-location");
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      const cached = await readCachedLocation();
      if (cached) {
        return { ...cached, source: "cached" };
      }
      return { latitude: 0, longitude: 0, accuracy: 99999, source: "unavailable" };
    }

    const lastKnown = await Location.getLastKnownPositionAsync();
    const locationPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
      mayShowUserSettingsDialog: true,
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error("Location timeout")), 8000);
      locationPromise.finally(() => clearTimeout(timer));
    });

    const currentPosition = await Promise.race([locationPromise, timeoutPromise]).catch(() => null);
    const best = currentPosition || lastKnown;
    if (best) {
      const result: BestEffortLocation = {
        latitude: best.coords.latitude,
        longitude: best.coords.longitude,
        accuracy: best.coords.accuracy ?? 30,
        source: currentPosition ? "current" : "last_known",
      };
      await writeCachedLocation(result);
      return result;
    }

    const cached = await readCachedLocation();
    if (cached) {
      return { ...cached, source: "cached" };
    }
  } catch {
    const cached = await readCachedLocation();
    if (cached) {
      return { ...cached, source: "cached" };
    }
  }

  return { latitude: 0, longitude: 0, accuracy: 99999, source: "unavailable" };
}
