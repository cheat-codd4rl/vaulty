'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useToast } from '@/components/Toast';
import { fmtDate } from '@/lib/helpers';

export default function InviteLandingPage({ params }) {
  const { token } = use(params);
  const router = useRouter();
  const showToast = useToast();

  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    async function loadEvent() {
      try {
        const res = await fetch(`/api/invite/${token}`);
        if (!res.ok) {
          setError('Invite link is invalid or has expired.');
        } else {
          setEventData(await res.json());
        }
      } catch (err) {
        setError('Failed to load invite details.');
      } finally {
        setLoading(false);
      }
    }
    loadEvent();
  }, [token]);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Please enter your name');
      return;
    }

    setIsJoining(true);
    try {
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, pin })
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to join event');
        setIsJoining(false);
      } else {
        // Assume the backend set a JWT cookie.
        // We also receive the eventId to redirect.
        // Save the claimCode locally for the user?
        if (data.claimCode) {
          // You might want to display it to them, or just auto-bind to this browser.
          // For now, redirect to the event page.
          router.push(`/e/${data.eventId}?claimCode=${data.claimCode}`);
        } else {
          router.push(`/e/${data.eventId}`);
        }
      }
    } catch (err) {
      showToast('Network error joining event');
      setIsJoining(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="wrap section" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="skeleton" style={{ width: '300px', height: '400px', borderRadius: '16px' }}></div>
        </main>
        <Footer />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <main className="wrap section" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2>Invite Not Found</h2>
          <p style={{ color: 'var(--text-dim)', marginTop: '8px' }}>{error}</p>
          <button className="btn" style={{ marginTop: '24px' }} onClick={() => router.push('/')}>Go Home</button>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="wrap section" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '14px', marginBottom: '16px' }}>You&apos;ve been invited to join</p>
          <h1 style={{ marginBottom: '8px', fontSize: '28px' }}>{eventData.name}</h1>
          <p style={{ color: 'var(--text-faint)', fontSize: '15px', marginBottom: '32px' }}>
            {fmtDate(eventData.date)}
          </p>

          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
            <div className="field">
              <label>Your Name</label>
              <input 
                type="text" 
                placeholder="First & Last Name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                style={{ height: '48px' }}
              />
            </div>
            
            {eventData.hasPin && (
              <div className="field">
                <label>Event PIN</label>
                <input 
                  type="text" 
                  placeholder="Enter 6-digit PIN"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  required
                  maxLength={6}
                  style={{ height: '48px', letterSpacing: '2px', fontFamily: 'monospace', fontSize: '18px' }}
                />
              </div>
            )}

            <button type="submit" className="btn btn-brass" style={{ height: '48px', marginTop: '8px' }} disabled={isJoining}>
              {isJoining ? 'Joining...' : 'Join Event'}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}
