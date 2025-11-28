import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { ReduxProvider } from '@/components/redux-provider';
import { FirebaseAuthProvider } from '@/components/auth';

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
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body style={{
        height: '100%',
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        WebkitFontSmoothing: 'antialiased',
        overflow: 'hidden'
      }}>
        <ReduxProvider>
          <ThemeProvider>
            <FirebaseAuthProvider>
              <main style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
              }}>
                {children}
              </main>
            </FirebaseAuthProvider>
          </ThemeProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
