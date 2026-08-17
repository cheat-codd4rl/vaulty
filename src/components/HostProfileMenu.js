'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

export default function HostProfileMenu() {
  const router = useRouter();
  const [host, setHost] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const menuRef = useRef(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/host/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setHost(data);
          }
        }
      } catch (err) {
        // ignore
      }
      setLoading(false);
    }
    checkAuth();
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/host/logout', { method: 'POST' });
    setHost(null);
    setOpen(false);
    router.push('/');
  };

  if (loading) {
    return <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }}></div>;
  }

  if (!host) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <ThemeToggle />
        <Link href="/host-login" className="btn btn-ghost btn-sm">
          Host login
        </Link>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button 
        onClick={() => setOpen(!open)}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'var(--brass)',
          color: '#fff',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600,
          fontSize: '18px',
          cursor: 'pointer',
          padding: 0
        }}
        aria-label="Host profile menu"
      >
        {host.name ? host.name.charAt(0).toUpperCase() : '?'}
      </button>

      {open && (
        <div className="dropdown-menu">
          <div style={{ padding: '8px 12px 12px 12px', borderBottom: '1px solid var(--line-strong)', marginBottom: '4px' }}>
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--text)' }}>{host.name}</p>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-dim)' }}>{host.email}</p>
          </div>
          
          <Link href="/host" className="btn btn-ghost btn-block" style={{ justifyContent: 'flex-start', height: '40px', padding: '0 12px' }} onClick={() => setOpen(false)}>
            My Events
          </Link>
          <Link href="/host/profile" className="btn btn-ghost btn-block" style={{ justifyContent: 'flex-start', height: '40px', padding: '0 12px' }} onClick={() => setOpen(false)}>
            Profile & Security
          </Link>
          
          <div style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px' }}>Theme</span>
            <ThemeToggle />
          </div>
          
          <div style={{ borderTop: '1px solid var(--line-strong)', marginTop: '4px', paddingTop: '4px' }}>
            <button 
              onClick={handleLogout}
              className="btn btn-ghost btn-block" 
              style={{ justifyContent: 'flex-start', height: '40px', padding: '0 12px', color: 'var(--rust)' }}
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
