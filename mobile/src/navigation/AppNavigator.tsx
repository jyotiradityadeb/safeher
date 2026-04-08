import React from "react";
import { ActivityIndicator, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../context/AuthContext";
import { AlertHistoryScreen } from "../screens/AlertHistoryScreen";
import { AuthScreen } from "../screens/AuthScreen";
import { ContactsScreen } from "../screens/ContactsScreen";
import { GestureSetupScreen } from "../screens/GestureSetupScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { LiveStatusScreen } from "../screens/LiveStatusScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { colors } from "../theme/colors";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Contacts" component={ContactsScreen} />
      <Tab.Screen name="Gesture" component={GestureSetupScreen} />
      <Tab.Screen name="Status" component={LiveStatusScreen} />
      <Tab.Screen name="History" component={AlertHistoryScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {token ? <Stack.Screen name="Main" component={MainTabs} /> : <Stack.Screen name="Auth" component={AuthScreen} />}
    </Stack.Navigator>
  );
}
