'use client';

import { useState, useEffect, useCallback } from 'react';
import { User } from '@/types';
import { authApi } from '@/lib/api';
import { authClient } from '@/lib/auth';
import { useRouter } from 'next/navigation';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchMe = async () => {
      // If no token stored, skip the API call — user is not logged in
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await authApi.me();
        if (res.data.success) {
          setUser(res.data.data);
        }
      } catch {
        // Token is invalid or expired — clear it
        localStorage.removeItem('auth_token');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMe();
  }, []);

  const logout = useCallback(async () => {
    try {
      await authClient.signOut();
    } catch {
      // ignore sign-out errors
    } finally {
      localStorage.removeItem('auth_token');
      setUser(null);
      router.push('/login');
    }
  }, [router]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout,
  };
}
