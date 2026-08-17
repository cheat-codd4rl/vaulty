'use client';

import Link from 'next/link';

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
        <Link href="/host" className="btn btn-ghost btn-sm">
          Create event
        </Link>
      </div>
    </div>
  );
}
