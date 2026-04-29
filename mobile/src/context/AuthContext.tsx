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

const ACCESS_TOKEN_KEY = "safeher_token";
const REFRESH_TOKEN_KEY = "safeher_refresh_token";
const USER_KEY = "safeher_user";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [token, setToken] = useState<string>();
  const [user, setUser] = useState<User>();
  const [loading, setLoading] = useState(true);

  const clearSession = async () => {
    setToken(undefined);
    setUser(undefined);
    setAccessToken(undefined);
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  };

  const persistSession = async (nextToken: string, nextUser: User, nextRefreshToken?: string) => {
    setToken(nextToken);
    setUser(nextUser);
    setAccessToken(nextToken);
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, nextToken);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser));
    if (nextRefreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, nextRefreshToken);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      const savedToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      const savedUser = await SecureStore.getItemAsync(USER_KEY);
      const savedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

      if (!savedToken) {
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
        setLoading(false);
        return;
      }

      setAccessToken(savedToken);
      try {
        const { data } = await api.get("/me");
        await persistSession(savedToken, data);
      } catch {
        if (savedRefreshToken) {
          try {
            const refreshed = await api.post("/auth/refresh", { refresh_token: savedRefreshToken });
            await persistSession(
              refreshed.data.access_token,
              refreshed.data.user,
              refreshed.data.refresh_token
            );
          } catch {
            await clearSession();
          }
        } else {
          await clearSession();
        }
      }
      setLoading(false);
    };
    bootstrap();
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    await persistSession(data.access_token, data.user, data.refresh_token);
  };

  const signup = async (fullName: string, email: string, password: string, phoneNumber: string) => {
    const { data } = await api.post("/auth/signup", {
      full_name: fullName,
      email,
      password,
      phone_number: phoneNumber,
    });
    await persistSession(data.access_token, data.user, data.refresh_token);
  };

  const logout = async () => {
    await clearSession();
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
