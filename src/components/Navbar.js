'use client';

import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

export default function Navbar() {
  return (
    <div className="topnav">
      <Link href="/" className="brand" aria-label="Vaulty home">
        <img src="/vaulty-icon.png" alt="Vaulty icon" className="brand-logo-icon" />
        <span className="word">
          Vault<em>y</em>
        </span>
      </Link>
      <div className="navlinks">
        <ThemeToggle />
        <Link href="/host" className="btn btn-ghost btn-sm">
          Host dashboard
        </Link>
      </div>
    </div>
  );
}
