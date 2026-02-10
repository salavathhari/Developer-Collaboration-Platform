import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import * as authService from "../services/authService";
import type { SignupPayload } from "../services/authService";
import type { User } from "../types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await authService.getProfile();
      setUser(profile);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const hasSession = localStorage.getItem("hasSession"); // Check if we expect a session

    const bootstrap = async () => {
      // If no token and no session flag, we are likely a guest. Don't try to refresh.
      if (!token && !hasSession) {
        setLoading(false);
        return;
      }

      if (!token) {
        try {
          const refresh = await authService.refreshAccessToken();
          localStorage.setItem("token", refresh.accessToken);
          await refreshProfile();
        } catch {
          setUser(null);
          // If refresh fails, clear the session flag so we don't try again until login
          localStorage.removeItem("hasSession");
        } finally {
          setLoading(false);
        }
        return;
      }

      refreshProfile().finally(() => setLoading(false));
    };

    bootstrap();
  }, [refreshProfile]);

  const handleAuthSuccess = (data: authService.AuthResponse) => {
    localStorage.setItem("token", data.accessToken);
    localStorage.setItem("hasSession", "true"); // Set session flag
    setUser(data.user);
  };

  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean = false) => {
      const data = await authService.login(email, password, rememberMe);
      handleAuthSuccess(data);
    },
    []
  );

  const signup = useCallback(async (payload: SignupPayload) => {
    await authService.register(payload);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("hasSession"); // Clear session flag
    authService.logout().catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, signup, logout, refreshProfile }),
    [user, loading, login, signup, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
