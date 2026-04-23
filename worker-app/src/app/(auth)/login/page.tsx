'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useActivityLogger } from '@/hooks/useActivityLogger';

export default function LoginPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const logger = useActivityLogger();

  const [mounted, setMounted] = useState(false);
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/mobile/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_number: employeeNumber,
          pin,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        logger.log('login_fail', { input_data: { employee_number: employeeNumber } });
        throw new Error(data.error || 'Помилка авторизації');
      }

      logger.log('login_success', { input_data: { employee_number: employeeNumber } });
      router.push('/tasks');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося увійти');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-surface text-on-surface">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-[0.03]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 2px 2px, rgba(0,105,72,1) 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="fixed right-0 top-0 z-50 p-6">
        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-high text-on-surface-variant transition-all active:scale-95"
          aria-label="Перемкнути тему"
        >
          <span className="material-symbols-outlined">
            {mounted && resolvedTheme === 'dark' ? 'dark_mode' : 'light_mode'}
          </span>
        </button>
      </div>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-md flex-col items-center">
          <div className="mb-12 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#059669] shadow-lg shadow-[#059669]/20">
              <span className="material-symbols-outlined filled text-4xl text-white">
                content_cut
              </span>
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter text-primary">
              МЕС ЦЕХ
            </h1>
          </div>

          <form onSubmit={handleLogin} className="w-full space-y-6">
            <div className="space-y-2">
              <label className="ml-1 block text-sm font-bold uppercase tracking-tight text-on-surface-variant">
                Номер працівника
              </label>
              <input
                type="text"
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                placeholder="Введіть ваш ID"
                className="h-[52px] w-full rounded-xl border-none bg-surface-container-high px-4 text-on-surface transition-all placeholder:text-on-surface-variant/50 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/40"
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="ml-1 block text-sm font-bold uppercase tracking-tight text-on-surface-variant">
                PIN
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  inputMode="numeric"
                  placeholder="••••"
                  className="h-[52px] w-full rounded-xl border-none bg-surface-container-high px-4 pr-12 text-on-surface transition-all placeholder:text-on-surface-variant/50 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/40"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPin((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors hover:text-primary"
                  aria-label={showPin ? 'Сховати PIN' : 'Показати PIN'}
                >
                  <span className="material-symbols-outlined">visibility</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="ml-1 block text-sm font-bold uppercase tracking-tight text-on-surface-variant">
                Пароль
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ваш пароль"
                  className="h-[52px] w-full rounded-xl border-none bg-surface-container-high px-4 pr-12 text-on-surface transition-all placeholder:text-on-surface-variant/50 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/40"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors hover:text-primary"
                  aria-label={showPassword ? 'Сховати пароль' : 'Показати пароль'}
                >
                  <span className="material-symbols-outlined">visibility</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm font-bold text-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-white shadow-xl shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin">sync</span>
              ) : (
                <>
                  <span>Увійти</span>
                  <span className="material-symbols-outlined">login</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-12 text-center">
            <span className="text-sm font-medium uppercase tracking-widest text-outline opacity-60">
              Версія 1.0
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
