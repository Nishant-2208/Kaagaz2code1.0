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
    async function restoreSession() {
      const tokens =
        getStoredTokens();

      if (!tokens) {
        setIsLoading(false);
        return;
      }

      const cachedUser =
        getStoredUser();

      if (cachedUser) {
        setUser(cachedUser);
      }

      try {
        const freshUser =
          await getCurrentUser();

        setUser(freshUser);

        storeUser(freshUser);
      } catch {
        // Keep cached user during prototype development.
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
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