import { runLocalInference } from "./mlService";
import { GestureFeatures } from "../utils/gesture";

let cachedModel: any = null;
const labels = require("../../assets/models/gesture_labels.json");
const demoModel = require("../../assets/models/gesture_demo_model.json");

async function loadTFLiteModel() {
  if (cachedModel || process.env.EXPO_PUBLIC_USE_TFLITE !== "true") {
    return cachedModel;
  }

  try {
    const module = await import("react-native-fast-tflite");
    cachedModel = await module.loadTensorflowModel(require("../../assets/models/gesture_model.tflite"));
    return cachedModel;
  } catch {
    return null;
  }
}

export async function runGestureInference(features: GestureFeatures) {
  const model = await loadTFLiteModel();
  if (!model) {
    const learnedResult = runBundledDemoModel(features);
    if (learnedResult) {
      return learnedResult;
    }
    return runLocalInference(features);
  }

  const input = new Float32Array([
    features.duration_ms,
    features.average_speed,
    features.max_speed,
    features.total_distance,
    features.direction_changes,
  ]);

  const output = await model.run([input]);
  const scores = Array.from(output[0] || []) as number[];
  const bestScore = scores.reduce(
    (current, score, index) => (score > current.score ? { score, index } : current),
    { score: Number.NEGATIVE_INFINITY, index: 0 }
  );
  const label = labels[bestScore.index] || "normal_interaction";
  const emergency = label !== "normal_interaction";
  const confidence = bestScore.score;

  return {
    label,
    confidence,
    emergency,
  };
}

function runBundledDemoModel(features: GestureFeatures) {
  if (!demoModel?.centroids || !demoModel?.labels) {
    return null;
  }

  const vector = [
    features.duration_ms,
    features.average_speed,
    features.max_speed,
    features.total_distance,
    features.direction_changes,
  ];

  const normalized = vector.map((value, index) => {
    const featureName = demoModel.features[index];
    const mean = Number(demoModel.mean?.[featureName] ?? 0);
    const std = Number(demoModel.std?.[featureName] ?? 1) || 1;
    return (value - mean) / std;
  });

  const distances = demoModel.labels.map((label: string) => {
    const centroid = demoModel.centroids[label] as number[];
    const distance = Math.sqrt(
      centroid.reduce((sum, centroidValue, index) => sum + Math.pow(normalized[index] - centroidValue, 2), 0)
    );
    return { label, distance };
  });

  const typedDistances = distances as Array<{ label: string; distance: number }>;
  typedDistances.sort(
    (left: { label: string; distance: number }, right: { label: string; distance: number }) =>
      left.distance - right.distance
  );
  const best = typedDistances[0];
  const runnerUp = typedDistances[1];
  const confidence = runnerUp
    ? Number((1 / (1 + best.distance / Math.max(runnerUp.distance, 0.001))).toFixed(4))
    : Number((1 / (1 + best.distance)).toFixed(4));

  return {
    label: best.label,
    confidence,
    emergency: best.label !== "normal_interaction",
  };
}
