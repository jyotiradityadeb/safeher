import { GestureFeatures } from "../utils/gesture";

export type InferenceResult = {
  label: string;
  confidence: number;
  emergency: boolean;
};

const distressRules = [
  (features: GestureFeatures) => features.direction_changes >= 2 && features.duration_ms < 2500 && features.total_distance > 120,
  (features: GestureFeatures) => features.max_speed > 0.6 && features.total_distance > 180,
  (features: GestureFeatures) => features.direction_changes >= 1 && features.max_speed > 0.45 && features.total_distance > 140,
];

export async function runLocalInference(features: GestureFeatures): Promise<InferenceResult> {
  const emergency = distressRules.some((rule) => rule(features));
  return {
    label: emergency ? "distress_swipe" : "normal_interaction",
    confidence: emergency ? 0.91 : 0.24,
    emergency,
  };
}
