import type { Metadata } from 'next';
import './globals.css';
import AppHeader from '@/components/app-header';
import Footer from '@/components/footer';
import { ThemeProvider } from '@/components/theme-provider';

export const metadata: Metadata = {
  title: 'MTC Parking Stations',
  description: 'Hong Kong car park availability - Real-time parking vacancy data',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ height: '100%', overflow: 'hidden' }}>
      <body style={{
        height: '100%',
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        WebkitFontSmoothing: 'antialiased',
        overflow: 'hidden'
      }}>
        <ThemeProvider>
          <AppHeader />
          <main style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {children}
          </main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
