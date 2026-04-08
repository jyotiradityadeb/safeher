import { useRef, useState } from "react";
import { GestureResponderEvent, PanResponder } from "react-native";

import { createEmergencyAlert } from "../services/alertService";
import { runGestureInference } from "../services/tfliteService";
import { extractGestureFeatures, GestureFeatures, GesturePoint } from "../utils/gesture";

type EmergencyDetection = {
  label: string;
  confidence: number;
};

type UseGestureRecorderOptions = {
  onEmergencyDetected?: (payload: {
    features: GestureFeatures;
    detection: EmergencyDetection;
  }) => Promise<void> | void;
};

export function useGestureRecorder(options: UseGestureRecorderOptions = {}) {
  const pointsRef = useRef<GesturePoint[]>([]);
  const [status, setStatus] = useState("Safe");
  const [lastResult, setLastResult] = useState<any>(null);

  const recordPoint = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    pointsRef.current.push({ x: locationX, y: locationY, t: Date.now() });
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: recordPoint,
    onPanResponderMove: recordPoint,
    onPanResponderRelease: async () => {
      try {
        const features = extractGestureFeatures(pointsRef.current);
        const result = await runGestureInference(features);
        setLastResult(result);
        if (result.emergency) {
          if (options.onEmergencyDetected) {
            setStatus("Verify and Send");
            await options.onEmergencyDetected({
              features,
              detection: {
                label: result.label,
                confidence: result.confidence,
              },
            });
          } else {
            setStatus("Alert Triggered");
            const alert = await createEmergencyAlert(result.label, result.confidence, features);
            if (alert?.sms_launch?.opened) {
              setStatus("Alert Triggered (SMS Draft Ready)");
            }
            setLastResult((previous: any) => ({ ...previous, alert }));
            (globalThis as any).__SAFEHER_LAST_ALERT__ = alert;
          }
        } else {
          setStatus("Safe");
        }
      } catch (error: any) {
        setStatus("Demo Mode Active");
        setLastResult({
          label: "prototype_fallback",
          confidence: "-",
          error: error?.message || "Gesture processing failed.",
        });
      }
      pointsRef.current = [];
    },
  });

  return { panResponder, status, lastResult };
}
