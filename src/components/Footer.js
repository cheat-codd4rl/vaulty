'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="foot" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-faint)', fontSize: '13px' }}>
      <div className="wrap">
        <p style={{ margin: '0 0 8px 0' }}>Vaulty &copy; {new Date().getFullYear()}</p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <Link href="/terms" style={{ color: 'inherit', textDecoration: 'underline' }}>
            Terms of Service
          </Link>
          <Link href="/privacy" style={{ color: 'inherit', textDecoration: 'underline' }}>
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
