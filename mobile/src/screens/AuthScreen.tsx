import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { getErrorMessage } from "../utils/errorMessage";

export function AuthScreen() {
  const { login, signup } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("demo@safeher.app");
  const [password, setPassword] = useState("password123");
  const [phoneNumber, setPhoneNumber] = useState("+919999999999");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      if (isSignup) {
        await signup(fullName || "SafeHer User", email, password, phoneNumber);
        return;
      }
      await login(email, password);
    } catch (err: any) {
      setError(getErrorMessage(err, "Authentication failed. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>Women Safety Prototype</Text>
        </View>
        <Text style={styles.title}>SafeHer</Text>
        <Text style={styles.subtitle}>Gesture-driven emergency safety with on-device ML and federated learning.</Text>
      </View>
      <View style={styles.formCard}>
        {isSignup ? (
          <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={colors.subtext} value={fullName} onChangeText={setFullName} />
        ) : null}
        <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.subtext} value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="Password" placeholderTextColor={colors.subtext} value={password} secureTextEntry onChangeText={setPassword} />
        {isSignup ? (
          <TextInput style={styles.input} placeholder="Phone number" placeholderTextColor={colors.subtext} value={phoneNumber} onChangeText={setPhoneNumber} />
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.text} /> : <Text style={styles.buttonText}>{isSignup ? "Create Account" : "Login"}</Text>}
        </Pressable>
        <Pressable onPress={() => setIsSignup((value) => !value)}>
          <Text style={styles.switchText}>{isSignup ? "Already have an account? Login" : "New user? Signup"}</Text>
        </Pressable>
        {!isSignup ? <Text style={styles.demoText}>Demo user: demo@safeher.app / password123</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.background,
  },
  heroCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
  },
  heroBadgeText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 12,
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.subtext,
    marginTop: 8,
    lineHeight: 21,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    color: colors.text,
    backgroundColor: colors.card,
    marginBottom: 12,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 14,
    marginTop: 4,
    minHeight: 54,
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.text,
    fontWeight: "700",
    textAlign: "center",
  },
  switchText: {
    color: colors.subtext,
    marginTop: 16,
    textAlign: "center",
  },
  errorText: {
    color: "#fca5a5",
    marginBottom: 8,
  },
  demoText: {
    color: colors.subtext,
    marginTop: 16,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
  },
});
