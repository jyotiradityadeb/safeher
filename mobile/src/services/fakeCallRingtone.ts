import { Vibration } from "react-native";

let activeRingtoneSound: any = null;
let activeVoiceSound: any = null;

const RINGTONE_URL =
  process.env.EXPO_PUBLIC_FAKE_CALL_RINGTONE_URL ||
  "https://www.myinstants.com/media/sounds/iphone_ringtone_trap_remixbigconverter.mp3";
const VOICE_URL = process.env.EXPO_PUBLIC_FAKE_CALL_VOICE_URL || "";

export async function startFakeCallRingtone(vibrationEnabled: boolean) {
  try {
    const av = await import("expo-av");
    const { Audio } = av;
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    const { sound } = await Audio.Sound.createAsync(
      { uri: RINGTONE_URL },
      { shouldPlay: true, isLooping: true, volume: 1.0 }
    );
    activeRingtoneSound = sound;
  } catch {
    // Fallback for environments where audio module is unavailable.
  }

  if (vibrationEnabled) {
    Vibration.vibrate([0, 350, 450], true);
  }
}

export async function stopFakeCallRingtone() {
  Vibration.cancel();
  if (!activeRingtoneSound) {
    return;
  }
  try {
    await activeRingtoneSound.stopAsync();
    await activeRingtoneSound.unloadAsync();
  } catch {
    // ignore stop errors
  } finally {
    activeRingtoneSound = null;
  }
}

export async function startFakeCallVoice() {
  if (!VOICE_URL) {
    return false;
  }

  try {
    const av = await import("expo-av");
    const { Audio } = av;
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: true,
    });
    const { sound } = await Audio.Sound.createAsync(
      { uri: VOICE_URL },
      { shouldPlay: true, isLooping: false, volume: 1.0 }
    );
    activeVoiceSound = sound;
    return true;
  } catch {
    return false;
  }
}

export async function stopFakeCallVoice() {
  if (!activeVoiceSound) {
    return;
  }
  try {
    await activeVoiceSound.stopAsync();
    await activeVoiceSound.unloadAsync();
  } catch {
    // ignore stop errors
  } finally {
    activeVoiceSound = null;
  }
}
