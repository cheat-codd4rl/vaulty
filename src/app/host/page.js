'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import NewEventModal from '@/components/NewEventModal';
import { listHostEvents, listLegacyEvents, getDeviceToken } from '@/lib/store';
import { fmtDate } from '@/lib/helpers';
import { useToast } from '@/components/Toast';

export default function HostDashboard() {
  const router = useRouter();
  const showToast = useToast();
  const [events, setEvents] = useState([]);
  const [legacyEvents, setLegacyEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const loadEvents = async () => {
    try {
      const res = await fetch('/api/host/me');
      if (res.ok) {
        const data = await res.json();
        if (!data.authenticated) {
          router.push('/host-login');
          return;
        }
        
        const evts = await listHostEvents(data.hostId);
        setEvents(evts);
        
        // Check for legacy events on this device
        const legEvts = await listLegacyEvents();
        setLegacyEvents(legEvts);
        
        setLoaded(true);
      } else {
        router.push('/host-login');
      }
    } catch (err) {
      router.push('/host-login');
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleCreated = (event) => {
    setShowModal(false);
    // Refresh list if the user created a profile
    if (event.isNewHost) {
      loadEvents();
    } else {
      router.push('/host/' + event.id);
    }
  };

  const handleClaim = async () => {
    if (!legacyEvents.length) return;
    setClaiming(true);
    try {
      const deviceToken = await getDeviceToken();
      const res = await fetch('/api/host/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceToken })
      });
      if (res.ok) {
        showToast('Events successfully claimed!');
        loadEvents();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to claim events');
      }
    } catch (err) {
      showToast('An error occurred');
    }
    setClaiming(false);
  };

  if (!loaded) {
    return (
      <>
        <Navbar />
        <div className="wrap section">
          <div className="section-head">
            <div>
              <div className="skeleton" style={{ width: '140px', height: '28px', marginBottom: '8px' }}></div>
              <div className="skeleton" style={{ width: '220px', height: '16px' }}></div>
            </div>
            <div className="skeleton" style={{ width: '110px', height: '40px', borderRadius: '20px' }}></div>
          </div>
          <div className="vault-grid">
            {[1, 2, 3].map(i => (
              <div key={i} className="vault-card skeleton" style={{ height: '220px', border: 'none' }}></div>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="wrap section">
        
        {legacyEvents.length > 0 && (
          <div style={{ background: 'var(--brass-soft)', padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: 0, color: 'var(--ink)' }}>Claim Your Previous Events</h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--ink)' }}>
              We found {legacyEvents.length} event(s) created on this device before Host Profiles were introduced. 
              Would you like to claim them so they are securely attached to your new Host Profile?
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {legacyEvents.map(e => (
                <span key={e.id} style={{ fontSize: '13px', background: 'rgba(0,0,0,0.1)', color: 'var(--ink)', padding: '4px 8px', borderRadius: '16px', fontWeight: 600 }}>
                  {e.name}
                </span>
              ))}
            </div>
            <button 
              onClick={handleClaim} 
              disabled={claiming}
              className="btn btn-ink" 
              style={{ alignSelf: 'flex-start', marginTop: '4px' }}
            >
              {claiming ? 'Claiming...' : 'Claim Events'}
            </button>
          </div>
        )}

        <div className="section-head">
          <div>
            <h2>Your events</h2>
            <p>Manage all your securely hosted Vaulty events.</p>
          </div>
          <button className="btn btn-brass" onClick={() => setShowModal(true)}>
            + New event
          </button>
        </div>

        {events.length > 0 ? (
          <div className="vault-grid">
            {events.map((e) => (
              <button
                key={e.id}
                className="vault-card"
                onClick={() => router.push('/host/' + e.id)}
              >
                <div className="vault-cover">
                  {e.cover && <img src={e.cover} alt="" />}
                </div>
                <div className="vault-body">
                  <h3>{e.name}</h3>
                  <div className="meta">{fmtDate(e.date)}</div>
                  <div className="vault-badges">
                    <span className={`pill ${e.accessMode === 'pin' ? 'warn' : ''}`}>
                      {e.accessMode === 'pin' ? 'PIN protected' : 'open link'}
                    </span>
                    <span className={`pill ${e.moderationMode === 'approval' ? 'brass' : ''}`}>
                      {e.moderationMode === 'approval' ? 'approval required' : 'auto-publish'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty">
            <h3>No events yet</h3>
            <p>
              Create one to get a shareable link and a printable QR code — guests can start
              uploading within a minute of scanning it.
            </p>
            <button className="btn btn-brass" onClick={() => setShowModal(true)}>
              + New event
            </button>
          </div>
        )}
      </div>
      <Footer />
      {showModal && <NewEventModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
    </>
  );
}
