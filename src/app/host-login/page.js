'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import AbsoluteThemeToggle from '@/components/AbsoluteThemeToggle';

export default function HostLogin() {
  const router = useRouter();
  const showToast = useToast();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [hostId, setHostId] = useState('');
  const [otp, setOtp] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/host/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Login failed.');
        setLoading(false);
        return;
      }

      if (data.requiresOtp) {
        setHostId(data.hostId);
        setRequiresOtp(true);
      }
      setLoading(false);
    } catch (err) {
      showToast('An error occurred.');
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/host/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId, otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Verification failed.');
        setLoading(false);
        return;
      }

      showToast('Login successful!');
      router.push(`/host`);
    } catch (err) {
      showToast('An error occurred.');
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', background: 'var(--ink)' }}>
      <AbsoluteThemeToggle />
      <div style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '32px', padding: '48px 0' }}>
        
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img src="/vaulty-dark-128.svg" alt="Vaulty icon" className="logo-dark" style={{ width: '96px', height: '96px', margin: '0 auto 16px', borderRadius: '18px', objectFit: 'cover' }} />
          <img src="/vaulty-light-128.svg" alt="Vaulty icon" className="logo-light" style={{ width: '96px', height: '96px', margin: '0 auto 16px', borderRadius: '18px', objectFit: 'cover' }} />
          <h1 style={{ fontSize: '28px', letterSpacing: '-0.02em', margin: '0 0 8px 0' }}>
            Host Login
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--text-dim)', margin: 0 }}>
            {requiresOtp ? "Enter the verification code sent to your email." : "Manage your Vaulty events"}
          </p>
        </div>
        {!requiresOtp ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                style={{ height: '56px' }}
                required
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Host password"
                style={{ height: '56px' }}
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn btn-brass btn-block" style={{ height: '56px', fontSize: '15.5px' }}>
              {loading ? 'Authenticating...' : 'Continue'}
            </button>
            <button type="button" onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: '13px', cursor: 'pointer', marginTop: '6px' }}>
              ← Back home
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <input
                type="text"
                className="pin-input"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="••••••"
                style={{ height: '72px', margin: '0 auto', width: '100%' }}
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn btn-brass btn-block" style={{ height: '56px', fontSize: '15.5px' }}>
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>
            <button type="button" onClick={() => setRequiresOtp(false)} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: '13px', cursor: 'pointer', marginTop: '6px' }}>
              ← Back to login
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
