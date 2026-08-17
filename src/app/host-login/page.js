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
    <div className="container" style={{ maxWidth: '400px', marginTop: '10vh' }}>
      <div className="card" style={{ padding: '2rem' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Host Login</h1>
        <form onSubmit={handleLogin}>
          <div className="field">
            <label htmlFor="eventCode">Event Code</label>
            <input
              type="text"
              id="eventCode"
              placeholder="e.g. sarah-bday-4f2k"
              value={eventCode}
              onChange={(e) => setEventCode(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Host Password</label>
            <input
              type="password"
              id="password"
              placeholder="Enter your host password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-brass btn-block" disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}
