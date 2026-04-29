import { runLocalInference } from "./mlService";
import { GestureFeatures } from "../utils/gesture";

let cachedModel: any = null;
const labels = require("../../assets/models/gesture_labels.json");

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
