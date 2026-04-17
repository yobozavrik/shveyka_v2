'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Scissors, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/mobile/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_number: employeeNumber, pin, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('SERVER ERROR RESPONSE:', { status: res.status, ok: res.ok, data });
        setError(data?.error || `Сервер повернув помилку (${res.status})`);
        return;
      }

      router.push('/tasks');
      router.refresh();
    } catch {
      setError('Немає з’єднання із сервером');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-base)] px-6 py-12">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-600 shadow-2xl shadow-emerald-600/30">
          <Scissors className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-1)]">Швейка MES</h1>
        <p className="mt-1.5 text-sm text-[var(--text-2)]">Виробничий цех</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-400">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Табельний №"
              autoComplete="username"
              required
              value={employeeNumber}
              onChange={(e) => setEmployeeNumber(e.target.value)}
              className="w-full rounded-2xl border-2 border-[var(--border)] bg-[var(--bg-card)] px-5 py-4 text-lg font-mono font-semibold text-[var(--text-1)] outline-none transition-colors placeholder:text-[var(--text-3)] focus:border-emerald-500"
            />
          </div>
          <div className="relative">
            <input
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              autoComplete="current-password"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full rounded-2xl border-2 border-[var(--border)] bg-[var(--bg-card)] px-5 py-4 text-lg font-mono font-semibold text-[var(--text-1)] outline-none transition-colors placeholder:text-[var(--text-3)] focus:border-emerald-500"
            />
          </div>
          <div className="relative">
            <input
              type="password"
              placeholder="Пароль"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border-2 border-[var(--border)] bg-[var(--bg-card)] px-5 py-4 text-lg font-semibold text-[var(--text-1)] outline-none transition-colors placeholder:text-[var(--text-3)] focus:border-emerald-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl bg-emerald-600 py-5 text-lg font-bold text-white shadow-xl shadow-emerald-600/25 transition-all active:scale-[0.98] active:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Увійти в цех'}
        </button>
      </form>

      <p className="mt-8 text-center text-xs text-slate-700">Швейка MES · Виробничий модуль</p>
    </div>
  );
}
