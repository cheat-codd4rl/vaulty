'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import HostProfileMenu from '@/components/HostProfileMenu';
import GuestProfileMenu from '@/components/GuestProfileMenu';

export default function Navbar() {
  const pathname = usePathname();
  
  // Basic route sniffing: if it's a guest event page, use guest menu
  const isGuestRoute = pathname?.startsWith('/e/');
  
  // Extract eventId from /e/[id] for the guest menu
  const eventIdMatch = pathname?.match(/^\/e\/([^/]+)/);
  const eventId = eventIdMatch ? eventIdMatch[1] : null;

  return (
    <div className="topnav">
      <Link href="/" className="brand" aria-label="Vaulty home">
        <img src="/vaulty-dark-40.svg" alt="Vaulty icon" className="brand-logo-icon logo-dark" />
        <img src="/vaulty-light-40.svg" alt="Vaulty icon" className="brand-logo-icon logo-light" />
        <span className="word">
          Vault<em>y</em>
        </span>
      </Link>
      <div className="navlinks">
        {isGuestRoute && eventId ? (
          <GuestProfileMenu eventId={eventId} />
        ) : (
          <HostProfileMenu />
        )}
      </div>
    </div>
  );
}
