import { Linking, Platform } from "react-native";

import { api } from "../api/client";
import { getBestEffortLocation } from "./locationFallback";
import { getErrorMessage } from "../utils/errorMessage";
import { GestureFeatures } from "../utils/gesture";

const ENABLE_SMS_DRAFT_OPEN = process.env.EXPO_PUBLIC_OPEN_SMS_DRAFT !== "false";

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
  const locationContext = await getBestEffortLocation();
  const location = {
    latitude: locationContext.latitude,
    longitude: locationContext.longitude,
    accuracy: locationContext.accuracy,
  };
  const triggeredAt = new Date().toISOString();
  const mapLink = buildMapLink(location.latitude, location.longitude);
  return createEmergencyAlertWithOptions(gestureLabel, confidence, features, {
    location,
    triggeredAt,
    mapLink,
    metadata: {
      location_source: locationContext.source,
      location_available: locationContext.source !== "unavailable",
    },
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
  const locationContext = await getBestEffortLocation();
  const location = options.location || {
    latitude: locationContext.latitude,
    longitude: locationContext.longitude,
    accuracy: locationContext.accuracy,
  };
  const triggeredAt = options.triggeredAt || new Date().toISOString();
  const mapLink = options.mapLink || buildMapLink(location.latitude, location.longitude);

  const payload = {
    gesture_label: gestureLabel,
    confidence,
    location,
    features,
    metadata: {
      location_source: locationContext.source,
      location_available: locationContext.source !== "unavailable",
      ...(options.metadata || {}),
    },
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
  let shouldOpenDraft = ENABLE_SMS_DRAFT_OPEN && !options.skipSmsDraft;
  try {
    const status = await api.get("/system/status");
    const backendConfigured = Boolean(status.data?.sms_backend_configured);
    const deliveryResults = (data?.delivery_results || []) as Array<{ status?: string }>;
    const backendDelivered = deliveryResults.some((item) => item.status === "sent");
    if (backendConfigured && backendDelivered) {
      shouldOpenDraft = false;
    }
  } catch {
    // if status check fails, keep best-effort fallback enabled
  }

  const smsLaunch = !shouldOpenDraft
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
