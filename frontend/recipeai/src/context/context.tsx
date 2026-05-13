import {
  useCallback,
  useContext,
  useState,
  createContext,
  useEffect,
  useMemo,
} from "react";
import { apiClient } from "../lib/hooks";

/* eslint-disable react-refresh/only-export-components */

export interface UserPreferences {
  diet: string;
  diets?: string[];
  dislikedIngredients: string[];
}

export interface UserProps {
  email: string;
  id: number;
  role: string;
  subscriptionPlan?: string;
  recipeCreationLimit?: number;
  recipesCreated?: number;
  recipesRemaining?: number | null;
  recipeCreationLimitReached?: boolean;
  preferences?: UserPreferences;
}

export interface AuthContextType {
  user: UserProps | null;
  setUser: React.Dispatch<React.SetStateAction<UserProps | null>>;
  loading: boolean;
  isAdmin: boolean;
  getUserPreferences: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const getErrorStatus = (error: unknown): number | undefined => {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }

  return undefined;
};

const hasContentTypeError = (error: unknown): boolean => {
  return Boolean(
    error &&
    typeof error === "object" &&
    "isContentTypeError" in error &&
    (error as { isContentTypeError?: unknown }).isContentTypeError,
  );
};

const defaultAuthContext: AuthContextType = {
  user: null,
  setUser: () => {
    // no-op default for safe context fallback during HMR/provider mismatch
  },
  loading: true,
  isAdmin: false,
  getUserPreferences: async () => {
    // no-op default for safe context fallback during HMR/provider mismatch
  },
  refreshSession: async () => false,
  logout: async () => {
    // no-op default for safe context fallback during HMR/provider mismatch
  },
};

export const AuthContext = createContext<AuthContextType>(defaultAuthContext);

export const useUser = () => useContext(AuthContext) || defaultAuthContext;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProps | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === "ADMIN" || false;

  const clearAuthState = useCallback(() => {
    localStorage.removeItem("isLoggedIn");
    setUser(null);
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const userData = await apiClient<UserProps>("me");
      setUser(userData);
      localStorage.setItem("isLoggedIn", "true");
      return true;
    } catch (error: unknown) {
      if (getErrorStatus(error) === 401) {
        try {
          await apiClient("refresh", true);
          const userData = await apiClient<UserProps>("me");
          setUser(userData);
          localStorage.setItem("isLoggedIn", "true");
          return true;
        } catch {
          clearAuthState();
          return false;
        }
      }

      clearAuthState();
      return false;
    }
  }, [clearAuthState]);

  const logout = useCallback(async () => {
    try {
      await apiClient("logout", true);
    } catch {
      // Ignore logout endpoint failures and clear client auth state anyway.
    } finally {
      clearAuthState();
    }
  }, [clearAuthState]);

  const getUserPreferences = useCallback(async () => {
    if (!user) return;
    try {
      const response = await apiClient<UserPreferences>("user/getPreferences");
      if (response) {
        setUser((prevUser) =>
          prevUser
            ? {
                ...prevUser,
                preferences: response,
              }
            : null,
        );
      }
    } catch (error: unknown) {
      const isExpectedAuthIssue =
        getErrorStatus(error) === 400 ||
        getErrorStatus(error) === 401 ||
        hasContentTypeError(error);

      if (!isExpectedAuthIssue) {
        console.error("Failed to fetch user preferences:", error);
      }
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const initializeSession = async () => {
      await refreshSession();
      if (isMounted) {
        setLoading(false);
      }
    };

    initializeSession();

    const onSessionExpired = () => clearAuthState();
    window.addEventListener("auth:session-expired", onSessionExpired);

    return () => {
      isMounted = false;
      window.removeEventListener("auth:session-expired", onSessionExpired);
    };
  }, [clearAuthState, refreshSession]);

  const authContextValue = useMemo(
    () => ({
      user,
      setUser,
      loading,
      isAdmin,
      getUserPreferences,
      refreshSession,
      logout,
    }),
    [user, loading, isAdmin, getUserPreferences, refreshSession, logout],
  );

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};
