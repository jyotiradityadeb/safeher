import React, { useEffect, useState } from "react";
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../api/client";
import { colors } from "../theme/colors";
import { getErrorMessage } from "../utils/errorMessage";

export function AlertHistoryScreen() {
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState("");

  const loadHistory = async () => {
    try {
      setError("");
      const { data } = await api.get("/alerts/history");
      setHistory(data);
    } catch (loadError: any) {
      setError(getErrorMessage(loadError, "Could not load alert history."));
    }
  };

  useEffect(() => {
    loadHistory();
    const timer = setInterval(loadHistory, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Alert History</Text>
      <Pressable style={styles.refreshButton} onPress={loadHistory}>
        <Text style={styles.refreshText}>Refresh History</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.gesture_label}</Text>
            <Text style={styles.meta}>Confidence: {item.confidence}</Text>
            <Text style={styles.meta}>Time: {new Date(item.triggered_at).toLocaleString()}</Text>
            <Text style={styles.meta}>Channels: {(item.delivery_channels || []).join(", ") || "none"}</Text>
            <Pressable onPress={() => Linking.openURL(item.map_link)}>
              <Text style={styles.link}>Open map link</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
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
  card: {
    backgroundColor: colors.cardAlt,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
  },
  refreshButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  refreshText: {
    color: colors.text,
    fontWeight: "700",
  },
  cardTitle: {
    color: colors.text,
    fontWeight: "700",
  },
  error: {
    color: colors.danger,
    marginBottom: 12,
  },
  meta: {
    color: colors.subtext,
    marginTop: 4,
  },
  link: {
    color: colors.primary,
    marginTop: 8,
    fontWeight: "700",
  },
});
