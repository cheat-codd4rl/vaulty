'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import NewEventModal from '@/components/NewEventModal';
import { listHostEvents } from '@/lib/store';
import { fmtDate } from '@/lib/helpers';

export default function HostDashboard() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadEvents = async () => {
    const evts = await listHostEvents();
    setEvents(evts);
    setLoaded(true);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleCreated = (event) => {
    setShowModal(false);
    router.push('/host/' + event.id);
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
        <div className="section-head">
          <div>
            <h2>Your events</h2>
            <p>Everything you&apos;ve created from this browser.</p>
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
