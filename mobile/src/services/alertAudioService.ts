import { api } from "../api/client";

let activeRecording: any = null;
let isRecording = false;

export async function captureAndUploadAlertAudio(alertId: string, seconds: number = 30): Promise<void> {
  if (!alertId || isRecording) {
    return;
  }

  try {
    const av = await import("expo-av");
    const { Audio } = av;
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    isRecording = true;
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    });
    const recording = new Audio.Recording();
    activeRecording = recording;
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();

    await new Promise((resolve) => setTimeout(resolve, Math.max(5, seconds) * 1000));

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    if (!uri) {
      return;
    }

    const form = new FormData();
    form.append("audio_file", {
      uri,
      name: `alert-${alertId}.m4a`,
      type: "audio/m4a",
    } as any);
    await api.post(`/alerts/${alertId}/evidence-audio`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  } catch {
    // Non-blocking: emergency alert should continue even if evidence upload fails.
  } finally {
    try {
      if (activeRecording) {
        await activeRecording.stopAndUnloadAsync();
      }
    } catch {
      // ignore cleanup errors
    }
    activeRecording = null;
    isRecording = false;
  }
}
