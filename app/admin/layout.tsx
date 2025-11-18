import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Console - MTC Parking Stations',
  description: 'Administrative dashboard for parking data monitoring and analysis',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--background)',
      color: 'var(--foreground)',
    }}>
      {children}
    </div>
  );
}
