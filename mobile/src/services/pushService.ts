import Constants from "expo-constants";

import { api } from "../api/client";

export async function registerPushToken() {
  if (Constants.executionEnvironment === "storeClient") {
    return null;
  }

  const Notifications = await import("expo-notifications");

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  const permissions = await Notifications.getPermissionsAsync();
  let status = permissions.status;
  if (status !== "granted") {
    const request = await Notifications.requestPermissionsAsync();
    status = request.status;
  }

  if (status !== "granted") {
    return null;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  });

  await api.post("/devices", {
    token: tokenResponse.data,
    platform: "android",
    provider: "expo",
  });

  return tokenResponse.data;
}
