import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  getSafetyPreferences,
  saveSafetyPreferences,
  SafetyPreferences,
} from "../services/safetyPreferences";
import { colors } from "../theme/colors";

export function SettingsScreen() {
  const [prefs, setPrefs] = useState<SafetyPreferences | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getSafetyPreferences().then(setPrefs).catch(() => undefined);
  }, []);

  const update = async (next: Partial<SafetyPreferences>) => {
    const updated = await saveSafetyPreferences(next);
    setPrefs(updated);
    setMessage("Safety settings saved.");
  };

  if (!prefs) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Safety Settings</Text>
        <Text style={styles.text}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Safety Settings</Text>

      <Text style={styles.section}>Alert cancel window</Text>
      <View style={styles.row}>
        {[3, 5, 8].map((seconds) => (
          <Pressable
            key={seconds}
            style={[
              styles.optionButton,
              prefs.cancelWindowSeconds === seconds && styles.optionActive,
            ]}
            onPress={() =>
              update({ cancelWindowSeconds: seconds as 3 | 5 | 8 }).catch(() => undefined)
            }
          >
            <Text style={styles.optionText}>{seconds}s</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Vibration</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.optionButton, prefs.vibrationEnabled && styles.optionActive]}
          onPress={() => update({ vibrationEnabled: true }).catch(() => undefined)}
        >
          <Text style={styles.optionText}>On</Text>
        </Pressable>
        <Pressable
          style={[styles.optionButton, !prefs.vibrationEnabled && styles.optionActive]}
          onPress={() => update({ vibrationEnabled: false }).catch(() => undefined)}
        >
          <Text style={styles.optionText}>Off</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Auto-escalation timeout</Text>
      <View style={styles.row}>
        {[60, 120, 180].map((seconds) => (
          <Pressable
            key={seconds}
            style={[
              styles.optionButton,
              prefs.autoEscalationSeconds === seconds && styles.optionActive,
            ]}
            onPress={() =>
              update({
                autoEscalationSeconds: seconds as 60 | 120 | 180,
              }).catch(() => undefined)
            }
          >
            <Text style={styles.optionText}>{seconds}s</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Battery fallback SMS</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.optionButton, prefs.batteryFallbackEnabled && styles.optionActive]}
          onPress={() => update({ batteryFallbackEnabled: true }).catch(() => undefined)}
        >
          <Text style={styles.optionText}>On</Text>
        </Pressable>
        <Pressable
          style={[styles.optionButton, !prefs.batteryFallbackEnabled && styles.optionActive]}
          onPress={() => update({ batteryFallbackEnabled: false }).catch(() => undefined)}
        >
          <Text style={styles.optionText}>Off</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Battery trigger threshold</Text>
      <View style={styles.row}>
        {[5, 10, 15].map((percent) => (
          <Pressable
            key={percent}
            style={[
              styles.optionButton,
              prefs.batteryFallbackThreshold === percent && styles.optionActive,
            ]}
            onPress={() =>
              update({
                batteryFallbackThreshold: percent as 5 | 10 | 15,
              }).catch(() => undefined)
            }
          >
            <Text style={styles.optionText}>{percent}%</Text>
          </Pressable>
        ))}
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 6,
  },
  section: {
    color: colors.text,
    fontWeight: "700",
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  optionButton: {
    flex: 1,
    backgroundColor: colors.cardAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
  },
  optionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: {
    color: colors.text,
    textAlign: "center",
    fontWeight: "700",
  },
  text: {
    color: colors.subtext,
  },
  message: {
    color: colors.subtext,
    marginTop: 8,
  },
});
