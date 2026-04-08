import * as Location from "expo-location";
import { Linking, Platform } from "react-native";

import { api } from "../api/client";
import { getErrorMessage } from "../utils/errorMessage";
import { GestureFeatures } from "../utils/gesture";

const prototypeLocation = {
  latitude: 28.6139,
  longitude: 77.209,
  accuracy: 25,
};
const ENABLE_SMS_DRAFT_OPEN = true;

async function getCurrentLocationFast(): Promise<typeof prototypeLocation> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      return prototypeLocation;
    }

    const lastKnown = await Location.getLastKnownPositionAsync();
    const locationPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
      mayShowUserSettingsDialog: true,
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error("Location timeout")), 8000);
      // ensure timer is cleared if getCurrentPosition resolves
      locationPromise.finally(() => clearTimeout(timer));
    });

    const currentPosition = await Promise.race([locationPromise, timeoutPromise]).catch(() => null);
    const best = currentPosition || lastKnown;
    if (best) {
      return {
        latitude: best.coords.latitude,
        longitude: best.coords.longitude,
        accuracy: best.coords.accuracy ?? 25,
      };
    }

    return prototypeLocation;
  } catch {
    return prototypeLocation;
  }
}

function buildMapLink(latitude: number, longitude: number) {
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}

function buildEmergencyMessage(
  gestureLabel: string,
  confidence: number,
  mapLink: string,
  triggeredAt: string,
  liveRoomLink?: string
) {
  const lines = [
    "SafeHer emergency alert.",
    `Gesture: ${gestureLabel}`,
    `Confidence: ${confidence.toFixed(2)}`,
    `Time: ${new Date(triggeredAt).toLocaleString()}`,
    `Live location: ${mapLink}`,
  ];
  if (liveRoomLink) {
    lines.push(`Live updates room: ${liveRoomLink}`);
  }
  return lines.join(" ");
}

async function openSmsDraft(recipients: string[], body: string) {
  const cleaned = recipients
    .map((number) => number.replace(/[^\d+]/g, "").trim())
    .filter(Boolean);

  if (!cleaned.length) {
    return { opened: false, reason: "No emergency contacts configured." };
  }

  const candidateUrls: string[] = [];
  const encodedBody = encodeURIComponent(body);
  if (Platform.OS === "android") {
    candidateUrls.push(`smsto:${cleaned.join(";")}?body=${encodedBody}`);
    candidateUrls.push(`smsto:${cleaned[0]}?body=${encodedBody}`);
    candidateUrls.push(`sms:${cleaned.join(";")}?body=${encodedBody}`);
    candidateUrls.push(`sms:${cleaned.join(",")}?body=${encodedBody}`);
  } else {
    candidateUrls.push(`sms:${cleaned.join(",")}&body=${encodedBody}`);
    candidateUrls.push(`sms:${cleaned.join(",")}?body=${encodedBody}`);
  }
  candidateUrls.push(`sms:${cleaned[0]}?body=${encodedBody}`);
  candidateUrls.push(`sms:?body=${encodedBody}`);

  for (const url of candidateUrls) {
    try {
      await Linking.openURL(url);
      return { opened: true };
    } catch {
      // try next URL format
    }
  }

  return { opened: false, reason: "Could not open SMS composer on this device." };
}

export async function createEmergencyAlert(gestureLabel: string, confidence: number, features: GestureFeatures) {
  const location = await getCurrentLocationFast();
  const triggeredAt = new Date().toISOString();
  const mapLink = buildMapLink(location.latitude, location.longitude);
  return createEmergencyAlertWithOptions(gestureLabel, confidence, features, {
    location,
    triggeredAt,
    mapLink,
  });
}

type CreateAlertOptions = {
  skipSmsDraft?: boolean;
  metadata?: Record<string, unknown>;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  triggeredAt?: string;
  mapLink?: string;
};

async function createEmergencyAlertWithOptions(
  gestureLabel: string,
  confidence: number,
  features: GestureFeatures,
  options: CreateAlertOptions = {}
) {
  const location = options.location || (await getCurrentLocationFast());
  const triggeredAt = options.triggeredAt || new Date().toISOString();
  const mapLink = options.mapLink || buildMapLink(location.latitude, location.longitude);

  const payload = {
    gesture_label: gestureLabel,
    confidence,
    location,
    features,
    metadata: options.metadata || {},
    triggered_at: triggeredAt,
  };

  let data: any;
  let serverError = "";

  try {
    const response = await api.post("/alerts", payload);
    data = response.data;
  } catch (error: any) {
    serverError = getErrorMessage(error, "Server unavailable.");
    data = {
      id: `local-${Date.now()}`,
      gesture_label: gestureLabel,
      confidence,
      location,
      triggered_at: triggeredAt,
      map_link: mapLink,
      status: "triggered_local_only",
      server_sync: false,
      server_error: serverError,
    };
  }

  let recipients: string[] = [];
  try {
    const contactsResponse = await api.get("/contacts");
    const contacts = contactsResponse.data || [];
    recipients = Array.from(
      new Set(
        contacts
          .map((contact: any) => String(contact?.phone_number || "").trim())
          .filter(Boolean)
      )
    );
  } catch {
    recipients = [];
  }

  const smsBody = buildEmergencyMessage(
    gestureLabel,
    confidence,
    data.map_link || mapLink,
    data.triggered_at || triggeredAt,
    data?.trusted_circle_room?.public_link
  );
  const smsLaunch = options.skipSmsDraft || !ENABLE_SMS_DRAFT_OPEN
    ? { opened: false, reason: "SMS composer disabled. Backend handles SMS delivery." }
    : await openSmsDraft(recipients, smsBody);

  return {
    ...data,
    sms_launch: smsLaunch,
  };
}

export async function createEmergencyAlertWithConfig(
  gestureLabel: string,
  confidence: number,
  features: GestureFeatures,
  options: CreateAlertOptions = {}
) {
  return createEmergencyAlertWithOptions(gestureLabel, confidence, features, options);
}
