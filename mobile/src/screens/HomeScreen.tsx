import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";
import * as Battery from "expo-battery";
import * as Location from "expo-location";

import { useAuth } from "../context/AuthContext";
import { useGestureRecorder } from "../hooks/useGestureRecorder";
import { api } from "../api/client";
import {
  createEmergencyAlert,
  createEmergencyAlertWithConfig,
} from "../services/alertService";
import {
  acknowledgeSmartCheckIn,
  addLiveRoomNote,
  getLatestLiveRoom,
  getLatestSmartCheckIn,
  LiveRoom,
  requestSmartCheckIn,
  SmartCheckIn,
} from "../services/safetyService";
import { getSafetyPreferences, SafetyPreferences } from "../services/safetyPreferences";
import { refreshPendingCheckInFromServer } from "../services/smartCheckInMonitor";
import {
  startFakeCallRingtone,
  stopFakeCallRingtone,
} from "../services/fakeCallRingtone";
import { startBackgroundLocationTracking } from "../services/backgroundLocation";
import { captureAndUploadAlertAudio } from "../services/alertAudioService";
import { getErrorMessage } from "../utils/errorMessage";
import { GestureFeatures } from "../utils/gesture";
import { buildPostAlertActionNote } from "../utils/safetyFlow";
import { startShakeSosMonitor } from "../services/shakeSosService";
import { styles } from "./home/styles";

const DEFAULT_PREFS: SafetyPreferences = {
  cancelWindowSeconds: 5,
  vibrationEnabled: true,
  autoEscalationSeconds: 120,
  batteryFallbackEnabled: true,
  batteryFallbackThreshold: 10,
};

const SMART_CHECKIN_FALLBACK_FEATURES: GestureFeatures = {
  coordinates: [
    [0, 0],
    [15, 20],
    [8, 36],
    [32, 58],
  ],
  duration_ms: 810,
  average_speed: 0.62,
  max_speed: 1.45,
  total_distance: 306,
  direction_changes: 5,
};

type PendingAlert = {
  gestureLabel: string;
  confidence: number;
  features: GestureFeatures;
  reason: string;
};

type FakeCallerPreset = {
  name: string;
  subtitle: string;
};

const FAKE_CALL_PRESETS: FakeCallerPreset[] = [
  { name: "Mom", subtitle: "Family" },
  { name: "Priya", subtitle: "Emergency Contact" },
  { name: "Team Lead", subtitle: "Office" },
];

const FAKE_CALL_DELAY_OPTIONS: Array<5 | 10 | 20> = [5, 10, 20];

type HealthLevel = "green" | "yellow" | "red";

type HealthItem = {
  level: HealthLevel;
  label: string;
};

type HealthSnapshot = {
  gps: HealthItem;
  internet: HealthItem;
  smsBackend: HealthItem;
  battery: HealthItem;
};

const DEFAULT_HEALTH: HealthSnapshot = {
  gps: { level: "yellow", label: "Checking..." },
  internet: { level: "yellow", label: "Checking..." },
  smsBackend: { level: "yellow", label: "Checking..." },
  battery: { level: "yellow", label: "Checking..." },
};

