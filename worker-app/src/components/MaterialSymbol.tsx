'use client';

import clsx from 'clsx';

type MaterialSymbolProps = {
  name: string;
  tone?: 'neutral' | 'primary' | 'emerald' | 'blue' | 'indigo' | 'amber' | 'red' | 'violet' | 'orange';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  filled?: boolean;
  spin?: boolean;
  block?: boolean;
};

const toneMap = {
  neutral: 'text-[var(--text-2)]',
  primary: 'text-primary',
  emerald: 'text-emerald-500',
  blue: 'text-blue-500',
  indigo: 'text-indigo-500',
  amber: 'text-amber-500',
  red: 'text-red-500',
  violet: 'text-violet-500',
  orange: 'text-orange-500',
} as const;

const sizeMap = {
  sm: 'text-[16px]',
  md: 'text-[20px]',
  lg: 'text-[28px]',
  xl: 'text-[40px]',
} as const;

export default function MaterialSymbol({
  name,
  tone = 'neutral',
  size = 'md',
  filled = false,
  spin = false,
  block = false,
}: MaterialSymbolProps) {
  return (
    <span
      className={clsx(
        'material-symbols-outlined',
        toneMap[tone],
        sizeMap[size],
        spin && 'animate-spin',
        block && 'block',
      )}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}
