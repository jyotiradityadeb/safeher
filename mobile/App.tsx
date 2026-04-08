import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from "react";
import { AppState } from "react-native";

import { AppNavigator } from "./src/navigation/AppNavigator";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { registerPushToken } from "./src/services/pushService";
import {
  processPendingCheckInEscalation,
  refreshPendingCheckInFromServer,
} from "./src/services/smartCheckInMonitor";
import { startBatteryFallbackMonitor } from "./src/services/batteryFallback";

const ENABLE_PUSH_REGISTRATION =
  process.env.EXPO_PUBLIC_ENABLE_PUSH_REGISTRATION === "true";

function BootstrapEffects() {
  const { token } = useAuth();

  useEffect(() => {
    if (token && ENABLE_PUSH_REGISTRATION) {
      registerPushToken().catch(() => undefined);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const sync = async () => {
      await refreshPendingCheckInFromServer();
      await processPendingCheckInEscalation();
    };

    sync().catch(() => undefined);
    const timer = setInterval(() => {
      sync().catch(() => undefined);
    }, 20000);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" || state === "background") {
        sync().catch(() => undefined);
      }
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    const stop = startBatteryFallbackMonitor();
    return stop;
  }, [token]);

  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <BootstrapEffects />
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
