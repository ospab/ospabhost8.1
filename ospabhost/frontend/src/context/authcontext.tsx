// /src/context/authcontext.tsx
import { createContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import apiClient from '../utils/apiClient';
import type { UserData } from '../pages/dashboard/types';

interface AuthContextType {
  isLoggedIn: boolean;
  isInitialized: boolean;
  userData: UserData | null;
  setUserData: (data: UserData | null) => void;
  login: (token: string) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

// Создаем контекст с начальными значениями
const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  isInitialized: false,
  userData: null,
  setUserData: () => {},
  login: () => {},
  logout: () => {},
  refreshUser: async () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

// Создаем провайдер, который будет управлять состоянием
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const manualLogoutRef = useRef(false);

  const bootstrapSession = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setIsLoggedIn(false);
      setUserData(null);
      setIsInitialized(true);
      return;
    }

    try {
      const response = await apiClient.get('/api/auth/me');
      const fetchedUser: UserData['user'] = response.data.user;
      setUserData({
        user: fetchedUser,
        balance: fetchedUser.balance ?? 0,
        tickets: fetchedUser.tickets ?? [],
      });
      setIsLoggedIn(true);
    } catch (error) {
      console.warn('[Auth] bootstrap failed, clearing token', error);
      localStorage.removeItem('access_token');
      setIsLoggedIn(false);
      setUserData(null);
    } finally {
      setIsInitialized(true);
    }
  };

  useEffect(() => {
    bootstrapSession();

    // Слушаем событие unauthorized из apiClient
    const handleUnauthorized = () => {
      if (manualLogoutRef.current) {
        manualLogoutRef.current = false;
        return;
      }

      setIsLoggedIn(false);
      setUserData(null);
      window.location.href = '/login';
    };
    
    window.addEventListener('unauthorized', handleUnauthorized);
    
    return () => {
      window.removeEventListener('unauthorized', handleUnauthorized);
    };
  }, []);

  const login = (token: string) => {
    localStorage.setItem('access_token', token);
    // После установки токена немедленно валидируем пользователя
    bootstrapSession();
  };

  const logout = () => {
    manualLogoutRef.current = true;
    localStorage.removeItem('access_token');
    sessionStorage.clear();
    setIsLoggedIn(false);
    setUserData(null);

    window.setTimeout(() => {
      manualLogoutRef.current = false;
    }, 1500);
  };

  const refreshUser = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      logout();
      return;
    }

    try {
      const response = await apiClient.get('/api/auth/me');
      const fetchedUser: UserData['user'] = response.data.user;
      setUserData({
        user: fetchedUser,
        balance: fetchedUser.balance ?? 0,
        tickets: fetchedUser.tickets ?? [],
      });
      setIsLoggedIn(true);
    } catch (error) {
      console.error('[Auth] refreshUser failed', error);
      logout();
    }
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, isInitialized, userData, setUserData, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;