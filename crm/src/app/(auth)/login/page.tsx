'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Помилка входу');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-4">
      <div className="max-w-md w-full space-y-8 bg-[var(--bg-card)] p-10 rounded-2xl border border-[var(--border)] shadow-2xl">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/20">
            <LogIn className="h-8 w-8 text-[var(--text-1)]" />
          </div>
          <h2 className="text-3xl font-extrabold text-[var(--text-1)]">Швейка MES</h2>
          <p className="mt-2 text-sm text-[var(--text-2)]">Вхід в систему управління</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[var(--text-1)]">Логін</label>
              <input
                type="text"
                required
                className="mt-1 block w-full bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-1)] rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="Введіть ваш логін"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-1)]">Пароль</label>
              <input
                type="password"
                required
                className="mt-1 block w-full bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-1)] rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-[var(--text-1)] bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Увійти'}
          </button>
        </form>
      </div>
    </div>
  );
}
