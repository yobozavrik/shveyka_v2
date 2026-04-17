'use client';

import clsx from 'clsx';
import type { CSSProperties, ReactNode } from 'react';

type WrapperProps = {
  children: ReactNode;
  dir?: 'row' | 'column';
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
  margin?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  wrap?: boolean;
  fullWidth?: boolean;
  grow?: boolean;
  shrink?: boolean;
  basis?: string;
  position?: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';
  as?: 'div' | 'section' | 'article' | 'header' | 'footer' | 'main' | 'aside';
};

const gapMap = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
} as const;

const paddingMap = {
  none: 'p-0',
  xs: 'p-1',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
} as const;

const marginMap = {
  none: 'm-0',
  xs: 'm-1',
  sm: 'm-2',
  md: 'm-4',
  lg: 'm-6',
} as const;

const alignMap = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
} as const;

const justifyMap = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
} as const;

export default function Wrapper({
  children,
  dir = 'column',
  gap = 'none',
  padding = 'none',
  margin = 'none',
  align = 'stretch',
  justify = 'start',
  wrap = false,
  fullWidth = false,
  grow = false,
  shrink = false,
  basis,
  position = 'static',
  as: Comp = 'div',
}: WrapperProps) {
  const style = basis ? ({ flexBasis: basis } as CSSProperties) : undefined;

  return (
    <Comp
      className={clsx(
        position,
        dir === 'row' ? 'flex flex-row' : 'flex flex-col',
        gapMap[gap],
        paddingMap[padding],
        marginMap[margin],
        alignMap[align],
        justifyMap[justify],
        wrap && 'flex-wrap',
        fullWidth && 'w-full',
        grow && 'grow',
        shrink && 'shrink',
      )}
      style={style}
    >
      {children}
    </Comp>
  );
}
