export default function Footer() {
  return (
    <footer style={{
      backgroundColor: 'var(--card, #ffffff)',
      borderTop: '1px solid var(--border, #e5e7eb)',
      padding: '8px 16px',
      fontSize: '12px',
      color: 'var(--muted-foreground, #6b7280)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          Data sourced from Hong Kong Transport Department
        </div>
        <div>
          &copy; {new Date().getFullYear()} MTC Parking Stations
        </div>
      </div>
    </footer>
  );
}
