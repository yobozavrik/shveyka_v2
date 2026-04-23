import type { Metadata, Viewport } from 'next';
import { Fira_Code, Fira_Sans, Geist } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const firaSans = Fira_Sans({
  variable: '--font-fira-sans',
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
});

const firaCode = Fira_Code({
  variable: '--font-fira-code',
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#020617',
};

export const metadata: Metadata = {
  title: 'MES Цех',
  description: 'Додаток для швачок та майстрів',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'MES Цех' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body className={`${firaSans.variable} ${firaCode.variable} font-sans min-h-screen antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
