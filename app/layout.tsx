import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MTC Parking Vacancy API',
  description: 'Hong Kong Government car park vacancy data ingestion service',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
