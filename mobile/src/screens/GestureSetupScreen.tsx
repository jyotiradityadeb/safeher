import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fetchLatestGlobalModel, simulateFederatedRound } from "../services/federatedService";
import { startBackgroundLocationTracking, stopBackgroundLocationTracking } from "../services/backgroundLocation";
import { colors } from "../theme/colors";
import { getErrorMessage } from "../utils/errorMessage";
const demoMetrics = require("../../assets/models/gesture_demo_metrics.json");

export function GestureSetupScreen() {
  const [message, setMessage] = React.useState("");
  const [modelSummary, setModelSummary] = React.useState<any>({ round_id: 0, metrics: {}, aggregated_weights: [] });

  const loadModel = React.useCallback(async () => {
    try {
      const latest = await fetchLatestGlobalModel();
      setModelSummary(latest);
    } catch (error: any) {
      setMessage(getErrorMessage(error, "Could not load the global model."));
    }
  }, []);

  React.useEffect(() => {
    loadModel();
  }, [loadModel]);

  const enableTracking = async () => {
    try {
      await startBackgroundLocationTracking();
      setMessage("Background safety tracking enabled.");
    } catch (error: any) {
      setMessage(getErrorMessage(error, "Could not enable background tracking."));
    }
  };

  const disableTracking = async () => {
    try {
      await stopBackgroundLocationTracking();
      setMessage("Background safety tracking disabled.");
    } catch (error: any) {
      setMessage(getErrorMessage(error, "Could not disable background tracking."));
    }
  };

  const runLocalFederatedTraining = async () => {
    try {
      const result = await simulateFederatedRound();
      setModelSummary(result.global_model);
      setMessage(result.message);
    } catch (error: any) {
      setMessage(getErrorMessage(error, "Could not submit the local model update."));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.title}>Gesture Setup</Text>
        <Text style={styles.text}>Recommended emergency patterns for the prototype and presentation demo.</Text>
      </View>
      <Text style={styles.item}>1. Rapid zig-zag swipe</Text>
      <Text style={styles.item}>2. Tight circular panic motion</Text>
      <Text style={styles.item}>3. Long press + slash pattern</Text>
      <View style={styles.modelCard}>
        <Text style={styles.modelTitle}>Federated Learning Status</Text>
        <Text style={styles.text}>On-device model: bundled demo classifier</Text>
        <Text style={styles.text}>Local model accuracy: {demoMetrics?.accuracy ?? "n/a"}</Text>
        <Text style={styles.text}>Training samples: {demoMetrics?.sample_count ?? "n/a"}</Text>
        <Text style={styles.text}>Global round: {modelSummary?.round_id ?? 0}</Text>
        <Text style={styles.text}>Accuracy: {modelSummary?.metrics?.accuracy ?? "n/a"}</Text>
        <Text style={styles.text}>Loss: {modelSummary?.metrics?.loss ?? "n/a"}</Text>
      </View>
      <Pressable style={styles.button} onPress={runLocalFederatedTraining}>
        <Text style={styles.buttonText}>Simulate local training update</Text>
      </Pressable>
      <Pressable style={[styles.button, styles.secondaryButton]} onPress={loadModel}>
        <Text style={styles.buttonText}>Refresh global model</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={enableTracking}>
        <Text style={styles.buttonText}>Enable background tracking</Text>
      </Pressable>
      <Pressable style={[styles.button, styles.secondaryButton]} onPress={disableTracking}>
        <Text style={styles.buttonText}>Disable background tracking</Text>
      </Pressable>
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
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
  },
  text: {
    color: colors.subtext,
    lineHeight: 20,
  },
  item: {
    color: colors.text,
    backgroundColor: colors.card,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modelCard: {
    backgroundColor: colors.cardAlt,
    padding: 16,
    borderRadius: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modelTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 14,
  },
  secondaryButton: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: {
    color: colors.text,
    textAlign: "center",
    fontWeight: "700",
  },
  message: {
    color: colors.subtext,
    lineHeight: 20,
  },
});
