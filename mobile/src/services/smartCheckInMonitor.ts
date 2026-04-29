import * as SecureStore from "expo-secure-store";

import { api } from "../api/client";
import { getBestEffortLocation } from "./locationFallback";

type SmartCheckIn = {
  id: string;
  reason: string;
  status: "pending" | "safe" | "need_help" | "missed";
  due_at: string;
};

const PENDING_CHECK_IN_KEY = "safeher_pending_checkin";

const fallbackFeatures = {
  coordinates: [
    [0, 0],
    [10, 15],
    [4, 28],
    [26, 52],
  ],
  duration_ms: 780,
  average_speed: 0.59,
  max_speed: 1.36,
  total_distance: 289,
  direction_changes: 5,
};

async function getStoredPendingCheckIn(): Promise<SmartCheckIn | null> {
  try {
    const raw = await SecureStore.getItemAsync(PENDING_CHECK_IN_KEY);
    return raw ? (JSON.parse(raw) as SmartCheckIn) : null;
  } catch {
    return null;
  }
}

async function setStoredPendingCheckIn(checkIn: SmartCheckIn | null): Promise<void> {
  if (!checkIn) {
    await SecureStore.deleteItemAsync(PENDING_CHECK_IN_KEY);
    return;
  }
  await SecureStore.setItemAsync(PENDING_CHECK_IN_KEY, JSON.stringify(checkIn));
}

async function authHeaders(): Promise<Record<string, string> | undefined> {
  const token = await SecureStore.getItemAsync("safeher_token");
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export async function refreshPendingCheckInFromServer(): Promise<SmartCheckIn | null> {
  try {
    const headers = await authHeaders();
    const { data } = await api.get("/safety/check-ins/latest", { headers });
    const checkIn = (data || null) as SmartCheckIn | null;
    if (checkIn && checkIn.status === "pending") {
      await setStoredPendingCheckIn(checkIn);
      return checkIn;
    }
    await setStoredPendingCheckIn(null);
    return checkIn;
  } catch {
    return getStoredPendingCheckIn();
  }
}

export async function processPendingCheckInEscalation(options?: {
  location?: { latitude: number; longitude: number; accuracy?: number };
}): Promise<"none" | "escalated"> {
  const checkIn = await getStoredPendingCheckIn();
  if (!checkIn || checkIn.status !== "pending") {
    return "none";
  }

  if (new Date(checkIn.due_at).getTime() > Date.now()) {
    return "none";
  }

  try {
    const headers = await authHeaders();
    const computed = await getBestEffortLocation();
    const loc = options?.location || {
      latitude: computed.latitude,
      longitude: computed.longitude,
      accuracy: computed.accuracy,
    };
    await api.post(
      "/alerts",
      {
        gesture_label: "smart_checkin_missed",
        confidence: 0.93,
        location: {
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy ?? 30,
        },
        features: fallbackFeatures,
        metadata: {
          source: "background_smart_checkin_monitor",
          check_in_id: checkIn.id,
          location_source: computed.source,
        },
        triggered_at: new Date().toISOString(),
      },
      { headers }
    );
    await api.post(
      `/safety/check-ins/${checkIn.id}/ack`,
      {
        status: "need_help",
        note: "Auto-escalated from background smart check-in monitor.",
      },
      { headers }
    );
    await setStoredPendingCheckIn(null);
    return "escalated";
  } catch {
    return "none";
  }
}
