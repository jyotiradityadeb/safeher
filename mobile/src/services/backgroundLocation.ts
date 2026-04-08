import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";

import { api } from "../api/client";
import {
  processPendingCheckInEscalation,
  refreshPendingCheckInFromServer,
} from "./smartCheckInMonitor";

export const BACKGROUND_LOCATION_TASK = "safeher-background-location";

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) {
    return;
  }

  const { locations } = data as { locations: Location.LocationObject[] };
  const latest = locations[locations.length - 1];
  if (!latest) {
    return;
  }

  try {
    const token = await SecureStore.getItemAsync("safeher_token");
    await api.post("/locations", {
      latitude: latest.coords.latitude,
      longitude: latest.coords.longitude,
      accuracy: latest.coords.accuracy,
      speed: latest.coords.speed,
      recorded_at: new Date().toISOString(),
    }, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    await refreshPendingCheckInFromServer();
    await processPendingCheckInEscalation({
      location: {
        latitude: latest.coords.latitude,
        longitude: latest.coords.longitude,
        accuracy: latest.coords.accuracy ?? 30,
      },
    });
  } catch {
    // Keep background task resilient when the network is unavailable.
  }
});

export async function startBackgroundLocationTracking() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  const background = await Location.requestBackgroundPermissionsAsync();

  if (!foreground.granted || !background.granted) {
    throw new Error("Foreground and background location permissions are required.");
  }

  const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (started) {
    return;
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 30000,
    distanceInterval: 30,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: "SafeHer tracking enabled",
      notificationBody: "Live safety location updates are active.",
    },
  });
}

export async function stopBackgroundLocationTracking() {
  const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (started) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