export function HomeScreen() {
  const { user, logout } = useAuth();
  const [pendingAlert, setPendingAlert] = useState<PendingAlert | null>(null);
  const [pendingAlertSeconds, setPendingAlertSeconds] = useState<number | null>(null);
  const [safetyPrefs, setSafetyPrefs] = useState<SafetyPreferences>(DEFAULT_PREFS);
  const { panResponder, status, lastResult } = useGestureRecorder({
    onEmergencyDetected: async ({ features, detection }) => {
      armPendingAlert({
        gestureLabel: detection.label,
        confidence: detection.confidence,
        features,
        reason: "gesture_detected_emergency",
      });
    },
  });
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoMessage, setDemoMessage] = useState("");
  const [latestAlertId, setLatestAlertId] = useState("");
  const [latestAlertMap, setLatestAlertMap] = useState("");
  const [trustedRoom, setTrustedRoom] = useState<LiveRoom | null>(null);
  const [smartCheckIn, setSmartCheckIn] = useState<SmartCheckIn | null>(null);
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [showFakeCall, setShowFakeCall] = useState(false);
  const [fakeCallCountdown, setFakeCallCountdown] = useState<number | null>(null);
  const [fakeCallDelaySeconds, setFakeCallDelaySeconds] = useState<5 | 10 | 20>(10);
  const [selectedFakeCallerIndex, setSelectedFakeCallerIndex] = useState(1);
  const [networkHealth, setNetworkHealth] = useState<HealthSnapshot>(DEFAULT_HEALTH);
  const [escapeMode, setEscapeMode] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [safeArrivalDestination, setSafeArrivalDestination] = useState("");
  const [safeArrivalEtaMinutes, setSafeArrivalEtaMinutes] = useState<5 | 10 | 15>(10);
  const checkInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkInCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cardReveal = useRef(new Animated.Value(0)).current;
  const ringPulse = useRef(new Animated.Value(1)).current;
  const ringLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const pendingAlertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAlertCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingVibrationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fakeCallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fakeCallCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHealthBroadcastKeyRef = useRef<string>("");
  const lastHealthBroadcastAtRef = useRef<number>(0);

  const selectedFakeCaller = FAKE_CALL_PRESETS[selectedFakeCallerIndex] || FAKE_CALL_PRESETS[0];
  const getHealthLevelStyle = (level: HealthLevel) => {
    if (level === "green") {
      return styles.healthBadgeGreen;
    }
    if (level === "yellow") {
      return styles.healthBadgeYellow;
    }
    return styles.healthBadgeRed;
  };

  const trustedContactsLabel = useMemo(() => {
    if (!trustedRoom?.participants?.length) {
      return "No trusted contacts synced yet";
    }
    return trustedRoom.participants
      .slice(0, 3)
      .map((participant) => participant.name)
      .join(", ");
  }, [trustedRoom]);

  async function ensureTrustedRoom() {
    if (trustedRoom) {
      return trustedRoom;
    }
    const latest = await getLatestLiveRoom();
    if (latest) {
      setTrustedRoom(latest);
    }
    return latest;
  }

  function clearPendingAlertTimers() {
    if (pendingAlertTimerRef.current) {
      clearTimeout(pendingAlertTimerRef.current);
      pendingAlertTimerRef.current = null;
    }
    if (pendingAlertCountdownRef.current) {
      clearInterval(pendingAlertCountdownRef.current);
      pendingAlertCountdownRef.current = null;
    }
    if (pendingVibrationRef.current) {
      clearInterval(pendingVibrationRef.current);
      pendingVibrationRef.current = null;
    }
    Vibration.cancel();
  }

  async function sendAlertNow(payload: PendingAlert) {
    setDemoLoading(true);
    try {
      const alert = await createEmergencyAlert(payload.gestureLabel, payload.confidence, payload.features);
      if (alert?.sms_launch?.opened) {
        setDemoMessage("Emergency SMS draft opened. Tap Send in your phone's SMS app.");
      } else if (alert?.sms_launch?.reason) {
        setDemoMessage(`Alert created. SMS draft not opened: ${alert.sms_launch.reason}`);
      } else {
        setDemoMessage("Emergency alert shared successfully.");
      }
      setLatestAlertId(alert.id || alert._id || "");
      setLatestAlertMap(alert.map_link || "");
      if (alert.trusted_circle_room) {
        setTrustedRoom(alert.trusted_circle_room);
      }
      await startBackgroundLocationTracking().catch(() => undefined);
      const alertId = alert.id || alert._id;
      if (alertId) {
        captureAndUploadAlertAudio(alertId, 30).catch(() => undefined);
      }
      await armSmartCheckInAfterAlert(payload.reason);
      (globalThis as any).__SAFEHER_LAST_ALERT__ = alert;
    } catch (error: any) {
      setDemoMessage(
        getErrorMessage(
          error,
          "Could not trigger the emergency alert. You can still use live location in Status."
        )
      );
    } finally {
      setDemoLoading(false);
    }
  }

  function cancelPendingAlert() {
    clearPendingAlertTimers();
    setPendingAlert(null);
    setPendingAlertSeconds(null);
    setDemoMessage("Alert canceled before dispatch.");
  }

  function armPendingAlert(nextAlert: PendingAlert) {
    const seconds = safetyPrefs.cancelWindowSeconds;
    clearPendingAlertTimers();
    setPendingAlert(nextAlert);
    setPendingAlertSeconds(seconds);
    setDemoMessage("Emergency detected. Sending soon unless you cancel.");

    pendingAlertTimerRef.current = setTimeout(async () => {
      clearPendingAlertTimers();
      setPendingAlert(null);
      setPendingAlertSeconds(null);
      await sendAlertNow(nextAlert);
    }, seconds * 1000);

    pendingAlertCountdownRef.current = setInterval(() => {
      setPendingAlertSeconds((previous) => {
        if (previous === null) {
          return null;
        }
        return Math.max(previous - 1, 0);
      });
    }, 1000);
  }

  async function sendPendingAlertImmediately() {
    if (!pendingAlert) {
      return;
    }
    const queued = pendingAlert;
    clearPendingAlertTimers();
    setPendingAlert(null);
    setPendingAlertSeconds(null);
    await sendAlertNow(queued);
  }

  const clearCheckInTimer = () => {
    if (checkInTimerRef.current) {
      clearTimeout(checkInTimerRef.current);
      checkInTimerRef.current = null;
    }
  };

  const clearCheckInCountdown = () => {
    if (checkInCountdownRef.current) {
      clearInterval(checkInCountdownRef.current);
      checkInCountdownRef.current = null;
    }
    setSecondsRemaining(null);
  };

  const clearFakeCallTimers = () => {
    if (fakeCallTimerRef.current) {
      clearTimeout(fakeCallTimerRef.current);
      fakeCallTimerRef.current = null;
    }
    if (fakeCallCountdownRef.current) {
      clearInterval(fakeCallCountdownRef.current);
      fakeCallCountdownRef.current = null;
    }
    setFakeCallCountdown(null);
  };

  const classifyBattery = (level: number | null) => {
    if (level === null) {
      return { level: "yellow" as const, label: "Unknown" };
    }
    const percent = Math.round(level * 100);
    if (percent <= 15) {
      return { level: "red" as const, label: `${percent}%` };
    }
    if (percent <= 30) {
      return { level: "yellow" as const, label: `${percent}%` };
    }
    return { level: "green" as const, label: `${percent}%` };
  };

  const checkInternet = async () => {
    try {
      const start = Date.now();
      const response = await api.get("/health");
      if (response?.data?.status !== "ok") {
        return { level: "red" as const, label: "Offline" };
      }
      const latency = Date.now() - start;
      if (latency > 2000) {
        return { level: "yellow" as const, label: `Slow (${latency}ms)` };
      }
      return { level: "green" as const, label: `Online (${latency}ms)` };
    } catch {
      return { level: "red" as const, label: "Offline" };
    }
  };

  const checkGps = async () => {
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      const permission = await Location.getForegroundPermissionsAsync();

      if (!servicesEnabled) {
        return { level: "red" as const, label: "Location off" };
      }
      if (!permission.granted) {
        return { level: "yellow" as const, label: "Permission needed" };
      }
      return { level: "green" as const, label: "Ready" };
    } catch {
      return { level: "yellow" as const, label: "Unknown" };
    }
  };

  const checkSmsBackend = async () => {
    try {
      const response = await api.get("/system/status");
      if (response.data?.sms_backend === "configured") {
        return { level: "green" as const, label: "Configured" };
      }
      return { level: "yellow" as const, label: "Simulated" };
    } catch {
      return { level: "red" as const, label: "Unavailable" };
    }
  };

  const buildHealthBroadcast = (snapshot: HealthSnapshot) => {
    return `Device health update: GPS ${snapshot.gps.label}; Internet ${snapshot.internet.label}; SMS backend ${snapshot.smsBackend.label}; Battery ${snapshot.battery.label}.`;
  };

  const buildHealthBroadcastKey = (snapshot: HealthSnapshot) => {
    return [
      snapshot.gps.level,
      snapshot.internet.level,
      snapshot.smsBackend.level,
      snapshot.battery.level,
      snapshot.battery.label,
    ].join("|");
  };

  const maybeBroadcastHealthToLiveRoom = async (snapshot: HealthSnapshot) => {
    if (!trustedRoom) {
      return;
    }
    const now = Date.now();
    const nextKey = buildHealthBroadcastKey(snapshot);
    const changed = nextKey !== lastHealthBroadcastKeyRef.current;
    const throttled = now - lastHealthBroadcastAtRef.current < 60000;
    if (!changed || throttled) {
      return;
    }
    try {
      const updatedRoom = await addLiveRoomNote(trustedRoom.id, buildHealthBroadcast(snapshot));
      setTrustedRoom(updatedRoom);
      lastHealthBroadcastKeyRef.current = nextKey;
      lastHealthBroadcastAtRef.current = now;
    } catch {
      // ignore live-room health broadcast failures
    }
  };

  const refreshNetworkHealth = async () => {
    const [internet, gps, smsBackend, batteryLevel] = await Promise.all([
      checkInternet(),
      checkGps(),
      checkSmsBackend(),
      Battery.getBatteryLevelAsync().catch(() => null),
    ]);

    const snapshot: HealthSnapshot = {
      internet,
      gps,
      smsBackend,
      battery: classifyBattery(batteryLevel),
    };

    setNetworkHealth(snapshot);
    await maybeBroadcastHealthToLiveRoom(snapshot);
  };

  const scheduleCheckInEscalation = (checkIn: SmartCheckIn) => {
    clearCheckInTimer();
    const dueAt = new Date(checkIn.due_at).getTime();
    const waitFor = Math.max(dueAt - Date.now(), 1000);

    checkInTimerRef.current = setTimeout(async () => {
      try {
        const latest = await getLatestSmartCheckIn();
        if (!latest || (latest.status !== "pending" && latest.status !== "missed")) {
          return;
        }

        const escalationAlert = await createEmergencyAlertWithConfig(
          "smart_checkin_missed",
          0.93,
          SMART_CHECKIN_FALLBACK_FEATURES,
          {
            skipSmsDraft: true,
            metadata: {
              source: "smart_checkin_timeout",
              check_in_id: latest.id,
            },
          }
        );
        if (latest.status === "pending") {
          await acknowledgeSmartCheckIn(
            latest.id,
            "need_help",
            "Auto-escalated because user did not confirm safety."
          );
        }
        setDemoMessage(
          `Smart check-in missed. Escalation alert created (${escalationAlert.id || escalationAlert._id || "local"}).`
        );
        setLatestAlertId(escalationAlert.id || escalationAlert._id || "");
        setLatestAlertMap(escalationAlert.map_link || "");
        if (escalationAlert.trusted_circle_room) {
          setTrustedRoom(escalationAlert.trusted_circle_room);
        }
        const refreshedCheckIn = await getLatestSmartCheckIn();
        setSmartCheckIn(refreshedCheckIn);
      } catch {
        setDemoMessage("Smart check-in escalation failed. Retry from the check-in card.");
      }
    }, waitFor);
  };

  const startCheckInCountdown = (checkIn: SmartCheckIn) => {
    clearCheckInCountdown();
    const syncCountdown = () => {
      const remaining = Math.max(
        Math.ceil((new Date(checkIn.due_at).getTime() - Date.now()) / 1000),
        0
      );
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        clearCheckInCountdown();
      }
    };
    syncCountdown();
    checkInCountdownRef.current = setInterval(syncCountdown, 1000);
  };

  const armSmartCheckInAfterAlert = async (reason: string) => {
    try {
      setCheckInBusy(true);
      const checkIn = await requestSmartCheckIn(reason, safetyPrefs.autoEscalationSeconds);
      setSmartCheckIn(checkIn);
      await refreshPendingCheckInFromServer();
      scheduleCheckInEscalation(checkIn);
      startCheckInCountdown(checkIn);
    } catch {
      setDemoMessage("Could not start smart check-in monitoring.");
    } finally {
      setCheckInBusy(false);
    }
  };

  const startSafeArrivalCheckIn = async () => {
    try {
      setCheckInBusy(true);
      const destination = safeArrivalDestination.trim() || "destination";
      const reason = `safe_arrival:${destination}`;
      const checkIn = await requestSmartCheckIn(reason, safeArrivalEtaMinutes * 60);
      setSmartCheckIn(checkIn);
      await refreshPendingCheckInFromServer();
      scheduleCheckInEscalation(checkIn);
      startCheckInCountdown(checkIn);
      const room = await ensureTrustedRoom();
      if (room) {
        const updatedRoom = await addLiveRoomNote(
          room.id,
          `Safe arrival check-in started for ${destination}. ETA ${safeArrivalEtaMinutes} min.`
        );
        setTrustedRoom(updatedRoom);
      }
      setDemoMessage(
        `Safe arrival check-in started. Confirm safe within ${safeArrivalEtaMinutes} minutes.`
      );
    } catch {
      setDemoMessage("Could not start safe arrival check-in.");
    } finally {
      setCheckInBusy(false);
    }
  };

  const confirmSafeArrival = async () => {
    if (!smartCheckIn || smartCheckIn.status !== "pending") {
      setDemoMessage("No pending safe arrival check-in found.");
      return;
    }
    try {
      setCheckInBusy(true);
      const updated = await acknowledgeSmartCheckIn(
        smartCheckIn.id,
        "safe",
        "User confirmed safe arrival."
      );
      setSmartCheckIn(updated);
      await refreshPendingCheckInFromServer();
      clearCheckInTimer();
      clearCheckInCountdown();
      const room = await ensureTrustedRoom();
      if (room) {
        const destination = safeArrivalDestination.trim() || "destination";
        const updatedRoom = await addLiveRoomNote(
          room.id,
          `Safe arrival confirmed at ${destination}.`
        );
        setTrustedRoom(updatedRoom);
      }
      setDemoMessage("Safe arrival confirmed.");
    } catch {
      setDemoMessage("Could not confirm safe arrival.");
    } finally {
      setCheckInBusy(false);
    }
  };

  const loadSafetyContext = async () => {
    try {
      const prefs = await getSafetyPreferences();
      setSafetyPrefs(prefs);
      const [room, checkIn] = await Promise.all([
        getLatestLiveRoom(),
        getLatestSmartCheckIn(),
      ]);
      setTrustedRoom(room);
      setSmartCheckIn(checkIn);
      if (checkIn && checkIn.status === "pending") {
        scheduleCheckInEscalation(checkIn);
        startCheckInCountdown(checkIn);
      } else {
        clearCheckInCountdown();
      }
    } catch {
      // ignore noisy refresh failures for demo resilience
    }
  };

  useEffect(() => {
    getSafetyPreferences().then(setSafetyPrefs).catch(() => undefined);
    loadSafetyContext();
    refreshNetworkHealth().catch(() => undefined);
    const timer = setInterval(loadSafetyContext, 12000);
    const healthTimer = setInterval(() => {
      refreshNetworkHealth().catch(() => undefined);
    }, 15000);
    return () => {
      clearInterval(timer);
      clearInterval(healthTimer);
      clearCheckInTimer();
      clearCheckInCountdown();
      clearPendingAlertTimers();
      clearFakeCallTimers();
      stopFakeCallRingtone().catch(() => undefined);
      ringLoopRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    let stopMonitor: (() => void) | null = null;
    startShakeSosMonitor(() => {
      armPendingAlert({
        gestureLabel: "shake_sos",
        confidence: 0.9,
        features: SMART_CHECKIN_FALLBACK_FEATURES,
        reason: "shake_detected_emergency",
      });
    })
      .then((cleanup) => {
        stopMonitor = cleanup;
      })
      .catch(() => undefined);

    return () => {
      stopMonitor?.();
    };
  }, [safetyPrefs.cancelWindowSeconds]);

  useEffect(() => {
    if (!trustedRoom) {
      return;
    }
    refreshNetworkHealth().catch(() => undefined);
  }, [trustedRoom?.id]);

  useEffect(() => {
    if (!pendingAlert) {
      return;
    }
    if (!safetyPrefs.vibrationEnabled) {
      return;
    }
    Vibration.vibrate(220);
    pendingVibrationRef.current = setInterval(() => {
      Vibration.vibrate(220);
    }, 900);
    return () => {
      if (pendingVibrationRef.current) {
        clearInterval(pendingVibrationRef.current);
        pendingVibrationRef.current = null;
      }
      Vibration.cancel();
    };
  }, [pendingAlert, safetyPrefs.vibrationEnabled]);

  useEffect(() => {
    Animated.timing(cardReveal, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [cardReveal]);

  useEffect(() => {
    if (showFakeCall) {
      startFakeCallRingtone(safetyPrefs.vibrationEnabled).catch(() => undefined);
      ringLoopRef.current?.stop();
      ringLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(ringPulse, {
            toValue: 1.06,
            duration: 560,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(ringPulse, {
            toValue: 1,
            duration: 560,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      ringLoopRef.current.start();
    } else {
      stopFakeCallRingtone().catch(() => undefined);
      ringLoopRef.current?.stop();
      ringPulse.setValue(1);
    }
  }, [showFakeCall, ringPulse, safetyPrefs.vibrationEnabled]);

  useEffect(() => {
    if (!lastResult?.alert) {
      return;
    }
    const alert = lastResult.alert;
    setLatestAlertId(alert.id || alert._id || "");
    setLatestAlertMap(alert.map_link || "");
    if (alert.trusted_circle_room) {
      setTrustedRoom(alert.trusted_circle_room);
    }
    armSmartCheckInAfterAlert("post_alert_safety_confirmation").catch(() => undefined);
  }, [lastResult?.alert?.id, lastResult?.alert?._id]);

  const triggerPrototypeAlert = async () => {
    setDemoMessage("");
    const features = {
      coordinates: [
        [0, 0],
        [20, 10],
        [5, 30],
        [35, 60],
      ],
      duration_ms: 860,
      average_speed: 0.57,
      max_speed: 1.38,
      total_distance: 318,
      direction_changes: 4,
    };
    armPendingAlert({
      gestureLabel: "distress_swipe",
      confidence: 0.97,
      features,
      reason: "prototype_alert_safety_confirmation",
    });
  };

  const startFakeCall = () => {
    clearFakeCallTimers();
    setShowFakeCall(false);
    setFakeCallCountdown(fakeCallDelaySeconds);
    setDemoMessage(`Fake call from ${selectedFakeCaller.name} in ${fakeCallDelaySeconds}s.`);

    fakeCallTimerRef.current = setTimeout(() => {
      clearFakeCallTimers();
      setShowFakeCall(true);
    }, fakeCallDelaySeconds * 1000);

    fakeCallCountdownRef.current = setInterval(() => {
      setFakeCallCountdown((previous) => {
        if (previous === null) {
          return null;
        }
        return Math.max(previous - 1, 0);
      });
    }, 1000);
  };

  const acceptFakeCall = () => {
    clearFakeCallTimers();
    setShowFakeCall(false);
    setEscapeMode(true);
  };

  const declineFakeCall = () => {
    clearFakeCallTimers();
    setShowFakeCall(false);
  };

  const exitEscapeMode = () => {
    setEscapeMode(false);
  };

  const sendTrustedRoomUpdate = async () => {
    try {
      const room = await ensureTrustedRoom();
      if (!room) {
        setDemoMessage("No trusted circle room found. Trigger an alert first.");
        return;
      }
      const updated = await addLiveRoomNote(
        room.id,
        "User update: I am moving toward a safer area."
      );
      setTrustedRoom(updated);
      setDemoMessage("Trusted circle updated with your status.");
    } catch (error: any) {
      setDemoMessage(getErrorMessage(error, "Could not post trusted-circle update."));
    }
  };

  const acknowledgeSafeNow = async () => {
    try {
      setCheckInBusy(true);
      let checkInUpdated = false;
      let roomUpdated = false;
      if (smartCheckIn && smartCheckIn.status === "pending") {
        const updated = await acknowledgeSmartCheckIn(
          smartCheckIn.id,
          "safe",
          "User confirmed they are safe."
        );
        setSmartCheckIn(updated);
        await refreshPendingCheckInFromServer();
        checkInUpdated = true;
      }
      const room = await ensureTrustedRoom();
      if (room) {
        const updatedRoom = await addLiveRoomNote(
          room.id,
          buildPostAlertActionNote("safe_now", new Date())
        );
        setTrustedRoom(updatedRoom);
        roomUpdated = true;
      }
      clearCheckInTimer();
      clearCheckInCountdown();
      if (checkInUpdated || roomUpdated) {
        setDemoMessage("Safety status updated successfully.");
      } else {
        setDemoMessage("No active check-in or live room found to update.");
      }
    } catch (error: any) {
      setDemoMessage(getErrorMessage(error, "Could not confirm safe status."));
    } finally {
      setCheckInBusy(false);
    }
  };

  const triggerNeedHelpNow = async () => {
    try {
      setCheckInBusy(true);
      if (smartCheckIn && smartCheckIn.status === "pending") {
        const updated = await acknowledgeSmartCheckIn(
          smartCheckIn.id,
          "need_help",
          "User marked need help manually."
        );
        setSmartCheckIn(updated);
        await refreshPendingCheckInFromServer();
      }
      const escalationAlert = await createEmergencyAlertWithConfig(
        "manual_need_help",
        0.99,
        SMART_CHECKIN_FALLBACK_FEATURES,
        {
          skipSmsDraft: true,
          metadata: { source: "manual_need_help" },
        }
      );
      setLatestAlertId(escalationAlert.id || escalationAlert._id || "");
      setLatestAlertMap(escalationAlert.map_link || "");
      if (escalationAlert.trusted_circle_room) {
        setTrustedRoom(escalationAlert.trusted_circle_room);
      } else {
        const room = await ensureTrustedRoom();
        if (room) {
          const updatedRoom = await addLiveRoomNote(
            room.id,
            buildPostAlertActionNote("need_help", new Date())
          );
          setTrustedRoom(updatedRoom);
        }
      }
      await startBackgroundLocationTracking().catch(() => undefined);
      setDemoMessage("Need-help escalation sent to your trusted circle.");
    } catch (error: any) {
      setDemoMessage(getErrorMessage(error, "Could not send need-help escalation."));
    } finally {
      setCheckInBusy(false);
    }
  };

  const shareStatusUpdate = async () => {
    try {
      setCheckInBusy(true);
      const room = await ensureTrustedRoom();
      if (!room) {
        setDemoMessage("No trusted circle room is active yet.");
        return;
      }
      const updatedRoom = await addLiveRoomNote(
        room.id,
        buildPostAlertActionNote("share_update", new Date())
      );
      setTrustedRoom(updatedRoom);
      setDemoMessage("Shared update with your trusted circle.");
    } catch (error: any) {
      setDemoMessage(getErrorMessage(error, "Could not share status update."));
    } finally {
      setCheckInBusy(false);
    }
  };

  if (escapeMode) {
    return (
      <View style={styles.container}>
        <View style={styles.escapeCard}>
          <Text style={styles.escapeTitle}>Daily Notes</Text>
          <Text style={styles.escapeText}>Meeting prep</Text>
          <Text style={styles.escapeText}>Buy groceries</Text>
          <Text style={styles.escapeText}>Project summary draft</Text>
          <Pressable style={styles.returnButton} onPress={exitEscapeMode}>
            <Text style={styles.returnButtonText}>Return to SafeHer</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.heroCard,
            {
              opacity: cardReveal,
              transform: [
                {
                  translateY: cardReveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.heading}>Welcome, {user?.full_name}</Text>
          <Text style={styles.caption}>Status: {status}</Text>
          <View style={styles.heroPills}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillLabel}>Touch ML</Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillLabel}>Trusted Circle</Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillLabel}>Smart Check-in</Text>
            </View>
          </View>
        </Animated.View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Network Health</Text>
          <View style={styles.healthGrid}>
            <View style={[styles.healthBadge, getHealthLevelStyle(networkHealth.gps.level)]}>
              <Text style={styles.healthBadgeTitle}>GPS</Text>
              <Text style={styles.healthBadgeValue}>{networkHealth.gps.label}</Text>
            </View>
            <View style={[styles.healthBadge, getHealthLevelStyle(networkHealth.internet.level)]}>
              <Text style={styles.healthBadgeTitle}>Internet</Text>
              <Text style={styles.healthBadgeValue}>{networkHealth.internet.label}</Text>
            </View>
            <View style={[styles.healthBadge, getHealthLevelStyle(networkHealth.smsBackend.level)]}>
              <Text style={styles.healthBadgeTitle}>SMS Backend</Text>
              <Text style={styles.healthBadgeValue}>{networkHealth.smsBackend.label}</Text>
            </View>
            <View style={[styles.healthBadge, getHealthLevelStyle(networkHealth.battery.level)]}>
              <Text style={styles.healthBadgeTitle}>Battery</Text>
              <Text style={styles.healthBadgeValue}>{networkHealth.battery.label}</Text>
            </View>
          </View>
        </View>

        <Animated.View
          style={[
            styles.safetyActionsCard,
            {
              opacity: cardReveal.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
              transform: [
                {
                  translateY: cardReveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.cardTitle}>Quick Safety Actions</Text>
          <Text style={styles.cardText}>Caller preset</Text>
          <View style={styles.fakeChoiceRow}>
            {FAKE_CALL_PRESETS.map((preset, index) => (
              <Pressable
                key={preset.name}
                style={[
                  styles.fakeChoiceButton,
                  selectedFakeCallerIndex === index && styles.fakeChoiceButtonActive,
                ]}
                onPress={() => setSelectedFakeCallerIndex(index)}
              >
                <Text style={styles.fakeChoiceText}>{preset.name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.cardText}>Ring delay</Text>
          <View style={styles.fakeChoiceRow}>
            {FAKE_CALL_DELAY_OPTIONS.map((seconds) => (
              <Pressable
                key={seconds}
                style={[
                  styles.fakeChoiceButton,
                  fakeCallDelaySeconds === seconds && styles.fakeChoiceButtonActive,
                ]}
                onPress={() => setFakeCallDelaySeconds(seconds)}
              >
                <Text style={styles.fakeChoiceText}>{seconds}s</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.secondaryButton} onPress={startFakeCall}>
            <Text style={styles.secondaryButtonText}>
              {fakeCallCountdown !== null ? `Fake Call in ${fakeCallCountdown}s` : "Fake Call + Escape Mode"}
            </Text>
          </Pressable>
          {fakeCallCountdown !== null ? (
            <Pressable style={styles.secondaryButton} onPress={declineFakeCall}>
              <Text style={styles.secondaryButtonText}>Cancel Fake Call</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[
              styles.secondaryButton,
              (!trustedRoom || checkInBusy) && styles.buttonDisabled,
            ]}
            onPress={sendTrustedRoomUpdate}
            disabled={!trustedRoom || checkInBusy}
          >
            <Text style={styles.secondaryButtonText}>Update Trusted Circle Room</Text>
          </Pressable>
          <Pressable
            style={[
              styles.secondaryButton,
              (!smartCheckIn || smartCheckIn.status !== "pending" || checkInBusy) &&
                styles.buttonDisabled,
            ]}
            onPress={acknowledgeSafeNow}
            disabled={!smartCheckIn || smartCheckIn.status !== "pending" || checkInBusy}
          >
            <Text style={styles.secondaryButtonText}>Safe Now</Text>
          </Pressable>
        </Animated.View>

        <View style={styles.prototypeCard}>
          <Text style={styles.prototypeTitle}>Prototype Demo Mode</Text>
          <Text style={styles.prototypeText}>
            Trigger a reliable emergency alert for live demo. This also creates a trusted-circle room and a smart check-in timer.
          </Text>
          <Pressable
            style={[styles.prototypeButton, demoLoading && styles.buttonDisabled]}
            onPress={triggerPrototypeAlert}
            disabled={demoLoading}
          >
            {demoLoading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.prototypeButtonText}>Trigger Prototype Alert</Text>
            )}
          </Pressable>
          {demoMessage ? <Text style={styles.prototypeMessage}>{demoMessage}</Text> : null}
          {latestAlertId ? <Text style={styles.prototypeMessage}>Alert ID: {latestAlertId}</Text> : null}
          {latestAlertMap ? <Text style={styles.prototypeMessage}>Location: {latestAlertMap}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Trusted Circle Live Room</Text>
          {trustedRoom ? (
            <>
              <Text style={styles.cardText}>Room code: {trustedRoom.room_code}</Text>
              <Text style={styles.cardText}>People: {trustedContactsLabel}</Text>
              <Text style={styles.cardText}>
                Last update: {new Date(trustedRoom.updated_at).toLocaleString()}
              </Text>
            </>
          ) : (
            <Text style={styles.cardText}>No active live room yet. Trigger an alert to activate one.</Text>
          )}
        </View>

        {latestAlertId ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Post-Alert Actions</Text>
            <Pressable
              style={[
                styles.secondaryButton,
                checkInBusy && styles.buttonDisabled,
              ]}
              onPress={acknowledgeSafeNow}
              disabled={checkInBusy}
            >
              <Text style={styles.secondaryButtonText}>Safe now</Text>
            </Pressable>
            <Pressable
              style={[
                styles.secondaryButton,
                checkInBusy && styles.buttonDisabled,
              ]}
              onPress={triggerNeedHelpNow}
              disabled={checkInBusy}
            >
              <Text style={styles.secondaryButtonText}>Need help</Text>
            </Pressable>
            <Pressable
              style={[
                styles.secondaryButton,
                (!trustedRoom || checkInBusy) && styles.buttonDisabled,
              ]}
              onPress={shareStatusUpdate}
              disabled={!trustedRoom || checkInBusy}
            >
              <Text style={styles.secondaryButtonText}>Share update</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Safe Arrival Check-in</Text>
          <Text style={styles.cardText}>
            Start a travel check-in and auto-escalate if you do not confirm arrival.
          </Text>
          <TextInput
            style={styles.destinationInput}
            placeholder="Destination (optional)"
            placeholderTextColor={colors.subtext}
            value={safeArrivalDestination}
            onChangeText={setSafeArrivalDestination}
          />
          <View style={styles.etaRow}>
            {[5, 10, 15].map((minutes) => (
              <Pressable
                key={minutes}
                style={[
                  styles.etaButton,
                  safeArrivalEtaMinutes === minutes && styles.etaButtonActive,
                ]}
                onPress={() => setSafeArrivalEtaMinutes(minutes as 5 | 10 | 15)}
              >
                <Text style={styles.etaButtonText}>{minutes}m</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={[styles.secondaryButton, checkInBusy && styles.buttonDisabled]}
            onPress={startSafeArrivalCheckIn}
            disabled={checkInBusy}
          >
            <Text style={styles.secondaryButtonText}>Start Safe Arrival</Text>
          </Pressable>
          <Pressable
            style={[
              styles.secondaryButton,
              (!smartCheckIn || smartCheckIn.status !== "pending" || checkInBusy) &&
                styles.buttonDisabled,
            ]}
            onPress={confirmSafeArrival}
            disabled={!smartCheckIn || smartCheckIn.status !== "pending" || checkInBusy}
          >
            <Text style={styles.secondaryButtonText}>I Arrived Safely</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Smart Check-in</Text>
          {smartCheckIn ? (
            <>
              <Text style={styles.cardText}>
                Reason: {smartCheckIn.reason.startsWith("safe_arrival:")
                  ? `safe_arrival (${smartCheckIn.reason.split(":").slice(1).join(":") || "destination"})`
                  : smartCheckIn.reason}
              </Text>
              <Text style={styles.cardText}>Status: {smartCheckIn.status}</Text>
              <Text style={styles.cardText}>
                Due: {new Date(smartCheckIn.due_at).toLocaleString()}
              </Text>
              {smartCheckIn.status === "pending" && secondsRemaining !== null ? (
                <Text style={styles.urgencyText}>
                  Auto-escalation in {secondsRemaining}s if no safety response.
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.cardText}>No pending smart check-in.</Text>
          )}
        </View>

        <View style={styles.capturePad} {...panResponder.panHandlers}>
          <Text style={styles.captureTitle}>Draw distress gesture here</Text>
          <Text style={styles.captureHint}>
            Fast zig-zag or panic swipe patterns trigger the alert simulation.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Last inference</Text>
          <Text style={styles.cardText}>Label: {lastResult?.label || "No gesture yet"}</Text>
          <Text style={styles.cardText}>Confidence: {lastResult?.confidence ?? "-"}</Text>
          <Text style={styles.cardText}>
            Alert ID: {lastResult?.alert?.id || lastResult?.alert?._id || "-"}
          </Text>
          <Text style={styles.cardText}>
            SMS Draft:{" "}
            {lastResult?.alert?.sms_launch?.opened
              ? "Opened"
              : lastResult?.alert?.sms_launch?.reason || "-"}
          </Text>
          {lastResult?.error ? <Text style={styles.cardText}>Note: {lastResult.error}</Text> : null}
        </View>

        <Pressable style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={showFakeCall} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.fakeCallCard, { transform: [{ scale: ringPulse }] }]}>
            <Text style={styles.fakeCallHeader}>Incoming call</Text>
            <Text style={styles.fakeCallName}>{selectedFakeCaller.name}</Text>
            <Text style={styles.fakeCallSubtext}>{selectedFakeCaller.subtitle}</Text>
            <Text style={styles.fakeCallSubtext}>Ringing...</Text>
            <View style={styles.fakeCallActions}>
              <Pressable style={styles.declineButton} onPress={declineFakeCall}>
                <Text style={styles.fakeCallButtonText}>Decline</Text>
              </Pressable>
              <Pressable style={styles.acceptButton} onPress={acceptFakeCall}>
                <Text style={styles.fakeCallButtonText}>Accept</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={Boolean(pendingAlert)} transparent animationType="fade">
        <View style={styles.pendingModalOverlay}>
          <View style={styles.pendingModalCard}>
            <Text style={styles.pendingTitle}>Emergency Alert Ready</Text>
            <Text style={styles.pendingText}>
              Sending emergency alert in {pendingAlertSeconds ?? 0}s.
            </Text>
            <Text style={styles.pendingText}>
              Cancel if this was accidental, or send now to alert trusted contacts immediately.
            </Text>
            <View style={styles.pendingActions}>
              <Pressable
                style={styles.pendingDangerButton}
                onPress={cancelPendingAlert}
                accessibilityRole="button"
                accessibilityLabel="Cancel emergency alert"
                accessibilityHint="Stops the alert from being sent to contacts."
                hitSlop={10}
              >
                <Text style={styles.pendingButtonText}>Cancel Alert</Text>
              </Pressable>
              <Pressable
                style={[styles.pendingPrimaryButton, demoLoading && styles.buttonDisabled]}
                onPress={sendPendingAlertImmediately}
                disabled={demoLoading}
                accessibilityRole="button"
                accessibilityLabel="Send emergency alert now"
                accessibilityHint="Immediately sends alert and live location to trusted contacts."
                hitSlop={10}
              >
                <Text style={styles.pendingButtonText}>Send Now</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
