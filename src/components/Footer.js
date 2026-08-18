'use client';

export default function Footer() {
  return (
    <footer className="foot" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-faint)', fontSize: '13px' }}>
      <div className="wrap">
        <p>Vaulty &copy; {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}
