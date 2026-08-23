'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

const ACCOUNTS_KEY = 'vaulty_host_accounts';

function getSavedAccounts() {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveAccounts(accounts) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch { /* quota exceeded */ }
}

/** Append or update an account in localStorage. */
export function upsertAccount({ hostId, email, name }) {
  const accounts = getSavedAccounts();
  const idx = accounts.findIndex(a => a.hostId === hostId);
  if (idx >= 0) {
    accounts[idx] = { hostId, email, name };
  } else {
    accounts.push({ hostId, email, name });
  }
  saveAccounts(accounts);
}

/** Remove an account from localStorage. */
export function removeAccount(hostId) {
  const accounts = getSavedAccounts().filter(a => a.hostId !== hostId);
  saveAccounts(accounts);
}

export default function HostProfileMenu() {
  const router = useRouter();
  const [host, setHost] = useState(null);
  const [otherAccounts, setOtherAccounts] = useState([]);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
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
            // Make sure the active account is saved to localStorage
            upsertAccount({ hostId: data.hostId, email: data.email, name: data.name });
          }
        }
      } catch (err) {
        // ignore
      }
      setLoading(false);
    }
    checkAuth();
  }, []);

  // Derive other accounts once we know who the active host is
  useEffect(() => {
    if (host) {
      const all = getSavedAccounts();
      setOtherAccounts(all.filter(a => a.hostId !== host.hostId));
    }
  }, [host]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitch = async (targetHostId) => {
    setSwitching(true);
    try {
      const res = await fetch('/api/host/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: targetHostId }),
      });
      if (res.ok) {
        // Reload to pick up the new session
        window.location.href = '/host';
      } else {
        const data = await res.json();
        // Session expired — remove from saved accounts
        if (res.status === 401) {
          removeAccount(targetHostId);
          setOtherAccounts(prev => prev.filter(a => a.hostId !== targetHostId));
        }
        alert(data.error || 'Could not switch accounts');
      }
    } catch {
      alert('Failed to switch accounts');
    }
    setSwitching(false);
  };

  const handleLogout = async () => {
    if (host) {
      removeAccount(host.hostId);
    }
    await fetch('/api/host/logout', { method: 'POST' });
    setHost(null);
    setOtherAccounts(getSavedAccounts());
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
          {/* Active account */}
          <div style={{ padding: '8px 12px 12px 12px', borderBottom: '1px solid var(--line-strong)', marginBottom: '4px' }}>
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--text)' }}>{host.name}</p>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-dim)' }}>{host.email}</p>
          </div>
          
          <Link href="/host" className="btn btn-ghost btn-block" style={{ justifyContent: 'flex-start', height: '40px', padding: '0 12px' }} onClick={() => setOpen(false)}>
            My Events
          </Link>
          <Link href="/host/profile" className="btn btn-ghost btn-block" style={{ justifyContent: 'flex-start', height: '40px', padding: '0 12px' }} onClick={() => setOpen(false)}>
            Profile &amp; Security
          </Link>
          
          <div style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px' }}>Theme</span>
            <ThemeToggle />
          </div>

          {/* Other saved accounts */}
          {otherAccounts.length > 0 && (
            <div style={{ borderTop: '1px solid var(--line-strong)', marginTop: '4px', paddingTop: '4px' }}>
              <p style={{ margin: '4px 12px 8px', fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Switch account
              </p>
              {otherAccounts.map(acct => (
                <button
                  key={acct.hostId}
                  onClick={() => handleSwitch(acct.hostId)}
                  disabled={switching}
                  className="btn btn-ghost btn-block"
                  style={{ justifyContent: 'flex-start', height: '44px', padding: '0 12px', gap: '10px' }}
                >
                  <span style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: 'var(--text-faint)', color: 'var(--ink)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 600, fontSize: '13px', flexShrink: 0
                  }}>
                    {acct.name ? acct.name.charAt(0).toUpperCase() : '?'}
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '1.3' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{acct.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{acct.email}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          
          {/* Add account + Logout */}
          <div style={{ borderTop: '1px solid var(--line-strong)', marginTop: '4px', paddingTop: '4px' }}>
            <Link
              href="/host-login"
              className="btn btn-ghost btn-block"
              style={{ justifyContent: 'flex-start', height: '40px', padding: '0 12px' }}
              onClick={() => setOpen(false)}
            >
              + Add another account
            </Link>
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
