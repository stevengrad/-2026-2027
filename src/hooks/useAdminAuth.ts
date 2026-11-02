import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

export interface AdminAuthState {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAdminAuth(): AdminAuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkAdminStatus = useCallback(async (currentUser: User | null) => {
    if (!supabase || !currentUser) {
      setUser(null);
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }
    try {
      const { data, error: rpcErr } = await supabase.rpc('is_admin');
      if (rpcErr || data !== true) {
        setIsAdmin(false);
      } else {
        setIsAdmin(true);
      }
      setUser(currentUser);
    } catch {
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      checkAdminStatus(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      checkAdminStatus(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkAdminStatus]);

  const login = async (email: string, pass: string) => {
    if (!supabase) return { success: false, error: 'الاتصال بقاعدة البيانات غير متاح.' };
    setError(null);
    setIsLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });

      if (authError) {
        const msg = authError.message.includes('Invalid login credentials')
          ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
          : authError.message;
        setError(msg);
        setIsLoading(false);
        return { success: false, error: msg };
      }

      if (!data.user) {
        setError('تعذّر تسجيل الدخول.');
        setIsLoading(false);
        return { success: false, error: 'تعذّر تسجيل الدخول.' };
      }

      const { data: adminCheck } = await supabase.rpc('is_admin');
      if (adminCheck !== true) {
        await supabase.auth.signOut();
        const msg = 'هذا الحساب ليس لديه صلاحيات الإدارة.';
        setError(msg);
        setIsAdmin(false);
        setUser(null);
        setIsLoading(false);
        return { success: false, error: msg };
      }

      setUser(data.user);
      setIsAdmin(true);
      setIsLoading(false);
      return { success: true };
    } catch {
      const msg = 'حدث خطأ غير متوقع أثناء تسجيل الدخول.';
      setError(msg);
      setIsLoading(false);
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    if (!supabase) return;
    setIsLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setIsLoading(false);
  };

  const refresh = async () => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    await checkAdminStatus(session?.user ?? null);
  };

  return { user, isAdmin, isLoading, error, login, logout, refresh };
}
