import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { api } from "../api/client";
import { getLatestLiveRoom, getLatestSmartCheckIn, LiveRoom, SmartCheckIn } from "../services/safetyService";
import { colors } from "../theme/colors";
import { getErrorMessage } from "../utils/errorMessage";

export function LiveStatusScreen() {
  const [latestAlert, setLatestAlert] = useState<any>(null);
  const [latestLocation, setLatestLocation] = useState<any>(null);
  const [liveRoom, setLiveRoom] = useState<LiveRoom | null>(null);
  const [smartCheckIn, setSmartCheckIn] = useState<SmartCheckIn | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLatest = async () => {
    try {
      setLoading(true);
      setError("");
      const [{ data: alerts }, { data: location }, room, checkIn] = await Promise.all([
        api.get("/alerts/history"),
        api.get("/locations/latest"),
        getLatestLiveRoom(),
        getLatestSmartCheckIn(),
      ]);
      setLatestAlert(alerts[0] || null);
      setLatestLocation(location || null);
      setLiveRoom(room);
      setSmartCheckIn(checkIn);
    } catch (loadError: any) {
      setError(getErrorMessage(loadError, "Could not load the latest status."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLatest();
    const timer = setInterval(loadLatest, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <Text style={styles.title}>Live Status</Text>
      <Pressable style={styles.refreshButton} onPress={loadLatest}>
        <Text style={styles.refreshText}>Refresh Status</Text>
      </Pressable>
      {loading ? <ActivityIndicator color={colors.primary} style={{ marginBottom: 16 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={[styles.badge, { backgroundColor: latestAlert ? colors.danger : colors.success }]}>
        <Text style={styles.badgeText}>{latestAlert ? "Alert Triggered" : "Safe"}</Text>
      </View>

      {latestAlert ? (
        <View style={styles.card}>
          <Text style={styles.info}>Gesture: {latestAlert.gesture_label}</Text>
          <Text style={styles.info}>Confidence: {latestAlert.confidence}</Text>
          <Text style={styles.info}>Triggered: {new Date(latestAlert.triggered_at).toLocaleString()}</Text>
          <Text style={styles.info}>
            Coordinates: {latestAlert.location?.latitude}, {latestAlert.location?.longitude}
          </Text>
          <Pressable style={styles.linkButton} onPress={() => Linking.openURL(latestAlert.map_link)}>
            <Text style={styles.linkText}>Open live location</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.info}>No active alert detected.</Text>
      )}

      <View style={styles.card}>
        <Text style={styles.infoTitle}>Trusted Circle Live Room</Text>
        {liveRoom ? (
          <>
            <Text style={styles.info}>Room code: {liveRoom.room_code}</Text>
            <Text style={styles.info}>Participants: {liveRoom.participants.length}</Text>
            <Text style={styles.info}>Last activity: {new Date(liveRoom.updated_at).toLocaleString()}</Text>
            <Text style={styles.info}>Latest note: {liveRoom.timeline?.slice(-1)[0]?.message || "No notes yet."}</Text>
          </>
        ) : (
          <Text style={styles.info}>No live room active.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.infoTitle}>Smart Check-in</Text>
        {smartCheckIn ? (
          <>
            <Text style={styles.info}>Status: {smartCheckIn.status}</Text>
            <Text style={styles.info}>Reason: {smartCheckIn.reason}</Text>
            <Text style={styles.info}>Due: {new Date(smartCheckIn.due_at).toLocaleString()}</Text>
            {smartCheckIn.acknowledged_at ? (
              <Text style={styles.info}>
                Acknowledged: {new Date(smartCheckIn.acknowledged_at).toLocaleString()}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.info}>No smart check-in request found.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.infoTitle}>Latest tracked location</Text>
        {latestLocation ? (
          <>
            <Text style={styles.info}>Latitude: {latestLocation.latitude}</Text>
            <Text style={styles.info}>Longitude: {latestLocation.longitude}</Text>
            <Text style={styles.info}>Recorded: {new Date(latestLocation.recorded_at).toLocaleString()}</Text>
          </>
        ) : (
          <Text style={styles.info}>No background location update yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 16,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    marginBottom: 16,
  },
  refreshButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.cardAlt,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  refreshText: {
    color: colors.text,
    fontWeight: "700",
  },
  badgeText: {
    color: colors.text,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    gap: 8,
    marginBottom: 12,
  },
  info: {
    color: colors.subtext,
  },
  infoTitle: {
    color: colors.text,
    fontWeight: "700",
    marginBottom: 8,
  },
  error: {
    color: colors.danger,
    marginBottom: 12,
  },
  linkButton: {
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  linkText: {
    color: colors.text,
    fontWeight: "700",
    textAlign: "center",
  },
});
