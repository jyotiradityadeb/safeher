import axios from "axios";
import Constants from "expo-constants";

function resolveApiBaseUrl() {
  const explicit = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (explicit) {
    return explicit;
  }

  const hostUri =
    (Constants.expoConfig as any)?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any)?.manifest?.debuggerHost;

  if (hostUri && typeof hostUri === "string") {
    const host = hostUri.split(":")[0];
    if (host) {
      return `http://${host}:8000/api`;
    }
  }

  return "http://127.0.0.1:8000/api";
}

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 15000,
});

// LocalTunnel shows an anti-abuse interstitial unless this header is present.
// Add it automatically when API base uses *.loca.lt so mobile API calls are not blocked.
if (api.defaults.baseURL?.includes(".loca.lt")) {
  api.defaults.headers.common["bypass-tunnel-reminder"] = "true";
}

export const setAccessToken = (token?: string) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};
