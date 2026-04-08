import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";

import { api, setAccessToken } from "../api/client";

type User = {
  id: string;
  email: string;
  full_name: string;
  phone_number: string;
};

type AuthContextValue = {
  token?: string;
  user?: User;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (fullName: string, email: string, password: string, phoneNumber: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [token, setToken] = useState<string>();
  const [user, setUser] = useState<User>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const savedToken = await SecureStore.getItemAsync("safeher_token");
      const savedUser = await SecureStore.getItemAsync("safeher_user");
      if (savedToken) {
        setAccessToken(savedToken);
        try {
          const { data } = await api.get("/me");
          setToken(savedToken);
          setUser(data);
          await SecureStore.setItemAsync("safeher_user", JSON.stringify(data));
        } catch {
          setAccessToken(undefined);
          await SecureStore.deleteItemAsync("safeher_token");
          await SecureStore.deleteItemAsync("safeher_user");
        }
      } else if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      setLoading(false);
    };
    bootstrap();
  }, []);

  const persistSession = async (nextToken: string, nextUser: User) => {
    setToken(nextToken);
    setUser(nextUser);
    setAccessToken(nextToken);
    await SecureStore.setItemAsync("safeher_token", nextToken);
    await SecureStore.setItemAsync("safeher_user", JSON.stringify(nextUser));
  };

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    await persistSession(data.access_token, data.user);
  };

  const signup = async (fullName: string, email: string, password: string, phoneNumber: string) => {
    const { data } = await api.post("/auth/signup", {
      full_name: fullName,
      email,
      password,
      phone_number: phoneNumber,
    });
    await persistSession(data.access_token, data.user);
  };

  const logout = async () => {
    setToken(undefined);
    setUser(undefined);
    setAccessToken(undefined);
    await SecureStore.deleteItemAsync("safeher_token");
    await SecureStore.deleteItemAsync("safeher_user");
  };

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      login,
      signup,
      logout,
    }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
