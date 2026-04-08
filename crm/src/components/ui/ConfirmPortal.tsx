'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { registerConfirmHandler } from '@/lib/confirm';

type ModalState = {
  message: string;
  resolve: (value: boolean) => void;
} | null;

export function ConfirmPortal() {
  const [modal, setModal] = useState<ModalState>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    registerConfirmHandler((message, resolve) => {
      setModal({ message, resolve });
    });
  }, []);

  const handle = useCallback((value: boolean) => {
    setModal((prev) => {
      prev?.resolve(value);
      return null;
    });
  }, []);

  if (!mounted || !modal) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl">
        <p className="mb-6 text-sm font-semibold text-[var(--text-1)]">{modal.message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => handle(false)}
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-2.5 text-sm font-bold text-[var(--text-2)]"
          >
            Скасувати
          </button>
          <button
            onClick={() => handle(true)}
            className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white"
          >
            Підтвердити
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
