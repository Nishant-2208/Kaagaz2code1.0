import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { ReactNode } from 'react';

import type {
  User,
  UserRole,
} from '../api/types';

import {
  login as loginRequest,
  exchangeGoogleCode,
  logout as logoutRequest,
  getCurrentUser,
  getStoredTokens,
  getStoredUser,
  storeTokens,
  storeUser,
  clearTokens,
} from '../api/services';


interface AuthContextValue {
  user: User | null;

  isAuthenticated: boolean;

  isLoading: boolean;

  login: (
    email: string,
    password: string,
  ) => Promise<User>;

  completeGoogleLogin: (
    code: string,
  ) => Promise<User>;

  logout: () => void;

  hasRole: (
    ...roles: UserRole[]
  ) => boolean;
}


const AuthContext =
  createContext<
    AuthContextValue | undefined
  >(undefined);


export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] =
    useState<User | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);


  // =======================================================
  // RESTORE SESSION
  // =======================================================

  useEffect(() => {
    // React StrictMode runs effects twice in development. The first
    // invocation is cancelled by cleanup; the second invocation continues
    // and is responsible for completing session restoration.
    let cancelled = false;

    async function restoreSession() {
      const tokens = getStoredTokens();

      if (!tokens) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      const cachedUser = getStoredUser();

      // Render the cached identity immediately while /auth/me confirms it.
      // This prevents navigation/reload flashes and keeps the workspace
      // mounted while the backend session is being verified.
      if (cachedUser && !cancelled) {
        setUser(cachedUser);
      }

      try {
        const freshUser = await getCurrentUser();

        if (cancelled) return;

        setUser(freshUser);
        storeUser(freshUser);
      } catch {
        if (cancelled) return;

        // Only discard the session when the backend actually rejected it.
        // A temporary network/backend restart should not destroy the local
        // session during a browser reload.
        const stillStored = getStoredTokens();

        if (!stillStored) {
          setUser(null);
        } else if (!cachedUser) {
          clearTokens();
          setUser(null);
        } else {
          setUser(cachedUser);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);


  // =======================================================
  // NORMAL LOGIN
  // =======================================================

  const login =
    useCallback(
      async (
        email: string,
        password: string,
      ): Promise<User> => {

        const response =
          await loginRequest({
            email,
            password,
          });

        storeTokens({
          accessToken:
            response.accessToken,

          refreshToken:
            response.refreshToken,
        });

        storeUser(
          response.user,
        );

        setUser(
          response.user,
        );

        return response.user;
      },
      [],
    );


  // =======================================================
  // GOOGLE LOGIN
  // =======================================================

  const completeGoogleLogin =
    useCallback(
      async (
        code: string,
      ): Promise<User> => {

        const response =
          await exchangeGoogleCode(
            code,
          );

        storeTokens({
          accessToken:
            response.accessToken,

          refreshToken:
            response.refreshToken,
        });

        storeUser(
          response.user,
        );

        setUser(
          response.user,
        );

        return response.user;
      },
      [],
    );

  // =======================================================
  // LOGOUT
  // =======================================================

  const logout =
    useCallback(() => {
      logoutRequest();

      setUser(null);
    }, []);


  // =======================================================
  // RBAC
  // =======================================================

  const hasRole =
    useCallback(
      (...roles: UserRole[]) =>
        !!user &&
        roles.includes(
          user.role,
        ),
      [user],
    );


  // =======================================================
  // CONTEXT VALUE
  // =======================================================

  const value =
    useMemo<AuthContextValue>(
      () => ({
        user,

        isAuthenticated:
          !!user,

        isLoading,

        login,

        completeGoogleLogin,

        logout,

        hasRole,
      }),

      [
        user,
        isLoading,
        login,
        completeGoogleLogin,
        logout,
        hasRole,
      ],
    );


  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth():
  AuthContextValue {
  const ctx =
    useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      'useAuth must be used within an AuthProvider.',
    );
  }

  return ctx;
}