import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@splice/domain';
import { db } from '../../persistence/db.js';

export interface AuthContextValue {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  needsSetup: boolean;
  allUsers: User[];
  login: (userId: string, pin: string) => Promise<boolean>;
  logout: () => void;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_KEY = 'splice-app-session-user-id';

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const refreshUsers = useCallback(async () => {
    const users = await db.users.toArray();
    setAllUsers(users);
    setNeedsSetup(users.length === 0);
  }, []);

  // Restore session on mount
  useEffect(() => {
    async function restore() {
      try {
        const users = await db.users.toArray();
        setAllUsers(users);

        if (users.length === 0) {
          setNeedsSetup(true);
          setIsLoading(false);
          return;
        }

        const savedId = localStorage.getItem(SESSION_KEY);
        if (savedId) {
          const user = await db.users.get(savedId);
          if (user) {
            setCurrentUser(user);
          }
        }
      } catch {
        // IndexedDB may fail in some contexts; proceed unauthenticated
      }
      setIsLoading(false);
    }
    restore();
  }, []);

  const login = useCallback(async (userId: string, pin: string): Promise<boolean> => {
    const user = await db.users.get(userId);
    if (!user) return false;

    const pinHashed = await hashPin(pin);
    if (pinHashed !== user.pinHash) return false;

    setCurrentUser(user);
    localStorage.setItem(SESSION_KEY, user.id);
    return true;
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  const value: AuthContextValue = {
    currentUser,
    isAuthenticated: currentUser !== null,
    isLoading,
    needsSetup,
    allUsers,
    login,
    logout,
    refreshUsers,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
