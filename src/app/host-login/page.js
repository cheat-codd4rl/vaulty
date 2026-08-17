'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';

export default function HostLogin() {
  const router = useRouter();
  const showToast = useToast();
  const [eventCode, setEventCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    const code = eventCode.trim();
    if (!code || !password) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/events/${code}/host-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After');
          showToast(`Too many attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.`);
        } else if (res.status === 404) {
          showToast('Event not found.');
        } else {
          showToast('Invalid password.');
        }
        setLoading(false);
        return;
      }

      showToast('Login successful!');
      router.push(`/host/${code}`);
    } catch (err) {
      showToast('An error occurred.');
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', background: 'var(--ink)' }}>
      <div style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '32px', padding: '48px 0' }}>
        
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img src="/vaulty-icon.svg" alt="Vaulty icon" style={{ width: '64px', height: '64px', margin: '0 auto 16px', borderRadius: '14px', objectFit: 'cover' }} />
          <h1 style={{ fontSize: '32px', letterSpacing: '-0.02em', marginBottom: '8px' }}>Host Login</h1>
          <p style={{ fontSize: '15px', color: 'var(--text-dim)', margin: 0 }}>
            Log in to manage your event.
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="eventCode" style={{ textAlign: 'center' }}>Event Code</label>
            <input
              type="text"
              id="eventCode"
              placeholder="e.g. sarah-bday-4f2k"
              value={eventCode}
              onChange={(e) => setEventCode(e.target.value)}
              required
              style={{ textAlign: 'center' }}
            />
          </div>
          <div className="field" style={{ marginBottom: '8px' }}>
            <label htmlFor="password" style={{ textAlign: 'center' }}>Host Password</label>
            <input
              type="password"
              id="password"
              placeholder="Enter your host password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ textAlign: 'center' }}
            />
          </div>
          <button type="submit" className="btn btn-brass btn-block" style={{ height: '56px', fontSize: '15.5px' }} disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
          <button type="button" onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: '13px', cursor: 'pointer', marginTop: '6px' }}>
            ← Back home
          </button>
        </form>
      </div>
    </main>
  );
}
