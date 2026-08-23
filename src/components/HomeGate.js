'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/Toast';
import AbsoluteThemeToggle from '@/components/AbsoluteThemeToggle';

const VIEW = { ROOT: 'root', HOST: 'host', GUEST: 'guest' };

export default function HomeGate() {
  const router = useRouter();
  const showToast = useToast();
  const [view, setView] = useState(VIEW.ROOT);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');

  const [codeLoading, setCodeLoading] = useState(false);

  function resetToRoot() {
    setView(VIEW.ROOT);
    setCode('');
    setCodeError('');
  }

  async function handleGuestSubmit(e) {
    e.preventDefault();
    const v = code.trim();
    if (!v) {
      setCodeError('Enter an event code or PIN');
      return;
    }
    setCodeError('');
    
    // Try to parse as a full URL first
    const hashMatch = v.match(/#\/e\/([A-Za-z0-9_]+)/);
    if (hashMatch) {
      router.push('/e/' + hashMatch[1]);
      return;
    }
    const routeMatch = v.match(/\/e\/([A-Za-z0-9_]+)/);
    if (routeMatch) {
      router.push('/e/' + routeMatch[1]);
      return;
    }
    // Direct event ID (evt_ prefix)
    if (/^evt_/.test(v)) {
      router.push('/e/' + v);
      return;
    }

    // Looks like a short code — resolve via API
    if (/^[A-Za-z0-9]{4,10}$/.test(v)) {
      setCodeLoading(true);
      try {
        const res = await fetch('/api/events/resolve?code=' + encodeURIComponent(v));
        if (res.ok) {
          const data = await res.json();
          router.push('/e/' + data.id);
          return;
        }
        if (res.status === 404) {
          setCodeError('No event found with that code');
        } else if (res.status === 429) {
          setCodeError('Too many attempts — try again in a minute');
        } else {
          setCodeError('Something went wrong — try again');
        }
      } catch {
        setCodeError("Couldn't reach the server — try again");
      } finally {
        setCodeLoading(false);
      }
      return;
    }
    
    showToast("Couldn't read that — check the link and try again");
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px', background: 'var(--ink)' }}>
      <AbsoluteThemeToggle />
      <div style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '32px', padding: '48px 0', margin: 'auto' }}>
        
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img src="/vaulty-dark-128.svg" alt="Vaulty icon" className="logo-dark" style={{ width: '96px', height: '96px', margin: '0 auto 16px', borderRadius: '18px', objectFit: 'cover' }} />
          <img src="/vaulty-light-128.svg" alt="Vaulty icon" className="logo-light" style={{ width: '96px', height: '96px', margin: '0 auto 16px', borderRadius: '18px', objectFit: 'cover' }} />
          <h1 style={{ fontSize: '38px', letterSpacing: '-0.02em' }}>
            Vault<em style={{ color: 'var(--brass)', fontStyle: 'normal' }}>y</em>
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--text-dim)', marginTop: '8px', margin: '8px 0 0' }}>
            Every photo from the night, in one vault.
          </p>
        </div>

        {view === VIEW.ROOT && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <button onClick={() => setView(VIEW.HOST)} className="btn btn-block" style={{ height: '56px', fontSize: '15.5px', justifyContent: 'flex-start', paddingLeft: '20px' }}>
              I&apos;m hosting
            </button>
            <button onClick={() => setView(VIEW.GUEST)} className="btn btn-block" style={{ height: '56px', fontSize: '15.5px', justifyContent: 'flex-start', paddingLeft: '20px' }}>
              I&apos;m a guest
            </button>
          </div>
        )}

        {view === VIEW.HOST && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Link href="/host" className="btn btn-brass btn-block" style={{ height: '56px', fontSize: '15.5px' }}>
              Create a new event
            </Link>
            <Link href="/host-login" className="btn btn-block" style={{ height: '56px', fontSize: '15.5px' }}>
              Log in to an existing event
            </Link>
            <button onClick={resetToRoot} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: '13px', cursor: 'pointer', marginTop: '6px' }}>
              ← Back
            </button>
          </div>
        )}

        {view === VIEW.GUEST && (
          <form onSubmit={handleGuestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <input
                type="text"
                value={code}
                onChange={(e) => { setCode(e.target.value); setCodeError(''); }}
                placeholder="Event code or PIN"
                style={{ height: '56px' }}
              />
              {codeError && <p style={{ fontSize: '12px', color: 'var(--rust)', margin: '6px 0 0' }}>{codeError}</p>}
            </div>
            <button type="submit" disabled={codeLoading} className="btn btn-brass btn-block" style={{ height: '56px', fontSize: '15.5px' }}>
              {codeLoading ? 'Looking up…' : 'Join event'}
            </button>
            <button type="button" onClick={resetToRoot} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: '13px', cursor: 'pointer', marginTop: '6px' }}>
              ← Back
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <Link href="/about" style={{ fontSize: '12.5px', color: 'var(--text-faint)', textDecoration: 'underline' }}>
            See how Vaulty works
          </Link>
        </div>

      </div>
    </main>
  );
}
