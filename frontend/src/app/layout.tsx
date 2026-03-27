import type { Metadata } from 'next';
import { Montserrat, Poppins, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Toaster } from '@/components/ui/sonner';
import { QueryProvider } from '@/lib/query-provider';
import { AuthProvider } from '@/lib/auth-provider';
import { PwaProvider } from '@/components/shared/pwa-provider';
import { OfflineBanner } from '@/components/shared/offline-banner';
import './globals.css';

// Montserrat — tipografía principal del cuerpo
const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

// Poppins — tipografía de encabezados y títulos (300 para el logo)
const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

// Geist Mono — tipografía monoespaciada (códigos, importes tabulares)
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TQ Metales — Gestión',
  description: 'Sistema de gestión para TQ Metales Preciosos',
  // PWA / mobile
  applicationName: 'TQ Metales',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TQ Metales',
  },
  formatDetection: { telephone: false },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${montserrat.variable} ${poppins.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <NuqsAdapter>
            <QueryProvider>
              <AuthProvider>
                {children}
                <Toaster richColors position="top-right" />
                <OfflineBanner />
                <PwaProvider />
              </AuthProvider>
            </QueryProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  );
}
